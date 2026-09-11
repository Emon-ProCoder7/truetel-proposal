"use client";

import Reveal from "@/components/ui/Reveal";
import GlassCard from "@/components/GlassCard";
import HardwarePicker from "@/components/HardwarePicker";
import { ChipMultiSelect, Field, SegmentedControl, Stepper as NumberStepper, TextInput, ToggleRow } from "@/components/fields";
import { suggestQuantitiesFromDiscovery, suggestTierFromHeadcount, type NbnSpeed } from "@/lib/pricing";
import { PAIN_POINT_OPTIONS, type WizardState } from "@/components/Wizard";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
};

export default function StepDiscovery({ state, update }: Props) {
  const applySuggestion = () => {
    const q = suggestQuantitiesFromDiscovery(state.discovery);
    const tier = suggestTierFromHeadcount(state.discovery.headcount);
    update({ quantities: { ...state.quantities, ...q }, companyTier: tier });
  };

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-6 sm:px-8">
      <Reveal>
        <h2 className="text-display-md text-[1.6rem] text-ink">The four questions</h2>
        <p className="mt-1 text-sm text-ink-faint">
          TrueTel&apos;s own discovery script — straight from the Knowledge Base.
        </p>
      </Reveal>

      <Reveal delay={0.04} className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Existing business relocating, or new business, new office?
        </span>
        <SegmentedControl
          value={state.discovery.businessStatus}
          onChange={(v) => update({ discovery: { ...state.discovery, businessStatus: v } })}
          options={[
            { value: "new", label: "New setup" },
            { value: "relocating", label: "Relocating" },
          ]}
        />
      </Reveal>

      <Reveal delay={0.08} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Has a landline today"
          checked={state.discovery.hasLandline}
          onChange={(v) => update({ discovery: { ...state.discovery, hasLandline: v } })}
        />
        <ToggleRow
          label="Needs handsets to answer calls"
          checked={state.discovery.needsHandsets}
          onChange={(v) => update({ discovery: { ...state.discovery, needsHandsets: v } })}
        />
        <ToggleRow
          label="Has an existing phone system"
          checked={state.discovery.hasExistingSystem}
          onChange={(v) => update({ discovery: { ...state.discovery, hasExistingSystem: v } })}
        />
      </Reveal>

      <Reveal delay={0.1} className="flex flex-col gap-3">
        <ToggleRow
          label="Currently with another provider"
          description="Turns on the before/after comparison in the proposal"
          checked={state.currentSetup.hasProvider}
          onChange={(v) => update({ currentSetup: { ...state.currentSetup, hasProvider: v } })}
        />
        {state.currentSetup.hasProvider && (
          <GlassCard as="div" className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Current provider">
                <TextInput
                  value={state.currentSetup.providerName}
                  onChange={(e) => update({ currentSetup: { ...state.currentSetup, providerName: e.target.value } })}
                  placeholder="Telstra, Optus, a local telco…"
                />
              </Field>
              <Field label="Current monthly cost ($)">
                <TextInput
                  type="number"
                  min={0}
                  value={state.currentSetup.monthlyCost || ""}
                  onChange={(e) => update({ currentSetup: { ...state.currentSetup, monthlyCost: Number(e.target.value) } })}
                  placeholder="450"
                />
              </Field>
            </div>
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                What&apos;s wrong with it today?
              </span>
              <ChipMultiSelect
                options={PAIN_POINT_OPTIONS}
                values={state.currentSetup.painPoints}
                onChange={(v) => update({ currentSetup: { ...state.currentSetup, painPoints: v } })}
              />
            </div>
          </GlassCard>
        )}
      </Reveal>

      <Reveal delay={0.12}>
        <GlassCard as="div" className="!p-4" dark>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-on-dark/90">
              &ldquo;Most businesses choose NBN + cloud phone + handsets so everything works together.&rdquo;
            </span>
            <button
              type="button"
              onClick={applySuggestion}
              className="tap-target shrink-0 rounded-pill bg-accent px-4 py-2 text-xs font-semibold text-accent-ink"
            >
              Suggest bundle
            </button>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={0.16}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">NBN speed</span>
        <div className="mt-2">
          <SegmentedControl<NbnSpeed>
            value={state.quantities.nbnSpeed}
            onChange={(v) => update({ quantities: { ...state.quantities, nbnSpeed: v } })}
            options={[
              { value: "50/20", label: "50/20" },
              { value: "100/40", label: "100/40" },
            ]}
          />
        </div>
      </Reveal>

      <Reveal delay={0.2} stagger className="flex flex-col gap-2.5">
        <NumberStepper label="Telephone lines" value={state.quantities.lines} onChange={(v) => update({ quantities: { ...state.quantities, lines: v } })} />
        <NumberStepper label="Cordless handsets" value={state.quantities.cordless} onChange={(v) => update({ quantities: { ...state.quantities, cordless: v } })} />
        <NumberStepper label="Cordless bases" value={state.quantities.cordlessBase} onChange={(v) => update({ quantities: { ...state.quantities, cordlessBase: v } })} />
        <NumberStepper label="Mobile app seats (Ringotel)" value={state.quantities.mobileApps} onChange={(v) => update({ quantities: { ...state.quantities, mobileApps: v } })} />
        <NumberStepper label="Routers / modems" value={state.quantities.modems} onChange={(v) => update({ quantities: { ...state.quantities, modems: v } })} />
      </Reveal>

      <Reveal delay={0.22}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Hardware ecosystem</span>
        <p className="mt-1 mb-2 text-xs text-ink-faint">
          Pick real models with real photos — what&apos;s shown here is exactly what&apos;s billed.
        </p>
        <HardwarePicker
          value={state.quantities.hardware}
          onChange={(hardware) => update({ quantities: { ...state.quantities, hardware } })}
        />
      </Reveal>

      <Reveal delay={0.24} className="flex flex-col gap-3">
        <ToggleRow
          label="Include a 1300 number"
          checked={state.quantities.number1300}
          onChange={(v) => update({ quantities: { ...state.quantities, number1300: v } })}
        />
        {state.quantities.number1300 && (
          <ToggleRow
            label="Bundle with landline"
            description="$65/mo bundled vs $30/mo standalone — Ringotel included free"
            checked={state.quantities.number1300Bundled}
            onChange={(v) => update({ quantities: { ...state.quantities, number1300Bundled: v } })}
          />
        )}
      </Reveal>
    </div>
  );
}
