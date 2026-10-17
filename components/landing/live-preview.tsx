"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";

type Person = { handle: string; color: string };
type Idea = { id: string; title: string; by: string; sparks: number; sparked: boolean };
type Task = { id: string; title: string; idea: string; who: string | null; status: "ready" | "progress" | "done" };

const PEOPLE: Record<string, Person> = {
  you: { handle: "you", color: "#6366F1" },
  grace: { handle: "grace", color: "#F43F5E" },
  linus_k: { handle: "linus_k", color: "#F59E0B" },
  mo: { handle: "mo", color: "#06B6D4" },
};
const TEAMMATES = ["grace", "linus_k", "mo"];

const BREAKDOWN: Record<string, string[]> = {
  i1: ["Read accelerometer at 60Hz", "Map tilt to tempo curve", "Octave spread on sideways tilt"],
  i2: ["Encode loop as a URL fragment", "Landing page for shared loops"],
  i3: ["Fix audio session on lock", "Regression test on an old iPhone"],
};

const INITIAL_IDEAS: Idea[] = [
  { id: "i1", title: "Arpeggiator that follows the phone's tilt", by: "linus_k", sparks: 3, sparked: false },
  { id: "i2", title: "Share a loop as a 10-second link", by: "grace", sparks: 2, sparked: false },
  { id: "i3", title: "Audio glitches when the screen locks", by: "mo", sparks: 1, sparked: false },
];

const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "Prototype haptic tick patterns", idea: "Haptic downbeat", who: "grace", status: "progress" },
  { id: "t2", title: "Sync haptics to the BPM clock", idea: "Haptic downbeat", who: null, status: "ready" },
];

let seq = 100;
const uid = (p: string) => `${p}${++seq}`;
const spring = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } as const;

const cleanTitle = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, 80);

export function LivePreview() {
  const reduce = useReducedMotion();
  const [ideas, setIdeas] = useState(INITIAL_IDEAS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [shipped, setShipped] = useState(27);
  const [lastShipped, setLastShipped] = useState<{ title: string; who: string } | null>({ title: "TestFlight build for the squad", who: "mo" });
  const [striking, setStriking] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [event, setEvent] = useState("@grace started focus on “Prototype haptic tick patterns”");
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useRef({ ideas, tasks });
  useEffect(() => {
    state.current = { ideas, tasks };
  }, [ideas, tasks]);

  const finish = useCallback(
    (id: string) => {
      const t = state.current.tasks.find((x) => x.id === id);
      if (!t) return;
      setStriking(id);
      window.setTimeout(
        () => {
          setTasks((ts) => ts.filter((x) => x.id !== id));
          setShipped((n) => n + 1);
          setLastShipped({ title: t.title, who: t.who ?? "you" });
          setStriking(null);
        },
        reduce ? 0 : 650,
      );
    },
    [reduce],
  );

  // Teammates keep working while you watch.
  useEffect(() => {
    const tick = () => {
      const { ideas: is, tasks: ts } = state.current;
      const roll = Math.random();
      const focusing = new Set(ts.filter((t) => t.status === "progress").map((t) => t.who));
      const idle = TEAMMATES.filter((p) => !focusing.has(p));
      const theirs = ts.filter((t) => t.status === "progress" && t.who && t.who !== "you");
      const open = ts.filter((t) => t.status === "ready" && !t.who);

      if (roll < 0.34 && open.length && idle.length) {
        const who = idle[Math.floor(Math.random() * idle.length)]!;
        const t = open[0]!;
        setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, who, status: "progress" } : x)));
        setEvent(`@${who} started focus on “${t.title}”`);
      } else if (roll < 0.62 && theirs.length > 1) {
        const t = theirs[0]!;
        finish(t.id);
        setEvent(`@${t.who} shipped “${t.title}”`);
      } else if (is.length) {
        const idea = is[Math.floor(Math.random() * is.length)]!;
        const who = TEAMMATES[Math.floor(Math.random() * TEAMMATES.length)]!;
        setIdeas((all) => all.map((x) => (x.id === idea.id ? { ...x, sparks: x.sparks + 1 } : x)));
        setFlash(idea.id);
        window.setTimeout(() => setFlash(null), 900);
        setEvent(`@${who} sparked “${idea.title}”`);
      }
    };
    const id = window.setInterval(tick, 4200);
    return () => window.clearInterval(id);
  }, [finish]);

  const promote = (idea: Idea) => {
    const titles = BREAKDOWN[idea.id] ?? [`Scope “${idea.title.slice(0, 32)}”`, "Build the first pass", "Ship it to the squad"];
    setIdeas((all) => all.filter((x) => x.id !== idea.id));
    setTasks((all) => [...titles.map((title) => ({ id: uid("t"), title, idea: idea.title, who: null, status: "ready" as const })), ...all]);
    setEvent(`You promoted “${idea.title}” into ${titles.length} tasks`);
  };

  const startFocus = (t: Task) => {
    setTasks((all) =>
      all.map((x) =>
        x.id === t.id ? { ...x, who: "you", status: "progress" } : x.who === "you" && x.status === "progress" ? { ...x, status: "ready" } : x,
      ),
    );
    setEvent(`You started focus on “${t.title}”`);
  };

  const spark = (idea: Idea) =>
    setIdeas((all) =>
      all.map((x) => (x.id === idea.id ? { ...x, sparked: !x.sparked, sparks: x.sparks + (x.sparked ? -1 : 1) } : x)),
    );

  const capture = (e: FormEvent) => {
    e.preventDefault();
    const title = cleanTitle(draft);
    if (!title) return;
    setIdeas((all) => [{ id: uid("i"), title, by: "you", sparks: 0, sparked: false }, ...all].slice(0, 5));
    setDraft("");
    setEvent(`You dropped “${title}” into the vault`);
  };

  const inFocus = tasks.filter((t) => t.status === "progress" && t.who);
  const ready = tasks.filter((t) => t.status === "ready");

  return (
    <div data-ui className="card overflow-hidden rounded-2xl text-left">
      <LayoutGroup>
        {/* Live focus dock */}
        <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
          <span className="relative flex size-2 shrink-0 text-emerald">
            <span className="pulse-ring relative size-2 rounded-full bg-emerald" />
          </span>
          <span className="shrink-0 text-[13px] font-medium text-ink">Live focus</span>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
            <AnimatePresence initial={false}>
              {inFocus.map((t) => {
                const p = PEOPLE[t.who!]!;
                return (
                  <motion.div
                    layout
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={spring}
                    className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2.5"
                    style={{ backgroundColor: `${p.color}14`, boxShadow: `inset 0 0 0 1px ${p.color}40, 0 0 18px -6px ${p.color}90` }}
                  >
                    <Monogram name={p.handle} color={p.color} size={22} />
                    <span className="font-mono text-[11px]" style={{ color: readable(p.color) }}>@{p.handle}</span>
                    <span className="max-w-44 truncate text-xs text-ink-2">{t.title}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {!inFocus.length && <span className="text-xs text-ink-3">Nobody in focus right now</span>}
          </div>
          <span className="hidden shrink-0 font-mono text-[11px] text-ink-3 sm:inline">night-shift</span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[1.1fr_1fr]">
          {/* Vault */}
          <section aria-label="Idea vault" className="border-line p-4 md:border-r">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[13px] font-medium text-ink">Idea vault</h3>
              <span className="font-mono text-[11px] text-ink-3">{ideas.length} raw</span>
            </div>
            <form onSubmit={capture} className="mb-3 flex items-center gap-2 rounded-lg bg-bg px-3 shadow-[inset_0_0_0_1px_var(--line-strong)] focus-within:shadow-[inset_0_0_0_1px_var(--accent)]">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={100}
                placeholder="Dump an idea…"
                aria-label="Capture an idea"
                className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <button type="submit" disabled={!draft.trim()} className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-ink-2 transition-colors hover:bg-tint/[0.06] hover:text-ink disabled:opacity-40">Add</button>
            </form>
            <ul className="space-y-2">
              <AnimatePresence initial={false} mode="popLayout">
                {ideas.map((idea) => {
                  const p = PEOPLE[idea.by]!;
                  return (
                    <motion.li
                      layout
                      key={idea.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.22 } }}
                      transition={spring}
                      className="group rounded-xl bg-surface-2 p-3 shadow-highlight transition-colors hover:bg-surface-3"
                    >
                      <p className="text-[13.5px] leading-snug text-ink">{idea.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px]" style={{ color: readable(p.color) }}>@{p.handle}</span>
                        <span className="flex-1" />
                        <motion.button
                          type="button"
                          onClick={() => spark(idea)}
                          whileTap={{ scale: 0.88 }}
                          aria-pressed={idea.sparked}
                          aria-label={`Spark this idea, ${idea.sparks} sparks`}
                          className={cx(
                            "inline-flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[11px] transition-colors",
                            idea.sparked ? "bg-amber/15 text-amber" : "text-ink-3 hover:bg-tint/[0.06] hover:text-ink",
                            flash === idea.id && "text-amber",
                          )}
                        >
                          <SparkIcon /> {idea.sparks}
                        </motion.button>
                        <button type="button" onClick={() => promote(idea)} className={cx(btn.outline, btn.xs)}>
                          Promote idea →
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {!ideas.length && <li className="py-6 text-center text-xs text-ink-3">Vault&apos;s empty. Dump something above.</li>}
            </ul>
          </section>

          {/* Execution */}
          <section aria-label="Execution" className="flex flex-col border-t border-line p-4 md:border-t-0">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[13px] font-medium text-ink">Execution</h3>
              <span className="font-mono text-[11px] text-ink-3">{ready.length} ready · {inFocus.length} in focus</span>
            </div>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {tasks.map((t) => {
                  const p = t.who ? PEOPLE[t.who]! : null;
                  const mine = t.who === "you";
                  return (
                    <motion.li
                      layout
                      key={t.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                      transition={spring}
                      className="flex items-center gap-2.5 rounded-lg bg-surface-2/70 px-2.5 py-2"
                      style={t.status === "progress" && p ? { boxShadow: `inset 2px 0 0 ${p.color}` } : undefined}
                    >
                      {p ? <Monogram name={p.handle} color={p.color} size={20} /> : <span className="size-5 shrink-0 rounded-[28%] border border-dashed border-ink-3/50" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <span className="relative inline-block max-w-full">
                          <span className={cx("block truncate text-[13px]", striking === t.id ? "text-ink-3" : "text-ink")}>{t.title}</span>
                          {striking === t.id && (
                            <svg className="pointer-events-none absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 4" aria-hidden>
                              <motion.path d="M0 2 Q 50 0.5 100 2" stroke="#10B981" strokeWidth="1.6" fill="none" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
                            </svg>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[10.5px] text-ink-3">from {t.idea}</span>
                      </div>
                      {t.status === "ready" && (
                        <button type="button" onClick={() => startFocus(t)} className={cx(btn.outline, btn.xs)}>
                          Start focus
                        </button>
                      )}
                      {t.status === "progress" && mine && (
                        <button type="button" onClick={() => finish(t.id)} disabled={striking === t.id} className={cx(btn.accent, btn.xs)}>
                          Mark done
                        </button>
                      )}
                      {t.status === "progress" && !mine && p && (
                        <span className="font-mono text-[11px]" style={{ color: readable(p.color) }}>focusing</span>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <div className="mt-auto pt-4">
              <div className="flex items-center justify-between rounded-lg bg-emerald/10 px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block text-[13px] text-ink">Shipped</span>
                  {lastShipped && (
                    <span className="block truncate font-mono text-[10.5px] text-ink-3">
                      last: @{lastShipped.who} · {lastShipped.title}
                    </span>
                  )}
                </div>
                <motion.span key={shipped} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="text-2xl font-semibold tabular-nums text-emerald">
                  {shipped}
                </motion.span>
              </div>
            </div>
          </section>
        </div>
      </LayoutGroup>
      <p aria-live="polite" className="truncate border-t border-line px-4 py-2 font-mono text-[11px] text-ink-3">
        {event}
      </p>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}
