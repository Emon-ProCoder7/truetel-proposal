"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import Stepper from "@/components/Stepper";
import StepWelcome from "@/components/steps/StepWelcome";
import StepProfile from "@/components/steps/StepProfile";
import StepDiscovery from "@/components/steps/StepDiscovery";
import StepPricing from "@/components/steps/StepPricing";
import StepPreview from "@/components/steps/StepPreview";
import { playTick } from "@/lib/sound";
import type { Narrative } from "@/lib/n8n";
import {
  DEFAULT_QUANTITIES,
  type CompanyTierId,
  type DiscoveryAnswers,
  type DiscountInput,
  type PricingResult,
  type Quantities,
} from "@/lib/pricing";

export type CurrentSetup = {
  hasProvider: boolean;
  providerName: string;
  monthlyCost: number;
  painPoints: string[];
};

export const PAIN_POINT_OPTIONS = [
  "Frequent outages",
  "Expensive month-to-month",
  "No mobility / remote work",
  "Poor call quality",
  "No reporting or call recording",
  "Contract locking them in",
];

export type ProposalPreview = {
  mergedHtml: string;
  emailText: string;
  narrative: Narrative;
  pricingSnapshot: PricingResult;
};

export type WizardState = {
  rep: { name: string; email: string };
  client: { companyName: string; contactName: string; contactEmail: string; contactPhone: string };
  dealShape: "standard" | "multiSite";
  outputFormat: "email" | "brandedPdf";
  companyTier: CompanyTierId;
  discovery: DiscoveryAnswers;
  currentSetup: CurrentSetup;
  quantities: Quantities;
  discount: DiscountInput;
  contractTermMonths: number;
  /** Some procurement teams want line-by-line pricing, others just the bottom line. */
  showLineItems: boolean;
  notes: string;
  preview: ProposalPreview | null;
};

const INITIAL_STATE: WizardState = {
  rep: { name: "", email: "" },
  client: { companyName: "", contactName: "", contactEmail: "", contactPhone: "" },
  dealShape: "standard",
  outputFormat: "email",
  companyTier: "basic",
  discovery: {
    businessStatus: "new",
    hasLandline: false,
    needsHandsets: false,
    headcount: 1,
    hasExistingSystem: false,
  },
  currentSetup: { hasProvider: false, providerName: "", monthlyCost: 0, painPoints: [] },
  quantities: DEFAULT_QUANTITIES,
  discount: { type: "none", value: 0 },
  contractTermMonths: 24,
  showLineItems: true,
  notes: "",
  preview: null,
};

const STEP_COUNT = 5;
const REP_STORAGE_KEY = "truetel-proposal-rep";

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  // A rep's own name/email rarely changes — remember it on this device so
  // it's asked once, not on every proposal. This is what was missing before:
  // meta.repEmail was always empty, which is why Gmail rejected the "To"
  // field on the multi-site notify path.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REP_STORAGE_KEY);
      if (saved) setState((s) => ({ ...s, rep: JSON.parse(saved) }));
    } catch {
      // localStorage unavailable (private browsing, etc.) — just ask every time.
    }
  }, []);

  useEffect(() => {
    if (!state.rep.name && !state.rep.email) return;
    try {
      localStorage.setItem(REP_STORAGE_KEY, JSON.stringify(state.rep));
    } catch {
      // ignore — non-critical
    }
  }, [state.rep]);

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  const repIncomplete = !state.rep.name.trim() || !state.rep.email.trim();
  const clientIncomplete = !state.client.companyName.trim() || !state.client.contactEmail.trim();
  const blockedOnStep1 = step === 1 && (repIncomplete || clientIncomplete);

  const goNext = () => {
    playTick("select");
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  };
  const goBack = () => {
    playTick("select");
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-bg">
      {step > 0 && (
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/85 px-5 py-3 backdrop-blur sm:px-8">
          <button
            type="button"
            onClick={goBack}
            className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink"
            aria-label="Back"
          >
            ←
          </button>
          <Stepper step={step} />
          <Image src="/truetel-logo.png" alt="TrueTel" width={24} height={24} className="shrink-0 rounded-md" />
        </header>
      )}

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          >
            {step === 0 && <StepWelcome onStart={goNext} />}
            {step === 1 && <StepProfile state={state} update={update} />}
            {step === 2 && <StepDiscovery state={state} update={update} />}
            {step === 3 && <StepPricing state={state} update={update} onGenerated={goNext} />}
            {step === 4 && <StepPreview state={state} update={update} onNeedsChanges={goBack} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {(step === 1 || step === 2) && (
        <div className="sticky bottom-0 z-20 border-t border-line bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
          <button
            type="button"
            disabled={blockedOnStep1}
            onClick={goNext}
            className="tap-target w-full rounded-pill bg-accent-ink px-5 py-4 text-[15px] font-semibold text-accent disabled:opacity-40"
          >
            Continue
          </button>
          {blockedOnStep1 && (
            <p className="mt-2 text-center text-xs text-ink-faint">
              Add your name/email and the client&apos;s company + contact email to continue.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
