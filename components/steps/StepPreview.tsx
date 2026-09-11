"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Reveal from "@/components/ui/Reveal";
import GlassCard from "@/components/GlassCard";
import { SegmentedControl } from "@/components/fields";
import { calculatePricing } from "@/lib/pricing";
import { buildProposalPayload, sendProposal } from "@/lib/n8n";
import { playTick } from "@/lib/sound";
import type { WizardState } from "@/components/Wizard";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNeedsChanges: () => void;
};

export default function StepPreview({ state, update, onNeedsChanges }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = state.preview;
  if (!preview) return null; // guarded by Wizard — shouldn't render without a generated preview

  const handleApprove = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    playTick("confirm");

    const pricing = preview.pricingSnapshot ?? calculatePricing(state.quantities, state.companyTier, state.discount);
    const payload = buildProposalPayload(state, pricing, "send", {
      mergedHtml: preview.mergedHtml,
      emailText: preview.emailText,
    });
    const res = await sendProposal(payload);
    setSending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSent(res.message);
  };

  if (sent) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
          className="flex size-16 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink"
        >
          ✓
        </motion.div>
        <h2 className="text-display-md text-[1.5rem] text-ink">Sent</h2>
        <p className="max-w-xs text-sm text-ink-faint">{sent}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="tap-target mt-4 rounded-pill bg-ink px-5 py-3 text-sm font-semibold text-white"
        >
          Start another proposal
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-32 pt-6 sm:px-8">
      <Reveal>
        <h2 className="text-display-md text-[1.6rem] text-ink">This is what {state.client.contactEmail || "the client"} will get</h2>
        <p className="mt-1 text-sm text-ink-faint">Exactly what you approve below is what gets sent — nothing is redrafted after this.</p>
      </Reveal>

      <Reveal delay={0.04}>
        <SegmentedControl
          value={state.outputFormat}
          onChange={(v) => update({ outputFormat: v })}
          options={[
            { value: "email", label: "Email view" },
            { value: "brandedPdf", label: "Branded view" },
          ]}
        />
      </Reveal>

      <Reveal delay={0.08}>
        <GlassCard as="div" className="!p-0 overflow-hidden">
          {state.outputFormat === "brandedPdf" ? (
            <iframe
              title="Proposal preview"
              srcDoc={preview.mergedHtml}
              sandbox=""
              className="h-[62vh] w-full rounded-[inherit] bg-white"
            />
          ) : (
            <pre className="max-h-[62vh] overflow-y-auto whitespace-pre-wrap p-5 font-sans text-sm text-ink">
              {preview.emailText}
            </pre>
          )}
        </GlassCard>
      </Reveal>

      {preview.narrative.heroStats.length > 0 && (
        <Reveal delay={0.1}>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            AI-picked headline stats
          </span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {preview.narrative.heroStats.map((s, i) => (
              <GlassCard as="div" key={i} dark className="text-center !p-3">
                <span className="block text-lg font-extrabold text-accent">{s.value}</span>
                <span className="block text-[10px] uppercase tracking-wide text-on-dark/80">{s.label}</span>
              </GlassCard>
            ))}
          </div>
        </Reveal>
      )}

      {error && (
        <Reveal>
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        </Reveal>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-line bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
        <button
          type="button"
          onClick={onNeedsChanges}
          disabled={sending}
          className="tap-target flex-1 rounded-pill border border-line-strong bg-white px-5 py-4 text-[15px] font-semibold text-ink disabled:opacity-40"
        >
          Needs changes
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={sending}
          className="tap-target flex-[1.4] rounded-pill bg-accent-ink px-5 py-4 text-[15px] font-semibold text-accent disabled:opacity-40"
        >
          {sending ? "Sending…" : "Approve & send"}
        </button>
      </div>
    </div>
  );
}
