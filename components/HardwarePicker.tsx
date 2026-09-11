"use client";

import Image from "next/image";
import GlassCard from "@/components/GlassCard";
import { playTick } from "@/lib/sound";
import { HARDWARE_DB, HARDWARE_GROUP_ORDER, HARDWARE_SLOTS, type HardwareSelection } from "@/lib/hardware";

type Props = {
  value: HardwareSelection;
  onChange: (v: HardwareSelection) => void;
};

/**
 * Five slots mirroring the real CloudPhone template's Hardware Ecosystem
 * page (one hero handset, two secondary, two accessory/network) — except
 * each slot now carries its own quantity, so the photo shown here and the
 * price billed in the Investment Summary are always the same item.
 */
export default function HardwarePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {HARDWARE_SLOTS.map((slot) => {
        const line = value[slot.id];
        const item = line.itemId ? HARDWARE_DB[line.itemId] : null;
        const options = HARDWARE_GROUP_ORDER.filter((g) => slot.groups.includes(g)).flatMap((g) =>
          Object.values(HARDWARE_DB).filter((i) => i.group === g)
        );

        return (
          <GlassCard as="div" key={slot.id} className="!p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{slot.label}</span>
              <select
                id={`hw-${slot.id}`}
                value={line.itemId ?? ""}
                onChange={(e) => {
                  playTick("select");
                  const itemId = e.target.value || null;
                  onChange({ ...value, [slot.id]: { itemId, qty: itemId ? Math.max(1, line.qty) : 0 } });
                }}
                className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-xs font-medium text-ink"
              >
                <option value="">None</option>
                {HARDWARE_GROUP_ORDER.filter((g) => slot.groups.includes(g)).map((g) => (
                  <optgroup key={g} label={g}>
                    {options
                      .filter((i) => i.group === g)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {item && (
              <div className="mt-3 flex gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-soft">
                  <Image src={item.img} alt={item.title} width={64} height={64} className="object-contain" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="truncate text-xs text-ink-faint">{item.subtitle}</p>
                  <p className="mt-1 text-xs font-semibold text-accent-ink">${item.unitPriceExGst}/mo each</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playTick("select");
                      onChange({ ...value, [slot.id]: { itemId: line.itemId, qty: Math.max(0, line.qty - 1) } });
                    }}
                    className="tap-target flex size-7 items-center justify-center rounded-full bg-bg-soft text-sm font-semibold text-ink active:scale-90"
                    aria-label={`Decrease ${item.title} quantity`}
                  >
                    –
                  </button>
                  <span className="w-5 text-center text-sm font-semibold text-num text-ink">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => {
                      playTick("select");
                      onChange({ ...value, [slot.id]: { itemId: line.itemId, qty: line.qty + 1 } });
                    }}
                    className="tap-target flex size-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink active:scale-90"
                    aria-label={`Increase ${item.title} quantity`}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
