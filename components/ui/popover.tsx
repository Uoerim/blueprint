"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./primitives";

/**
 * Minimal accessible popover used in place of native <select>: click-outside
 * and Escape close it, focus returns to the trigger.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  label,
  className,
  triggerClassName,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  label: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const triggerId = `${id}-trigger`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById(triggerId)?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, triggerId]);

  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  return (
    <div ref={root} className="relative inline-flex">
      <button
        id={triggerId}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex items-center rounded-md transition-colors hover:bg-white/[0.06] active:scale-[0.97]",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={cx(
              "glass-solid absolute top-full z-50 mt-1.5 min-w-48 rounded-xl border border-line-strong p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
              align === "end" ? "right-0" : "left-0",
              className,
            )}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  active,
}: {
  children: ReactNode;
  onSelect: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink focus-visible:bg-white/[0.07]",
        active && "text-ink bg-white/[0.05]",
      )}
    >
      {children}
    </button>
  );
}
