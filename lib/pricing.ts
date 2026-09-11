// ============================================================================
// TrueTel Cloud Phone — pricing engine
//
// RATE_CARD figures are sourced from real numbers found in TrueTel's own
// Notion workspace (the "New Customer Call Handling" discovery script, the
// "1300 Number Charges" guide, the per-site NBN+phone worksheet, and the
// RJP Body Repair Centre deal record). Two figures could not be confirmed
// and are flagged below — get a rep/Jack to confirm before relying on them.
//
// TIERS is a NEW pricing strategy requested on top of that — TrueTel's real
// deal history shows flat per-unit pricing regardless of company size, not
// tiered premium pricing. These multipliers are placeholders wired up so the
// mechanism works end-to-end; the actual percentages are a business decision
// for TrueTel's leadership, not something derived from historical data.
// ============================================================================

import { DEFAULT_HARDWARE_SELECTION, HARDWARE_DB, type HardwareSelection } from "./hardware";

export const RATE_CARD = {
  nbn: {
    "50/20": 100, // UNCONFIRMED — never stated as a number in the material read; tagged on ~30% of real deals. Confirm with a rep before trusting this figure.
    "100/40": 120, // confirmed — discovery script worked example + per-site worksheet ($110-120 range)
  },
  landlinePerLine: 35, // confirmed — consistent across discovery script, per-site worksheet, and the RJP deal (6 x $35)
  // Handset pricing now comes from lib/hardware.ts (per real SKU) instead of one flat rate —
  // see HARDWARE_DB. The discovery script's flat $35/handset and the RJP deal's financed
  // ~$33-40/mo/unit both still sit inside that per-SKU range.
  cordlessPerUnit: 30, // UNCONFIRMED — not documented as a standalone monthly rate; estimated in line with handset pricing. Confirm before relying on it.
  cordlessBasePerUnit: 20, // UNCONFIRMED — same as above.
  mobileAppPerSeat: 35, // confirmed — Ringotel, "1300 Number Charges" guide; free when bundled with 1300 + landline
  modemPerUnit: 10, // UNCONFIRMED — treated as a small monthly rental estimate; TrueTel's real workflow sometimes supplies these as a one-off cost instead.
  number1300Standalone: 30, // confirmed
  number1300Bundled: 65, // confirmed (1300 + landline, includes free Ringotel) — real client example (Kunal)
  portingFirstLine: 100, // confirmed — FTC Default Template checklist
  portingAdditionalLine: 50, // confirmed
  regionalInstallSurcharge: 500, // confirmed
  setupFeeBase: 150, // UNCONFIRMED baseline one-off setup fee for a standard small deal; larger/bespoke deals (e.g. the Colleges project) have run a discounted special project price separately — treat this as a starting point only.
  gstRate: 0.10,
} as const;

export type NbnSpeed = keyof typeof RATE_CARD.nbn;

export type CompanyTierId = "basic" | "standard" | "premium";

export const PRICING_TIERS: Record<
  CompanyTierId,
  { label: string; blurb: string; headcountHint: string; multiplier: number }
> = {
  basic: {
    label: "Basic",
    blurb: "Standard SLA, self-serve support",
    headcountHint: "Solo trader or privately held small business",
    multiplier: 1.0,
  },
  standard: {
    label: "Standard",
    blurb: "Priority support queue, faster response window",
    headcountHint: "Growing team, single site",
    multiplier: 1.2, // placeholder — confirm with leadership
  },
  premium: {
    label: "Premium",
    blurb: "Dedicated account management, premium SLA",
    headcountHint: "Larger or multi-department organisation",
    multiplier: 1.5, // placeholder — confirm with leadership
  },
};

export type Quantities = {
  nbnSpeed: NbnSpeed;
  lines: number;
  // Each slot pairs one hardware SKU (real photo + spec, shown in the
  // proposal's Hardware Ecosystem section) with a quantity that ALSO drives
  // its price in the Investment Summary — the "paired pricing" fix: what the
  // client sees pictured is exactly what they're billed for, not a generic
  // flat-rate line disconnected from the actual model chosen.
  hardware: HardwareSelection;
  cordless: number;
  cordlessBase: number;
  mobileApps: number;
  modems: number;
  number1300: boolean;
  number1300Bundled: boolean;
  // Sites beyond 1 turns "lines" and "NBN"/"1300" into a per-site multiplier —
  // this is the real shape of the 12 Colleges deal (one connection + one
  // number per site, plus a small flat pool of central-reception handsets).
  // Approximated from that one real deal, not a documented rate-card rule —
  // confirm with a rep before trusting it on a large multi-site quote.
  siteCount: number;
};

export const DEFAULT_QUANTITIES: Quantities = {
  nbnSpeed: "100/40",
  lines: 1,
  hardware: DEFAULT_HARDWARE_SELECTION,
  cordless: 0,
  cordlessBase: 0,
  mobileApps: 0,
  modems: 0,
  number1300: false,
  number1300Bundled: false,
  siteCount: 1,
};

export type LineItem = {
  description: string;
  qty: number;
  unitPriceExGst: number;
  lineTotalExGst: number;
};

export type DiscountInput = {
  type: "percent" | "flat" | "none";
  value: number; // percent (0-100) or flat AUD amount
};

export type PricingResult = {
  lineItems: LineItem[];
  tier: CompanyTierId;
  tierMultiplier: number;
  subtotalBeforeTierExGst: number;
  subtotalExGst: number; // after tier multiplier, before discount
  discountAmountExGst: number;
  subtotalAfterDiscountExGst: number;
  gst: number;
  totalIncGst: number;
};

export function buildLineItems(q: Quantities): LineItem[] {
  const items: LineItem[] = [];
  const push = (description: string, qty: number, unitPriceExGst: number) => {
    if (qty <= 0) return;
    items.push({ description, qty, unitPriceExGst, lineTotalExGst: qty * unitPriceExGst });
  };

  const sites = Math.max(1, q.siteCount || 1);
  const siteTag = sites > 1 ? ` × ${sites} sites` : "";

  push(`NBN ${q.nbnSpeed}${siteTag}`, sites, RATE_CARD.nbn[q.nbnSpeed]);
  push(`Cloud landline${siteTag}`, q.lines * sites, RATE_CARD.landlinePerLine);

  // Hardware — each slot's line item uses the ACTUAL selected SKU's real
  // price, so what's pictured in the Hardware Ecosystem section is exactly
  // what's billed here, not a generic flat-rate line disconnected from it.
  for (const slot of Object.values(q.hardware)) {
    if (!slot.itemId || slot.qty <= 0) continue;
    const item = HARDWARE_DB[slot.itemId];
    if (!item) continue;
    push(item.title, slot.qty, item.unitPriceExGst);
  }

  push("Cordless handset", q.cordless, RATE_CARD.cordlessPerUnit);
  push("Cordless base station", q.cordlessBase, RATE_CARD.cordlessBasePerUnit);
  push("Ringotel mobile app seat", q.mobileApps, RATE_CARD.mobileAppPerSeat);
  push("Router / modem", q.modems, RATE_CARD.modemPerUnit);

  if (q.number1300) {
    if (q.number1300Bundled) {
      push(`1300 number (bundled with landline)${siteTag}`, sites, RATE_CARD.number1300Bundled);
    } else {
      push(`1300 number (standalone)${siteTag}`, sites, RATE_CARD.number1300Standalone);
    }
  }

  return items;
}

export function calculatePricing(
  q: Quantities,
  tier: CompanyTierId,
  discount: DiscountInput
): PricingResult {
  const lineItems = buildLineItems(q);
  const subtotalBeforeTierExGst = lineItems.reduce((sum, li) => sum + li.lineTotalExGst, 0);

  const tierMultiplier = PRICING_TIERS[tier].multiplier;
  const subtotalExGst = round2(subtotalBeforeTierExGst * tierMultiplier);

  let discountAmountExGst = 0;
  if (discount.type === "percent") {
    discountAmountExGst = round2(subtotalExGst * (clamp(discount.value, 0, 100) / 100));
  } else if (discount.type === "flat") {
    discountAmountExGst = round2(Math.min(Math.max(discount.value, 0), subtotalExGst));
  }

  const subtotalAfterDiscountExGst = round2(Math.max(0, subtotalExGst - discountAmountExGst));
  const gst = round2(subtotalAfterDiscountExGst * RATE_CARD.gstRate);
  const totalIncGst = round2(subtotalAfterDiscountExGst + gst);

  return {
    lineItems,
    tier,
    tierMultiplier,
    subtotalBeforeTierExGst: round2(subtotalBeforeTierExGst),
    subtotalExGst,
    discountAmountExGst,
    subtotalAfterDiscountExGst,
    gst,
    totalIncGst,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

// ---- Discovery-driven suggestions -----------------------------------------
// Mirrors the "New Customer Call Handling Guideline" script: every enquiry
// should default toward the bundle (NBN + landline + handset), not internet
// alone, unless the rep overrides it.

export type DiscoveryAnswers = {
  businessStatus: "new" | "relocating";
  hasLandline: boolean;
  needsHandsets: boolean;
  headcount: number;
  hasExistingSystem: boolean;
};

export function suggestQuantitiesFromDiscovery(a: DiscoveryAnswers): Quantities {
  const seats = Math.max(1, a.headcount || 1);
  return {
    ...DEFAULT_QUANTITIES,
    lines: a.hasLandline || !a.hasExistingSystem ? Math.min(seats, 4) : 1,
    hardware: a.needsHandsets
      ? { ...DEFAULT_HARDWARE_SELECTION, primary: { itemId: "yealink_t54", qty: Math.min(seats, 8) } }
      : DEFAULT_HARDWARE_SELECTION,
    mobileApps: !a.needsHandsets ? Math.min(seats, 8) : 0,
  };
}

export function suggestTierFromHeadcount(headcount: number): CompanyTierId {
  if (headcount >= 25) return "premium";
  if (headcount >= 6) return "standard";
  return "basic";
}
