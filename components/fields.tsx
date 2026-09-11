"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { playTick } from "@/lib/sound";
import { spring } from "@/lib/motion-easings";

export function ChipMultiSelect({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    playTick("select");
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "tap-target rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "border-accent-ink bg-accent text-accent-ink" : "border-line-strong bg-white text-ink-secondary"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-ink",
        props.className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-md border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-ink",
        props.className
      )}
    />
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-pill border border-line-strong bg-white p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              playTick("select");
              onChange(opt.value);
            }}
            className="tap-target relative flex-1 rounded-pill px-3 py-2 text-sm font-semibold"
          >
            {active && (
              <motion.span
                layoutId="segment-fill"
                className="absolute inset-0 rounded-pill bg-accent"
                transition={spring.snappy}
              />
            )}
            <span className={cn("relative z-10", active ? "text-accent-ink" : "text-ink-secondary")}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playTick("select");
        onChange(!checked);
      }}
      className="tap-target flex w-full items-center justify-between gap-4 rounded-md border border-line-strong bg-white px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-faint">{description}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-pill transition-colors",
          checked ? "bg-accent-ink" : "bg-line-strong"
        )}
      >
        <motion.span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 22 : 2 }}
          transition={spring.snappy}
        />
      </span>
    </button>
  );
}

export function Stepper({
  label,
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center justify-between rounded-md border border-line-strong bg-white px-4 py-2.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            playTick("select");
            set(value - 1);
          }}
          className="tap-target flex size-8 items-center justify-center rounded-full bg-bg-soft text-lg font-semibold text-ink active:scale-90 transition-transform"
          aria-label={`Decrease ${label}`}
        >
          –
        </button>
        <span className="w-6 text-center text-[15px] font-semibold text-num text-ink">{value}</span>
        <button
          type="button"
          onClick={() => {
            playTick("select");
            set(value + 1);
          }}
          className="tap-target flex size-8 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-ink active:scale-90 transition-transform"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
