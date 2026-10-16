"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { btn, cx } from "@/components/ui/primitives";
import { useAppMode } from "@/lib/app-mode";

/*
 * A small guided-tour engine: one step at a time, it dims the page, cuts a
 * spotlight around the element marked data-tour="<target>" and shows a card
 * beside it (desktop) or along the bottom (phones, installed app included).
 *
 * The same marker can sit on several elements, e.g. the header team switcher
 * on the website and the tab bar in the app: the first one that's actually
 * visible wins, so each layout highlights what it really shows. A step whose
 * target isn't on screen falls back to a centred card, so a tour never breaks.
 */

export type TourStep = {
  id: string;
  /** data-tour marker of the element to spotlight; omit for a centred card. */
  target?: string;
  title: ReactNode;
  /** One body, or different words for the website and the installed app. */
  body: ReactNode | { web: ReactNode; app: ReactNode };
  /** Runs as the step opens, e.g. to switch to the view that holds the target. */
  before?: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const CARD_W = 344;

function visibleTarget(key: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const useNarrow = () =>
  useSyncExternalStore(subscribeNarrow, () => window.matchMedia("(max-width: 639px)").matches, () => false);

const isBodyPair = (b: TourStep["body"]): b is { web: ReactNode; app: ReactNode } =>
  !!b && typeof b === "object" && "web" in (b as object) && "app" in (b as object);

export function Tour({
  steps,
  label,
  finishLabel = "Done",
  onClose,
}: {
  steps: TourStep[];
  /** Accessible name for the whole tour, e.g. "Welcome tour". */
  label: string;
  finishLabel?: string;
  /** `finished` is true when they reached the end, false when they skipped. */
  onClose: (finished: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Which step's target has been looked for; until it matches, the card waits.
  const [located, setLocated] = useState(-1);
  const locating = located !== index;
  const still = useReducedMotion();
  const narrow = useNarrow();
  const app = useAppMode();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const ids = useId();
  const step = steps[index]!;
  const last = index === steps.length - 1;

  // Remember where focus was, and give it back when the tour closes.
  useEffect(() => {
    returnFocus.current = document.activeElement;
    return () => (returnFocus.current as HTMLElement | null)?.focus?.();
  }, []);

  // Open the step: run its setup, find its target (waiting briefly for views
  // to switch), scroll it into view, then follow it every frame.
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let el: HTMLElement | null = null;
    step.before?.();

    const follow = () => {
      if (cancelled) return;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      }
      frame = requestAnimationFrame(follow);
    };

    const started = performance.now();
    const locate = () => {
      if (cancelled) return;
      el = step.target ? visibleTarget(step.target) : null;
      if (!el && step.target && performance.now() - started < 1200) {
        frame = requestAnimationFrame(locate);
        return;
      }
      if (el) {
        // Fixed elements (like the app's tab bar) don't need scrolling.
        if (getComputedStyle(el).position !== "fixed") el.scrollIntoView({ block: "center", inline: "nearest", behavior: still ? "auto" : "smooth" });
        follow();
      } else {
        setRect(null);
      }
      setLocated(index);
    };
    frame = requestAnimationFrame(locate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // Only re-run when the step changes; `still` is read once per step on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Keep keyboard focus on the card as steps change.
  useEffect(() => {
    if (!locating) primaryRef.current?.focus({ preventScroll: true });
  }, [locating, index]);

  const next = useCallback(() => (last ? onClose(true) : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Esc skips; arrows move; Tab stays inside the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Tab" && cardRef.current) {
        const focusables = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!focusables.length) return;
        const first = focusables[0]!;
        const lastEl = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  const body = isBodyPair(step.body) ? (app ? step.body.app : step.body.web) : step.body;
  const hole = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Where the card goes: centred without a target, along the bottom on phones,
  // otherwise under the target (or above it when there's no room below).
  let cardStyle: CSSProperties = {};
  let placement: "center" | "sheet" | "float" = "center";
  if (hole && narrow) placement = "sheet";
  else if (hole) {
    placement = "float";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(16, hole.left + hole.width / 2 - CARD_W / 2), vw - CARD_W - 16);
    const below = vh - (hole.top + hole.height) > 260;
    cardStyle = below ? { top: hole.top + hole.height + 14, left } : { bottom: vh - hole.top + 14, left };
  }

  const transition = still ? { duration: 0 } : { type: "spring" as const, stiffness: 560, damping: 46 };

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-hidden={false}>
      {/* Click shield: the page underneath is for looking at during the tour. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* The dim layer with a spotlight hole (a huge shadow around a transparent box). */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl"
        initial={false}
        animate={
          hole
            ? { top: hole.top, left: hole.left, width: hole.width, height: hole.height, opacity: 1 }
            : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, opacity: 1 }
        }
        transition={transition}
        style={{
          boxShadow: hole
            ? "0 0 0 2px var(--accent), 0 0 0 6px color-mix(in oklab, var(--accent) 22%, transparent), 0 0 0 9999px rgba(5,5,8,0.66)"
            : "0 0 0 9999px rgba(5,5,8,0.66)",
        }}
      />

      <div
        className={cx(
          "pointer-events-none absolute inset-0",
          placement === "center" && "grid place-items-center p-4",
        )}
      >
        <AnimatePresence mode="wait">
          {!locating && (
            <motion.div
              key={step.id}
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              aria-describedby={`${ids}-body`}
              initial={still ? false : { opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
              transition={still ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={placement === "float" ? { ...cardStyle, width: CARD_W } : undefined}
              className={cx(
                "glass-solid pointer-events-auto rounded-2xl border border-line-strong p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]",
                placement === "float" && "absolute",
                placement === "center" && "w-full max-w-[400px]",
                placement === "sheet" &&
                  cx(
                    "absolute inset-x-3 mx-auto max-w-md",
                    app ? "bottom-[calc(6.25rem+env(safe-area-inset-bottom))]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
                  ),
              )}
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {index + 1} of {steps.length}
              </p>
              <h2 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">{step.title}</h2>
              <div id={`${ids}-body`} className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                {body}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="flex gap-1.5" aria-hidden>
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={cx("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-accent" : i < index ? "w-1.5 bg-ink-3" : "w-1.5 bg-tint/15")}
                    />
                  ))}
                </span>
                <span className="flex-1" />
                {!last && (
                  <button type="button" onClick={() => onClose(false)} className={cx(btn.ghost, btn.sm, "text-ink-3")}>
                    Skip
                  </button>
                )}
                {index > 0 && (
                  <button type="button" onClick={back} className={cx(btn.outline, btn.sm)}>
                    Back
                  </button>
                )}
                <button ref={primaryRef} type="button" onClick={next} className={cx(btn.primary, btn.sm)}>
                  {last ? finishLabel : "Next"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
