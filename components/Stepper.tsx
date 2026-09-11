"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const LABELS = ["Start", "Client", "Setup", "Price", "Preview"];

export default function Stepper({ step }: { step: number }) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-2 px-1">
      {LABELS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="relative h-1.5 w-full overflow-hidden rounded-pill bg-line">
              {(active || done) && (
                <motion.div
                  layoutId="stepper-fill"
                  className="absolute inset-y-0 left-0 rounded-pill bg-accent-ink"
                  initial={false}
                  animate={{ width: done ? "100%" : "60%" }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />
              )}
            </div>
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", active ? "text-ink" : "text-ink-faint")}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
