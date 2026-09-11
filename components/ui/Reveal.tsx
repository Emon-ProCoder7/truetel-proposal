"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  staggerAmount?: number;
  delay?: number;
  y?: number;
  as?: "div" | "section";
};

/** Mount-triggered fade + rise (this is a single-page tool, not a scroll page). */
export default function Reveal({
  children,
  className,
  stagger = false,
  staggerAmount = 0.08,
  delay = 0,
  y = 18,
  as = "div",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = stagger ? Array.from(el.children) : el;
      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        delay,
        ease: "expo.out",
        stagger: stagger ? staggerAmount : 0,
      });
    },
    { scope: ref }
  );

  const Comp = as;
  return (
    <Comp ref={ref} className={className}>
      {children}
    </Comp>
  );
}
