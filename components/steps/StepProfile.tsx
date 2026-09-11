"use client";

import GlassCard from "@/components/GlassCard";
import Reveal from "@/components/ui/Reveal";
import { Field, Stepper as NumberStepper, TextInput } from "@/components/fields";
import { PRICING_TIERS, type CompanyTierId } from "@/lib/pricing";
import type { WizardState } from "@/components/Wizard";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
};

export default function StepProfile({ state, update }: Props) {
  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-6 sm:px-8">
      <Reveal>
        <h2 className="text-display-md text-[1.6rem] text-ink">Who&apos;s this for?</h2>
      </Reveal>

      <Reveal delay={0.02} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Your name" hint="Saved on this device — asked once.">
          <TextInput
            value={state.rep.name}
            onChange={(e) => update({ rep: { ...state.rep, name: e.target.value } })}
            placeholder="Alex Rep"
          />
        </Field>
        <Field label="Your email" hint="Where multi-site notifications land.">
          <TextInput
            type="email"
            value={state.rep.email}
            onChange={(e) => update({ rep: { ...state.rep, email: e.target.value } })}
            placeholder="alex@truetel.com.au"
          />
        </Field>
      </Reveal>

      <Reveal delay={0.04} stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company name">
          <TextInput
            value={state.client.companyName}
            onChange={(e) => update({ client: { ...state.client, companyName: e.target.value } })}
            placeholder="Acme Pty Ltd"
          />
        </Field>
        <Field label="Contact name">
          <TextInput
            value={state.client.contactName}
            onChange={(e) => update({ client: { ...state.client, contactName: e.target.value } })}
            placeholder="Jordan Smith"
          />
        </Field>
        <Field label="Contact email">
          <TextInput
            type="email"
            value={state.client.contactEmail}
            onChange={(e) => update({ client: { ...state.client, contactEmail: e.target.value } })}
            placeholder="jordan@acme.com.au"
          />
        </Field>
        <Field label="Contact phone">
          <TextInput
            value={state.client.contactPhone}
            onChange={(e) => update({ client: { ...state.client, contactPhone: e.target.value } })}
            placeholder="04xx xxx xxx"
          />
        </Field>
      </Reveal>

      <Reveal delay={0.08}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Deal shape</span>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <GlassCard selected={state.dealShape === "standard"} onClick={() => update({ dealShape: "standard" })}>
            <span className="block text-sm font-semibold text-ink">Standard business</span>
            <span className="mt-1 block text-xs text-ink-faint">Single site — ~93% of real deals</span>
          </GlassCard>
          <GlassCard selected={state.dealShape === "multiSite"} onClick={() => update({ dealShape: "multiSite" })}>
            <span className="block text-sm font-semibold text-ink">Multi-site / group</span>
            <span className="mt-1 block text-xs text-ink-faint">One platform, priced per site</span>
          </GlassCard>
        </div>
      </Reveal>

      {state.dealShape === "multiSite" && (
        <Reveal delay={0.09}>
          <NumberStepper
            label="Number of sites"
            min={2}
            max={200}
            value={state.quantities.siteCount}
            onChange={(v) => update({ quantities: { ...state.quantities, siteCount: v } })}
          />
          <p className="mt-2 text-xs text-ink-faint">
            NBN, landline and 1300 lines below get priced per site. Handsets stay a flat central-reception pool
            (that's the real shape of TrueTel&apos;s 12-site college deal — one connection + number per site, a
            small shared pool of reception handsets).
          </p>
        </Reveal>
      )}

      {state.dealShape === "standard" && (
        <Reveal delay={0.1}>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Output format</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <GlassCard selected={state.outputFormat === "email"} onClick={() => update({ outputFormat: "email" })}>
              <span className="block text-sm font-semibold text-ink">Quick email quote</span>
              <span className="mt-1 block text-xs text-ink-faint">Fastest — small, simple deals</span>
            </GlassCard>
            <GlassCard selected={state.outputFormat === "brandedPdf"} onClick={() => update({ outputFormat: "brandedPdf" })}>
              <span className="block text-sm font-semibold text-ink">Branded PDF</span>
              <span className="mt-1 block text-xs text-ink-faint">Larger or more formal deals</span>
            </GlassCard>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.14}>
        <Field label="Headcount at this location" hint="Drives the suggested tier and quantities below.">
          <TextInput
            type="number"
            min={1}
            value={state.discovery.headcount || ""}
            onChange={(e) => update({ discovery: { ...state.discovery, headcount: Number(e.target.value) } })}
            placeholder="5"
          />
        </Field>
      </Reveal>

      <Reveal delay={0.18}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Pricing tier</span>
        <p className="mt-1 text-xs text-ink-faint">
          Larger organisations sit on a higher support tier. Suggested from headcount — override anytime.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(PRICING_TIERS) as CompanyTierId[]).map((id) => {
            const tier = PRICING_TIERS[id];
            return (
              <GlassCard key={id} selected={state.companyTier === id} onClick={() => update({ companyTier: id })}>
                <span className="block text-sm font-semibold text-ink">{tier.label}</span>
                <span className="mt-1 block text-xs text-ink-faint">{tier.headcountHint}</span>
                <span className="mt-2 block text-[11px] font-semibold text-accent-ink">×{tier.multiplier.toFixed(2)}</span>
              </GlassCard>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
