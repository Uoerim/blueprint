"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

/** Modal dialog with focus trap-lite, Escape to close and scroll lock. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  side = "center",
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: "center" | "right";
  /** Centre dialogs only: sm (448px), md (512px, default) or lg (672px, taller). */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>("[autofocus], input, textarea, button")?.focus();
    }, 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cx("fixed inset-0 z-[60] flex", side === "center" ? cx("items-start justify-center p-4", size === "lg" ? "pt-[6vh]" : "pt-[12vh]") : "justify-end")}>
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={side === "center" ? { opacity: 0, y: 12, scale: 0.98 } : { x: "100%" }}
            animate={side === "center" ? { opacity: 1, y: 0, scale: 1 } : { x: 0 }}
            exit={side === "center" ? { opacity: 0, y: 8, scale: 0.98 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className={cx(
              "glass-solid relative flex flex-col border-line-strong shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]",
              side === "center"
                ? cx("w-full rounded-2xl border", size === "lg" ? "max-h-[86vh] max-w-2xl" : size === "sm" ? "max-h-[84vh] max-w-md" : "max-h-[76vh] max-w-lg")
                : "h-full w-full max-w-xl border-l",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-tint/[0.06] hover:text-ink active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1.5 text-[13px] text-ink-3">{hint}</div>}
    </div>
  );
}

export const inputCls = "field w-full rounded-lg px-3 text-sm text-ink placeholder:text-ink-3";
