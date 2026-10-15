"use client";

import { useId, useState } from "react";
import { cx } from "./primitives";

export const PRESET_COLORS = ["#8B5CF6", "#6366F1", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#EC4899", "#64748B"] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Pick any colour: quick presets, a rainbow swatch that opens the device's
 * full colour spectrum (native picker on desktop, iOS and Android), or type a
 * hex code. Always reports a lowercase #rrggbb value.
 */
export function ColorPicker({ value, onChange, label = "Colour" }: { value: string; onChange: (hex: string) => void; label?: string }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // Keep the hex box in step when the colour changes from a swatch or the spectrum.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const custom = !PRESET_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
  const pick = (hex: string) => onChange(hex.toLowerCase());

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          aria-pressed={c.toLowerCase() === value.toLowerCase()}
          onClick={() => pick(c)}
          className={cx(
            "size-7 rounded-full transition-transform active:scale-90 sm:size-6",
            c.toLowerCase() === value.toLowerCase() && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <label
        htmlFor={`${id}-spectrum`}
        title="Any colour"
        className={cx(
          "relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full transition-transform active:scale-90 sm:size-6",
          custom && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]",
        )}
        style={{ background: "conic-gradient(#f43f5e, #f59e0b, #eab308, #10b981, #06b6d4, #6366f1, #8b5cf6, #ec4899, #f43f5e)" }}
      >
        {custom && <span className="size-3 rounded-full ring-2 ring-white/80" style={{ backgroundColor: value }} aria-hidden />}
        <span className="sr-only">Pick any colour from the full spectrum</span>
        <input
          id={`${id}-spectrum`}
          type="color"
          value={HEX.test(value) ? value : "#8b5cf6"}
          onChange={(e) => pick(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value.trim();
          const hex = v.startsWith("#") ? v : `#${v}`;
          setDraft(hex.slice(0, 7));
          if (HEX.test(hex)) pick(hex);
        }}
        onBlur={() => setDraft(value)}
        maxLength={7}
        spellCheck={false}
        aria-label="Hex colour"
        className="field h-8 w-[5.5rem] rounded-lg px-2 font-mono text-[13px] uppercase text-ink"
      />
    </div>
  );
}
