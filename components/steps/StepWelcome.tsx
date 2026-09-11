"use client";

import Image from "next/image";
import { motion } from "motion/react";
import GlassCard from "@/components/GlassCard";
import Reveal from "@/components/ui/Reveal";
import { spring } from "@/lib/motion-easings";

type ServiceDef = {
  id: string;
  name: string;
  blurb: string;
  status: "active" | "soon";
};

const SERVICES: ServiceDef[] = [
  { id: "cloudPhone", name: "Cloud Phone", blurb: "Cloud PBX proposals — priced, drafted, and sent on the spot.", status: "active" },
  { id: "msp", name: "Managed IT (MSP)", blurb: "Support, endpoints, Microsoft 365 — same on-the-spot flow.", status: "soon" },
  { id: "aiVoice", name: "AI Voice Agent", blurb: "Inbound call automation proposals.", status: "soon" },
];

export default function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-1px)] flex-col justify-between overflow-hidden">
      <div className="mesh-bg absolute inset-0 -z-10" aria-hidden />

      <div className="flex flex-1 flex-col justify-center px-5 pb-8 pt-14 sm:px-8">
        <Reveal className="flex items-center gap-2.5">
          <Image src="/truetel-logo.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span className="eyebrow">TrueTel · Proposal Builder</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="text-display-hero mt-4 text-[clamp(2.4rem,9vw,3.4rem)] text-ink">
            Build the proposal
            <br />
            while you&apos;re still
            <br />
            in the room.
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-secondary">
            Four taps for the client&apos;s setup, a tier, an optional discount —
            and it&apos;s priced and sent before you leave the meeting.
          </p>
        </Reveal>

        <Reveal delay={0.18} className="mt-9">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Choose a proposal type</span>
        </Reveal>

        <Reveal delay={0.2} stagger className="mt-3 flex flex-col gap-3">
          {SERVICES.map((svc) =>
            svc.status === "active" ? (
              <GlassCard key={svc.id} sheen onClick={onStart} className="!p-0">
                <motion.span
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink">{svc.name}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-ink-faint">{svc.blurb}</span>
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-ink text-accent">→</span>
                </motion.span>
              </GlassCard>
            ) : (
              <GlassCard key={svc.id} as="div" disabled className="relative !p-0">
                <span className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink">{svc.name}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-ink-faint">{svc.blurb}</span>
                  </span>
                  <span className="shrink-0 rounded-pill border border-line-strong bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                    Coming soon
                  </span>
                </span>
              </GlassCard>
            )
          )}
        </Reveal>
      </div>

      <div className="border-t border-line px-5 py-4 text-center text-[11px] text-ink-faint sm:px-8">
        Internal tool · TrueTel Solutions Pty Ltd
      </div>
    </div>
  );
}
