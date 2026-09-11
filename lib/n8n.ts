import type { CompanyTierId, DiscountInput, PricingResult, Quantities } from "./pricing";
import type { DiscoveryAnswers } from "./pricing";
import type { CurrentSetup, WizardState } from "@/components/Wizard";

// ============================================================================
// The single JSON contract this app sends to n8n, in two calls against the
// SAME webhook (NEXT_PUBLIC_N8N_WEBHOOK_URL), distinguished by `mode`:
//
//   mode: "generate" — draft the narrative, merge the template, and return
//         the rendered proposal SYNCHRONOUSLY so the portal can preview it
//         before anything is sent to the client.
//   mode: "send"     — the rep tapped "Approve & Send". Carries the exact
//         `mergedHtml` / `emailText` the rep just previewed, so the send
//         step relays it verbatim — no re-drafting, no second AI call, and
//         what the rep approved is guaranteed to be what the client gets.
//
// Build your n8n workflow's Webhook node with responseMode "responseNode"
// and branch on `body.mode` — see n8n/cloud-phone-proposal.workflow.json.
// ============================================================================

export type Narrative = {
  executiveSummary: string;
  keyOutcomes: string[];
  heroStats: { value: string; label: string }[];
};

export type ProposalPayload = {
  mode: "generate" | "send";
  meta: {
    submittedAt: string; // ISO 8601
    source: "truetel-proposal-portal";
    repName: string;
    repEmail: string;
  };
  client: {
    companyName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  dealShape: "standard" | "multiSite";
  outputFormat: "email" | "brandedPdf";
  companyTier: CompanyTierId;
  discovery: DiscoveryAnswers;
  currentSetup: CurrentSetup;
  quantities: Quantities;
  pricing: {
    lineItems: PricingResult["lineItems"];
    tierMultiplier: number;
    subtotalBeforeTierExGst: number;
    subtotalExGst: number;
    discount: DiscountInput;
    discountAmountExGst: number;
    subtotalAfterDiscountExGst: number;
    gst: number;
    totalIncGst: number;
    contractTermMonths: number;
  };
  showLineItems: boolean;
  notes: string;
  /** Only populated (and only meaningful) on mode: "send". */
  mergedHtml?: string;
  emailText?: string;
};

export type GenerateResult = {
  ok: boolean;
  message: string;
  mergedHtml?: string;
  emailText?: string;
  narrative?: Narrative;
};

export function buildProposalPayload(
  state: WizardState,
  pricing: PricingResult,
  mode: "generate" | "send",
  extra?: { mergedHtml?: string; emailText?: string }
): ProposalPayload {
  return {
    mode,
    meta: {
      submittedAt: new Date().toISOString(),
      source: "truetel-proposal-portal",
      repName: state.rep.name,
      repEmail: state.rep.email,
    },
    client: state.client,
    dealShape: state.dealShape,
    outputFormat: state.outputFormat,
    currentSetup: state.currentSetup,
    companyTier: state.companyTier,
    discovery: state.discovery,
    quantities: state.quantities,
    pricing: {
      lineItems: pricing.lineItems,
      tierMultiplier: pricing.tierMultiplier,
      subtotalBeforeTierExGst: pricing.subtotalBeforeTierExGst,
      subtotalExGst: pricing.subtotalExGst,
      discount: state.discount,
      discountAmountExGst: pricing.discountAmountExGst,
      subtotalAfterDiscountExGst: pricing.subtotalAfterDiscountExGst,
      gst: pricing.gst,
      totalIncGst: pricing.totalIncGst,
      contractTermMonths: state.contractTermMonths,
    },
    showLineItems: state.showLineItems,
    notes: state.notes,
    mergedHtml: extra?.mergedHtml,
    emailText: extra?.emailText,
  };
}

async function postToN8n(payload: ProposalPayload) {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  if (!url) throw new Error("NO_WEBHOOK_CONFIGURED");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res;
}

export async function generateProposal(payload: ProposalPayload): Promise<GenerateResult> {
  if (!process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL) {
    // No webhook configured — fall back to a local, deterministic preview so
    // the portal is still usable while n8n is being set up.
    const p = payload.pricing;
    const fallbackEmail = `Hi ${payload.client.contactName || "there"},\n\nThanks for your time today. Here is your TrueTel Cloud Phone solution:\n\n${p.lineItems
      .map((li) => `- ${li.description}: $${li.lineTotalExGst.toFixed(2)}/mo`)
      .join("\n")}\n\nTotal: $${p.totalIncGst.toFixed(2)}/mo (${p.contractTermMonths}-month term)\n\nKind regards,\n${payload.meta.repName || "TrueTel Solutions"}`;
    return {
      ok: true,
      message: "No webhook configured yet — showing a local preview only (nothing was drafted by AI or sent).",
      mergedHtml: `<div style="font-family:sans-serif;padding:24px;">${fallbackEmail.replace(/\n/g, "<br>")}</div>`,
      emailText: fallbackEmail,
      narrative: { executiveSummary: "", keyOutcomes: [], heroStats: [] },
    };
  }

  try {
    const res = await postToN8n(payload);
    if (!res.ok) {
      return { ok: false, message: `n8n responded with ${res.status} while generating. Check the workflow's execution log.` };
    }
    const data = await res.json();
    return {
      ok: true,
      message: "Generated.",
      mergedHtml: data.mergedHtml,
      emailText: data.emailText,
      narrative: data.narrative,
    };
  } catch {
    return { ok: false, message: "Could not reach the webhook — check the URL and your connection." };
  }
}

export async function sendProposal(payload: ProposalPayload): Promise<{ ok: boolean; message: string }> {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  if (!url) {
    console.warn("NEXT_PUBLIC_N8N_WEBHOOK_URL is not set — send skipped.", payload);
    return { ok: true, message: "No webhook configured yet — nothing was actually sent." };
  }
  try {
    const res = await postToN8n(payload);
    if (!res.ok) {
      return { ok: false, message: `n8n responded with ${res.status} while sending. Check the workflow's execution log.` };
    }
    return { ok: true, message: "Sent." };
  } catch {
    return { ok: false, message: "Could not reach the webhook — check the URL and your connection." };
  }
}
