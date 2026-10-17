"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/*
 * Landing page: a short, looping picture of Connect Claude at work. You ask,
 * Claude reads your tasks through Blueprint's tools, plans one into subtasks,
 * and the board on the right updates. Illustrative only: nothing is sent.
 */

const STEPS = [
  { kind: "you", text: "Go through my open Blueprint tasks and plan the launch email." },
  { kind: "tool", text: "list_tasks · Night shift · yours" },
  { kind: "tool", text: "get_task · Write the launch email" },
  { kind: "tool", text: "add_subtasks · 4 items" },
  { kind: "tool", text: "set_task_status · in progress" },
  { kind: "claude", text: "Done. I split the launch email into four subtasks and moved it to In progress. Want me to draft the subject lines next?" },
] as const;

const SUBTASKS = ["Pick the three headline features", "Draft the subject line", "Write the body copy", "Add the TestFlight link"];
const ease = [0.16, 1, 0.3, 1] as const;

export function ClaudeDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  // How far the story has got; the reduced-motion version shows the end state.
  const [step, setStep] = useState(reduce ? STEPS.length : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const delay = step === 0 ? 700 : step >= STEPS.length ? 4200 : STEPS[step - 1]?.kind === "tool" ? 650 : 1100;
    const t = window.setTimeout(() => setStep((s) => (s >= STEPS.length ? 0 : s + 1)), delay);
    return () => window.clearTimeout(t);
  }, [step, inView, reduce]);

  const planned = step >= 4;
  const moving = step >= 5;

  return (
    <div ref={ref} className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* The conversation */}
      <div className="card flex min-h-[340px] flex-col rounded-2xl p-4">
        <p className="flex items-center gap-2 text-[12px] text-ink-3">
          <span className="size-1.5 rounded-full bg-emerald" aria-hidden /> Claude · connected to Blueprint
        </p>
        <ol className="mt-3 flex flex-1 flex-col gap-2" aria-label="Example conversation">
          <AnimatePresence initial={false}>
            {STEPS.slice(0, step).map((s) => (
              <motion.li
                key={s.text}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease }}
                className={
                  s.kind === "you"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[13px] text-white"
                    : s.kind === "tool"
                      ? "flex items-center gap-2 self-start rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2 shadow-highlight"
                      : "max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink shadow-highlight"
                }
              >
                {s.kind === "tool" && (
                  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden className="shrink-0 text-emerald">
                    <path d="m2.5 6.3 2.3 2.2 4.7-5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {s.text}
              </motion.li>
            ))}
          </AnimatePresence>
          {!reduce && step > 0 && step < STEPS.length && STEPS[step]?.kind !== "you" && (
            <li aria-hidden className="flex gap-1 self-start px-1 pt-1">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-ink-3" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </li>
          )}
        </ol>
      </div>

      {/* The task, updating as Claude works */}
      <div className="card flex flex-col rounded-2xl p-4">
        <p className="text-[12px] text-ink-3">Night shift · your task</p>
        <motion.div layout className="mt-3 rounded-xl bg-surface-2 p-3 shadow-highlight">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-medium text-ink">Write the launch email</p>
            <motion.span
              key={moving ? "in" : "ready"}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={moving ? "shrink-0 rounded-md bg-amber/15 px-1.5 py-0.5 text-[10.5px] font-medium text-amber" : "shrink-0 rounded-md bg-tint/[0.08] px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3"}
            >
              {moving ? "In progress" : "Ready"}
            </motion.span>
          </div>
          <ul className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {planned &&
                SUBTASKS.map((t, i) => (
                  <motion.li
                    key={t}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease, delay: reduce ? 0 : i * 0.09 }}
                    className="flex items-center gap-2 text-[12.5px] text-ink-2"
                  >
                    <span className="size-3.5 shrink-0 rounded-[5px] border border-line-strong" aria-hidden />
                    {t}
                  </motion.li>
                ))}
            </AnimatePresence>
            {!planned && <li className="text-[12px] text-ink-3">No subtasks yet.</li>}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
            <span className="rounded bg-accent/12 px-1 py-px text-[10px] text-accent">via Claude</span> changes are yours, on the record
          </p>
        </motion.div>
        <ul className="mt-auto space-y-1.5 pt-4 text-[12px] text-ink-3">
          <li>✓ Only teams you pick, only what you can see</li>
          <li>✓ Owners switch it on per team</li>
          <li>✕ Never deletes or manages people</li>
        </ul>
      </div>
    </div>
  );
}
