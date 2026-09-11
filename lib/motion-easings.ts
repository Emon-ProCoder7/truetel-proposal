import type { Transition } from "motion/react";

export const ease = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  soft: [0.33, 1, 0.68, 1] as const,
};

/** Springs for anything a rep opens, taps, or drags. */
export const spring = {
  default: { type: "spring", bounce: 0, duration: 0.4 } satisfies Transition,
  snappy: { type: "spring", bounce: 0, duration: 0.3 } satisfies Transition,
  momentum: { type: "spring", bounce: 0.2, duration: 0.4 } satisfies Transition,
  card: { type: "spring", bounce: 0.35, duration: 0.5 } satisfies Transition,
};
