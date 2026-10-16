import type { ReactNode } from "react";
import { cx } from "./primitives";

/** A placeholder block shown while a screen's data is on its way. */
export function Bone({ className }: { className?: string }) {
  // cx() doesn't merge classes, so only fall back to rounded-xl when no rounding is given.
  return <div aria-hidden className={cx("animate-pulse bg-surface-2", !/rounded/.test(className ?? "") && "rounded-xl", className)} />;
}

/** Wraps a loading screen so screen readers hear one short status instead of empty boxes. */
export function LoadingScreen({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
