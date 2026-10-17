"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useAppMode } from "@/lib/app-mode";
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
  const sheet = useAppMode();
  const sheetRef = useRef(sheet);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);
  const drag = useDragControls();
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
    // Move focus into the dialog without scrolling the page behind it. Bottom sheets focus
    // themselves rather than a text field, so a phone keyboard doesn't jump up uninvited.
    const t = window.setTimeout(() => {
      const target = sheetRef.current
        ? panel.current
        : panel.current?.querySelector<HTMLElement>("[autofocus], input, textarea, button") ?? panel.current;
      target?.focus({ preventScroll: true });
    }, 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      restore.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  // In the installed phone app every centred dialog becomes a bottom sheet.
  if (sheet && side === "center") {
    return createPortal(
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex items-end">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              aria-hidden
            />
            <motion.div
              ref={panel}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) onClose();
              }}
              className={cx(
                "glass-solid relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border-t border-line-strong pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]",
                className?.replace(/max-w-\S+|max-h-\S+/g, ""),
              )}
            >
              {/* Grab the handle or the title to swipe the sheet down. */}
              <div className="touch-none" onPointerDown={(e) => drag.start(e)}>
                <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-tint/20" aria-hidden />
                <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                    {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="grid size-10 place-items-center rounded-full bg-tint/[0.06] text-ink-2 active:scale-95"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                      <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  }

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
              tabIndex={-1}
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
                ? cx("w-full rounded-2xl border", size === "lg" ? "max-h-[86dvh] max-w-2xl" : size === "sm" ? "max-h-[84dvh] max-w-md" : "max-h-[76dvh] max-w-lg")
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
