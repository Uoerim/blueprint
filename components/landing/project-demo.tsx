"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { cx, Monogram, readable } from "@/components/ui/primitives";

type Col = "Ready" | "In progress" | "Done";
type Card = { id: number; title: string; who: string; color: string; col: Col; notes?: boolean };

const START: Card[] = [
  { id: 1, title: "Read accelerometer at 60Hz", who: "linus_k", color: "#F59E0B", col: "Done" },
  { id: 2, title: "Map tilt to tempo curve", who: "grace", color: "#F43F5E", col: "In progress", notes: true },
  { id: 3, title: "Octave spread on tilt", who: "ada", color: "#10B981", col: "Ready" },
  { id: 4, title: "TestFlight build for the four of us", who: "mo", color: "#06B6D4", col: "Ready", notes: true },
];
const COLS: Col[] = ["Ready", "In progress", "Done"];
const NEXT: Record<Col, Col> = { Ready: "In progress", "In progress": "Done", Done: "Ready" };

/** A working replica of one project page: click a card to move it along. */
export function ProjectDemo() {
  const [cards, setCards] = useState(START);
  const [draft, setDraft] = useState("");
  const done = cards.filter((c) => c.col === "Done").length;
  const pct = Math.round((done / cards.length) * 100);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    setCards((cs) => [...cs, { id: Date.now(), title: t.slice(0, 60), who: "you", color: "#8B5CF6", col: "Ready" }]);
  };

  return (
    <div data-ui className="card overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-line p-4 sm:grid-cols-[1.3fr_1fr] sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3"><span className="text-violet">◆</span> Project</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Tilt arpeggiator</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">An arpeggiator that follows the phone&apos;s tilt. Done when all four of us can jam with it on TestFlight.</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint/[0.07]">
              <motion.span className="block h-full rounded-full bg-emerald" animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
            </span>
            <span className="font-mono text-[12px] tabular-nums text-ink-3">{done}/{cards.length} done</span>
          </div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="flex items-baseline justify-between text-[12px] font-medium text-ink-2">
            Subtasks <span className="font-mono font-normal text-ink-3">2/3</span>
          </p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-2">
            {[
              ["Read accelerometer", true],
              ["Fit the tempo curve", true],
              ["Tune it with @mo", false],
            ].map(([t, done]) => (
              <li key={String(t)} className="flex items-center gap-2">
                <span className={cx("grid size-3.5 shrink-0 place-items-center rounded border", done ? "border-emerald bg-emerald" : "border-line-strong")} aria-hidden />
                <span className={cx(done && "text-ink-3 line-through")}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LayoutGroup>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 p-3 sm:grid-cols-3">
          {COLS.map((col) => (
            <section key={col} aria-label={col} className="min-h-28 rounded-xl bg-surface-2/60 p-2">
              <p className="flex items-center justify-between px-1 pb-1.5 text-[12px] font-medium text-ink-2">
                {col} <span className="font-mono text-ink-3">{cards.filter((c) => c.col === col).length}</span>
              </p>
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {cards.filter((c) => c.col === col).map((c) => (
                    <motion.li key={c.id} layout layoutId={`demo-${c.id}`} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
                      <button
                        type="button"
                        onClick={() => setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, col: NEXT[x.col] } : x)))}
                        aria-label={`${c.title}: move to ${NEXT[c.col]}`}
                        className="w-full rounded-lg bg-surface p-2.5 text-left shadow-highlight transition-[background-color,transform] hover:bg-surface-3 active:scale-[0.98]"
                      >
                        <span className={cx("block text-[12.5px] leading-snug", c.col === "Done" ? "text-ink-3 line-through" : "text-ink")}>{c.title}</span>
                        <span className="mt-1.5 flex items-center gap-1.5">
                          <Monogram name={c.who} color={c.color} size={16} />
                          <span className="font-mono text-[10.5px]" style={{ color: readable(c.color) }}>@{c.who}</span>
                          {c.notes && <span className="ml-auto text-[10.5px] text-ink-3">2/3</span>}
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      </LayoutGroup>

      <form onSubmit={add} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={60}
          aria-label="Add a task to this project"
          placeholder="+ Add a task to this project"
          className="field h-9 min-w-0 flex-1 rounded-lg px-3 text-[13px] text-ink placeholder:text-ink-3"
        />
        <button type="submit" disabled={!draft.trim()} className="h-9 shrink-0 rounded-lg bg-surface-2 px-3 text-[13px] font-medium text-ink shadow-highlight transition-colors hover:bg-surface-3 disabled:opacity-50">
          Add
        </button>
      </form>
    </div>
  );
}
