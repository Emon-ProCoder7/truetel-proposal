"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

type Props = {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
};

/** Animates to a new value whenever `value` changes — used for live price totals. */
export default function CountUp({ value, prefix = "$", decimals = 2, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const obj = { n: prev.current };
      gsap.to(obj, {
        n: value,
        duration: 0.6,
        ease: "expo.out",
        onUpdate: () => {
          el.textContent = `${prefix}${obj.n.toLocaleString("en-AU", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}`;
        },
        onComplete: () => {
          prev.current = value;
        },
      });
    },
    { dependencies: [value] }
  );

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
