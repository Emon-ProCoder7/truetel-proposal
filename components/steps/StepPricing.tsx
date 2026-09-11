"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Reveal from "@/components/ui/Reveal";
import CountUp from "@/components/ui/CountUp";
import GlassCard from "@/components/GlassCard";
import { Field, SegmentedControl, TextArea, TextInput, ToggleRow } from "@/components/fields";
import { calculatePricing, PRICING_TIERS } from "@/lib/pricing";
import { buildProposalPayload, generateProposal } from "@/lib/n8n";
import { playTick } from "@/lib/sound";
import type { WizardState } from "@/components/Wizard";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onGenerated: () => void;
};

export default function StepPricing({ state, update, onGenerated }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(
    () => calculatePricing(state.quantities, state.companyTier, state.discount),
    [state.quantities, state.companyTier, state.discount]
  );

  const canSubmit = state.client.companyName.trim().length > 0 && state.client.contactEmail.trim().length > 0;

  const handleGenerate = async () => {
    if (!canSubmit || generating) return;
    setGenerating(true);
    setError(null);
    playTick("confirm");

    const payload = buildProposalPayload(state, pricing, "generate");
    const res = await generateProposal(payload);
    setGenerating(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    update({
      preview: {
        mergedHtml: res.mergedHtml || "",
        emailText: res.emailText || "",
        narrative: res.narrative || { executiveSummary: "", keyOutcomes: [], heroStats: [] },
        pricingSnapshot: pricing,
      },
    });
    onGenerated();
  };

  return (
    <div className="flex flex-col gap-6 px-5 pb-32 pt-6 sm:px-8">
      <Reveal>
        <h2 className="text-display-md text-[1.6rem] text-ink">Price it and discount it</h2>
      </Reveal>

      <Reveal delay={0.04}>
        <GlassCard as="div" dark>
          <div className="flex flex-col gap-2">
            {pricing.lineItems.length === 0 && (
              <span className="text-sm text-on-dark/70">No line items yet — add quantities on the previous step.</span>
            )}
            {pricing.lineItems.map((li) => (
              <div key={li.description} className="flex items-center justify-between text-sm">
                <span className="text-on-dark/80">
                  {li.description} {li.qty > 1 && <span className="text-on-dark/50">× {li.qty}</span>}
                </span>
                <span className="text-num text-on-dark">${li.lineTotalExGst.toFixed(2)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm">
              <span className="text-on-dark/70">Subtotal (ex GST)</span>
              <span className="text-num text-on-dark/90">${pricing.subtotalBeforeTierExGst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-dark/70">{PRICING_TIERS[state.companyTier].label} tier × {pricing.tierMultiplier.toFixed(2)}</span>
              <span className="text-num text-on-dark/90">${pricing.subtotalExGst.toFixed(2)}</span>
            </div>
            {pricing.discountAmountExGst > 0 && (
              <div className="flex items-center justify-between text-sm text-accent">
                <span>Discount</span>
                <span className="text-num">−${pricing.discountAmountExGst.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-dark/70">GST (10%)</span>
              <span className="text-num text-on-dark/90">${pricing.gst.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-semibold text-on-dark">Total / month inc. GST</span>
              <CountUp value={pricing.totalIncGst} className="text-display-md text-num text-2xl text-accent" />
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={0.08}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Discount</span>
        <div className="mt-2 flex items-center gap-3">
          <SegmentedControl
            value={state.discount.type}
            onChange={(v) => update({ discount: { ...state.discount, type: v } })}
            options={[
              { value: "none", label: "None" },
              { value: "percent", label: "%" },
              { value: "flat", label: "$" },
            ]}
          />
          <AnimatePresence>
            {state.discount.type !== "none" && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 96, opacity: 1 }} exit={{ width: 0, opacity: 0 }}>
                <TextInput
                  type="number"
                  min={0}
                  value={state.discount.value || ""}
                  onChange={(e) => update({ discount: { ...state.discount, value: Number(e.target.value) } })}
                  placeholder={state.discount.type === "percent" ? "10" : "50"}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <Field label="Contract term (months)">
          <SegmentedControl
            value={String(state.contractTermMonths)}
            onChange={(v) => update({ contractTermMonths: Number(v) })}
            options={[
              { value: "12", label: "12 mo" },
              { value: "24", label: "24 mo" },
              { value: "36", label: "36 mo" },
            ]}
          />
        </Field>
      </Reveal>

      <Reveal delay={0.14}>
        <ToggleRow
          label="Show the itemised breakdown"
          description="Off shows the client just the bottom-line total — some procurement teams prefer that to a line-by-line table"
          checked={state.showLineItems}
          onChange={(v) => update({ showLineItems: v })}
        />
      </Reveal>

      <Reveal delay={0.16}>
        <Field label="Notes for the BDM" hint="Anything that doesn't fit the fields above.">
          <TextArea rows={3} value={state.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="e.g. wants a gift-card offer instead of a discount" />
        </Field>
      </Reveal>

      {error && (
        <Reveal>
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        </Reveal>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
        <button
          type="button"
          disabled={!canSubmit || generating}
          onClick={handleGenerate}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-pill bg-accent-ink px-5 py-4 text-[15px] font-semibold text-accent disabled:opacity-40"
        >
          {generating ? "Drafting…" : `Preview proposal — $${pricing.totalIncGst.toFixed(2)}/mo`}
        </button>
        {!canSubmit && <p className="mt-2 text-center text-xs text-ink-faint">Add a company name and contact email to continue.</p>}
      </div>
    </div>
  );
}
