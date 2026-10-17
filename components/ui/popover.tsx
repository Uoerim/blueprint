"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

/**
 * Minimal accessible popover used in place of native <select>: click-outside
 * and Escape close it, focus returns to the trigger.
 *
 * The menu is drawn at the top of the page (a portal) and placed next to its
 * trigger, so no card, scrolling list or dialog can clip or cover it. It opens
 * below the trigger, or above when there's no room, stays inside the screen,
 * and follows the trigger as the page scrolls.
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
  const menu = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);
  const id = useId();
  const triggerId = `${id}-trigger`;

  // Place the menu next to the trigger before it paints, and keep it there.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = root.current?.getBoundingClientRect();
      const m = menu.current;
      if (!t || !m) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = m.offsetWidth;
      const h = m.offsetHeight;
      const below = vh - t.bottom >= h + 12 || t.top < h + 12;
      const left = align === "end" ? t.right - w : t.left;
      m.style.left = `${Math.min(Math.max(8, left), vw - w - 8)}px`;
      m.style.top = `${below ? t.bottom + 6 : t.top - h - 6}px`;
      if (up === below) setUp(!below);
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, up]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    // Capture and stop Escape here, so it closes just the menu, not a dialog behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        document.getElementById(triggerId)?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, triggerId]);

  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus({ preventScroll: true });
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
          "inline-flex items-center rounded-md transition-colors hover:bg-tint/[0.06] active:scale-[0.97]",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menu}
                id={id}
                role="menu"
                initial={{ opacity: 0, y: up ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: up ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: `${align === "end" ? "right" : "left"} ${up ? "bottom" : "top"}` }}
                className={cx(
                  "glass-solid fixed left-0 top-0 z-[75] min-w-48 max-w-[calc(100vw-16px)] rounded-xl border border-line-strong p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
                  className,
                )}
              >
                {children(close)}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
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
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-tint/[0.07] hover:text-ink focus-visible:bg-tint/[0.07]",
        active && "text-ink bg-tint/[0.05]",
      )}
    >
      {children}
    </button>
  );
}
