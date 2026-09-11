import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(inputs.filter(Boolean).join(" "));
}

export function formatAUD(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}
