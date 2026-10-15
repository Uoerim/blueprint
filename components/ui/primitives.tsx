import type { CSSProperties, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none";

export const btn = {
  primary: cx(base, "h-10 px-4 bg-ink text-bg hover:bg-ink/85"),
  accent: cx(base, "h-10 px-4 bg-accent text-white hover:bg-accent/85"),
  ghost: cx(base, "h-10 px-4 text-ink-2 hover:text-ink hover:bg-tint/[0.06]"),
  outline: cx(base, "h-10 px-4 text-ink bg-surface-2 shadow-highlight hover:bg-surface-3"),
  sm: "!h-8 !px-3 !text-[13px]",
  xs: "!h-7 !px-2.5 !text-xs !rounded-md",
};

/** Pushes an accent toward the ink side of the theme (white on dark, black on light) so small username text stays legible. */
export const readable = (c?: string | null) => (c ? `color-mix(in oklab, ${c} 74%, var(--readable-mix))` : undefined);

export function initials(name: string) {
  const clean = name.replace(/^@/, "").replace(/_/g, " ").trim();
  const parts = clean.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

/** Geometric monogram badge in the person's accent colour (no photos, ever). */
export function Monogram({
  name,
  color,
  size = 28,
  className,
  title,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    color,
    backgroundColor: `${color}1f`,
    boxShadow: `inset 0 0 0 1px ${color}55`,
    fontSize: Math.max(10, Math.round(size * 0.38)),
  };
  return (
    <span
      title={title ?? name}
      aria-hidden={title ? undefined : true}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[28%] font-semibold tracking-tight",
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}

export function Handle({ username, color, className }: { username: string; color?: string; className?: string }) {
  return (
    <span className={cx("font-mono text-xs tracking-wide", className)} style={color ? { color } : undefined}>
      @{username}
    </span>
  );
}

export function Pill({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx("inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[11px] tracking-wide", className)}
      style={
        color
          ? { color, backgroundColor: `${color}17`, boxShadow: `inset 0 0 0 1px ${color}33` }
          : { color: "var(--ink-2)", backgroundColor: "color-mix(in oklab, var(--tint) 5%, transparent)" }
      }
    >
      {children}
    </span>
  );
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.75" y="6.75" width="14.5" height="14.5" rx="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 16 L18.5 5.5" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.5 5.25h6.25v6.25" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const TAG_COLORS: Record<string, string> = {
  feature: "#6366F1",
  bug: "#F43F5E",
  experiment: "#06B6D4",
  random: "#F59E0B",
};

export const PRIORITY_COLORS = { LOW: "#8A8A94", MEDIUM: "#F59E0B", HIGH: "#F43F5E" } as const;
