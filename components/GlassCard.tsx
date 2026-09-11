"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion-easings";
import { cn } from "@/lib/utils";
import { playTick } from "@/lib/sound";

type Props = {
  children: ReactNode;
  selected?: boolean;
  dark?: boolean;
  onClick?: () => void;
  className?: string;
  sheen?: boolean;
  disabled?: boolean;
  as?: "button" | "div";
};

/**
 * The tappable glass card used for every choice in the wizard — deal shape,
 * tier, discovery answers, quantity steppers. Backdrop-filter glass (see
 * globals.css .glass-surface) + a spring press so it feels alive on a phone,
 * plus a soft synthesized tick so selecting a tier feels deliberate rather
 * than silent.
 */
export default function GlassCard({
  children,
  selected = false,
  dark = false,
  onClick,
  className,
  sheen = false,
  disabled = false,
  as = "button",
}: Props) {
  const handleClick = () => {
    if (disabled) return;
    playTick(selected ? "select" : "select");
    onClick?.();
  };

  const cls = cn(
    "glass-surface tap-target relative w-full text-left p-4 sm:p-5",
    dark && "dark",
    selected && "selected",
    disabled && "opacity-50 pointer-events-none",
    className
  );

  const content = (
    <>
      {sheen && <span className="glass-sheen" aria-hidden />}
      <span className="relative z-10 block">{children}</span>
    </>
  );

  if (as === "div") {
    return <div className={cls}>{content}</div>;
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      whileHover={disabled ? undefined : { y: -2 }}
      transition={spring.card}
      className={cls}
      aria-pressed={selected}
    >
      {content}
    </motion.button>
  );
}
