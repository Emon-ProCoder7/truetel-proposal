"use client";

import Image from "next/image";
import { motion } from "motion/react";
import GlassCard from "@/components/GlassCard";
import Reveal from "@/components/ui/Reveal";
import { spring } from "@/lib/motion-easings";

export default function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-1px)] flex-col justify-between overflow-hidden">
      <div className="mesh-bg absolute inset-0 -z-10" aria-hidden />

      <div className="flex flex-1 flex-col justify-center px-5 pb-8 pt-14 sm:px-8">
        <Reveal className="flex items-center gap-2.5">
          <Image src="/truetel-logo.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span className="eyebrow">TrueTel · Cloud Phone</span>
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

        <Reveal delay={0.2} className="mt-10">
          <GlassCard sheen onClick={onStart} className="!p-0">
            <motion.span
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
              className="flex items-center justify-between px-5 py-4"
            >
              <span className="text-[15px] font-semibold text-ink">Start a proposal</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-accent-ink text-accent">→</span>
            </motion.span>
          </GlassCard>
        </Reveal>
      </div>

      <div className="border-t border-line px-5 py-4 text-center text-[11px] text-ink-faint sm:px-8">
        Internal tool · TrueTel Solutions Pty Ltd
      </div>
    </div>
  );
}
