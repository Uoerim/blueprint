"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const OPTIONS: { id: Theme; label: string; note: string }[] = [
  { id: "dark", label: "Dark", note: "The default" },
  { id: "light", label: "Light", note: "Easy in daylight" },
  { id: "system", label: "System", note: "Follows your device" },
];

/** Swatch drawn with fixed colours so each option previews its own theme. */
function Swatch({ id }: { id: Theme }) {
  const half = (bg: string, card: string, ink: string) => (
    <span className="flex h-full flex-1 flex-col gap-1.5 p-2" style={{ backgroundColor: bg }}>
      <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: ink }} />
      <span className="flex-1 rounded-md" style={{ backgroundColor: card }} />
    </span>
  );
  const dark = half("#09090b", "#18181c", "#fafafa");
  const light = half("#f7f7f5", "#ffffff", "#0b0b0d");
  return (
    <span className="flex h-20 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--line-strong)]">
      {id === "dark" ? dark : id === "light" ? light : <>{light}{dark}</>}
    </span>
  );
}

/** Repaints immediately and remembers the choice for a year (the server reads it on the next load). */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.dataset.theme = t;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  window.document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax${secure}`;
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  const pick = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const on = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(o.id)}
            className={cx(
              "rounded-xl p-2.5 text-left transition-[box-shadow,transform] active:scale-[0.98]",
              on ? "bg-surface-2 shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-surface-2 shadow-highlight hover:bg-surface-3",
            )}
          >
            <Swatch id={o.id} />
            <span className="mt-2.5 flex items-center justify-between px-0.5">
              <span className="text-[14px] font-medium text-ink">{o.label}</span>
              <span className={cx("size-4 rounded-full", on ? "border-[5px] border-accent" : "border border-line-strong")} aria-hidden />
            </span>
            <span className="block px-0.5 text-[12px] text-ink-3">{o.note}</span>
          </button>
        );
      })}
    </div>
  );
}
