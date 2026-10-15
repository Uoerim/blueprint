"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx, Monogram, readable } from "@/components/ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;

/* ── Card 1: @username squad invites ────────────────────────────────────── */

const DIRECTORY = [
  { handle: "grace", name: "Grace Ibarra", color: "#F43F5E" },
  { handle: "grant_m", name: "Grant Moyo", color: "#10B981" },
  { handle: "greta", name: "Greta Lind", color: "#06B6D4" },
  { handle: "linus_k", name: "Linus Karlsson", color: "#F59E0B" },
  { handle: "mo", name: "Mo Haddad", color: "#8B5CF6" },
  { handle: "ada", name: "Ada Okafor", color: "#6366F1" },
];

export function InviteDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [query, setQuery] = useState(reduce ? "@gr" : "");
  const [invited, setInvited] = useState<string[]>([]);
  const [manual, setManual] = useState(false);

  // Autoplay: type "@gr", resolve, invite the first match, reset.
  useEffect(() => {
    if (!inView || manual || reduce) return;
    const script = ["@", "@g", "@gr", "@gr", "@gr", "@gr", "@gr", "", ""];
    let i = 0;
    const id = window.setInterval(() => {
      const next = script[i % script.length]!;
      setQuery(next);
      if (i % script.length === 5) setInvited(["grace"]);
      if (i % script.length === 7) setInvited([]);
      i++;
    }, 520);
    return () => window.clearInterval(id);
  }, [inView, manual, reduce]);

  const q = query.replace(/^@/, "").toLowerCase();
  const results = useMemo(
    () => (query.startsWith("@") || q ? DIRECTORY.filter((u) => u.handle.startsWith(q)).slice(0, 3) : []),
    [q, query],
  );

  return (
    <div ref={ref} data-ui className="rounded-xl bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <label className="flex h-10 items-center gap-2 rounded-lg bg-surface-2 px-3 shadow-highlight">
        <span className="sr-only">Search by username</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink-3">
          <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setManual(true);
            setQuery(e.target.value.slice(0, 21));
          }}
          placeholder="@username"
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <span aria-hidden className={cx("h-4 w-px bg-accent", !manual && "animate-pulse")} />
      </label>
      <ul className="mt-2 min-h-[132px] space-y-1">
        <AnimatePresence initial={false}>
          {results.map((u, i) => {
            const done = invited.includes(u.handle);
            return (
              <motion.li
                key={u.handle}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease, delay: i * 0.05 }}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
              >
                <Monogram name={u.name} color={u.color} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs" style={{ color: readable(u.color) }}>@{u.handle}</span>
                  <span className="block truncate text-xs text-ink-3">{u.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setManual(true);
                    setInvited((v) => (v.includes(u.handle) ? v : [...v, u.handle]));
                  }}
                  className={cx(
                    "h-7 rounded-md px-2.5 text-xs font-medium transition-colors active:scale-95",
                    done ? "bg-emerald/15 text-emerald" : "bg-surface-3 text-ink hover:bg-white/10",
                  )}
                >
                  {done ? "Invited" : "Send invite"}
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!results.length && (
          <li className="px-2 py-3 text-xs text-ink-3">Type @ and the first letters of a handle.</li>
        )}
      </ul>
    </div>
  );
}

/* ── Card 2: live focus HUD ─────────────────────────────────────────────── */

const FOCUS = [
  { handle: "grace", color: "#F43F5E", task: "Prototype haptic tick patterns", started: 42 * 60 + 13 },
  { handle: "linus_k", color: "#F59E0B", task: "Map tilt to tempo curve", started: 72 * 60 + 5 },
  { handle: "ada", color: "#6366F1", task: "Rewrite the onboarding copy", started: 9 * 60 + 48 },
];

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");

export function FocusHud() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <ul data-ui className="space-y-1.5">
      {FOCUS.map((f) => (
        <li
          key={f.handle}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: `${f.color}0f`, boxShadow: `inset 0 0 0 1px ${f.color}2e` }}
        >
          <span className="relative">
            <Monogram name={f.handle} color={f.color} size={28} />
            <span className="absolute -right-0.5 -top-0.5 flex size-2" style={{ color: readable(f.color) }}>
              <span className="pulse-ring relative size-2 rounded-full" style={{ backgroundColor: f.color }} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[11px]" style={{ color: readable(f.color) }}>@{f.handle}</span>
            <span className="block truncate text-[13px] text-ink">{f.task}</span>
          </span>
          <span className="font-mono text-xs tabular-nums text-ink-2">{fmt(f.started + t)}</span>
        </li>
      ))}
      <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-90">
        <Monogram name="mo" color="#06B6D4" size={28} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[11px] text-cyan">@mo</span>
          <span className="block text-[13px] text-ink-3">Away · shipped 2 tasks today</span>
        </span>
      </li>
    </ul>
  );
}

/* ── Card 3: idea → task pipeline ───────────────────────────────────────── */

const NODES = [
  { y: 34, label: "Read accelerometer at 60Hz", color: "#10B981" },
  { y: 100, label: "Map tilt to tempo curve", color: "#F59E0B" },
  { y: 166, label: "Octave spread on tilt", color: "#F43F5E" },
];

export function PipelineDemo() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg ref={ref} viewBox="0 0 520 200" className="h-auto w-full" role="img" aria-label="One vault idea branching into three assigned tasks">
      <g>
        <rect x="4" y="76" width="168" height="48" rx="10" fill="#18181C" stroke="rgba(255,255,255,0.12)" />
        <text x="18" y="96" fill="#FAFAFA" fontSize="12.5" fontFamily="var(--font-geist-sans)">Tilt arpeggiator</text>
        <text x="18" y="113" fill="#8A8A94" fontSize="10.5" fontFamily="var(--font-geist-mono)">idea · 3 sparks</text>
      </g>
      {NODES.map((n, i) => {
        const d = `M172 100 C 240 100, 240 ${n.y}, 300 ${n.y}`;
        const active = hover === null || hover === i;
        return (
          <g key={n.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
            <motion.path
              d={d}
              fill="none"
              stroke={n.color}
              strokeWidth={hover === i ? 2 : 1.4}
              strokeOpacity={active ? 0.9 : 0.25}
              initial={reduce ? false : { pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : undefined}
              transition={{ duration: 0.9, ease, delay: 0.2 + i * 0.15 }}
            />
            {inView && !reduce && (
              <circle r="2.6" fill={n.color}>
                <animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={d} />
              </circle>
            )}
            <motion.g
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={inView ? { opacity: active ? 1 : 0.4, x: 0 } : undefined}
              transition={{ duration: 0.5, ease, delay: 0.7 + i * 0.15 }}
            >
              <rect x="300" y={n.y - 20} width="214" height="40" rx="9" fill="#121215" stroke={hover === i ? n.color : "rgba(255,255,255,0.09)"} />
              <rect x="312" y={n.y - 7} width="14" height="14" rx="4" fill={`${n.color}26`} stroke={`${n.color}80`} />
              <text x="336" y={n.y + 4} fill="#FAFAFA" fontSize="12" fontFamily="var(--font-geist-sans)">{n.label}</text>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Card 4: security terminal ──────────────────────────────────────────── */

const LOG: { t: string; tone: "ok" | "warn" | "deny" | "plain" }[] = [
  { t: "GET  /api/users/search?q=gr      200  ip 29/30", tone: "plain" },
  { t: "pass  zero-trust  member(night-shift, @you)", tone: "ok" },
  { t: "POST action createIdea           200  user 19/20", tone: "plain" },
  { t: "pass  anti-idor   where { id, teamId } scoped", tone: "ok" },
  { t: "pass  zod.strict  title 1–140, tags ≤ 5", tone: "ok" },
  { t: "GET  /api/users/search?q=a  ×31  from 203.0.113.7", tone: "warn" },
  { t: "deny  429 Too Many Requests  Retry-After: 41", tone: "deny" },
  { t: "POST action sendInvite  origin: evil.example", tone: "warn" },
  { t: "deny  403 origin ≠ host  request blocked", tone: "deny" },
  { t: "pass  csp  script-src 'nonce-…' 'strict-dynamic'", tone: "ok" },
];
const TONE = { ok: "text-emerald", warn: "text-amber", deny: "text-rose", plain: "text-ink-2" };

export function SecurityTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? LOG.length : 3);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setN((v) => (v >= LOG.length + 3 ? 1 : v + 1)), 750);
    return () => window.clearInterval(id);
  }, [inView, reduce]);
  const lines = LOG.slice(0, Math.min(n, LOG.length));
  return (
    <div ref={ref} data-ui className="h-[236px] overflow-hidden rounded-xl bg-[#060607] p-4 font-mono text-[11.5px] leading-[1.75] shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="mb-2 flex gap-1.5" aria-hidden>
        <span className="size-2 rounded-full bg-white/10" />
        <span className="size-2 rounded-full bg-white/10" />
        <span className="size-2 rounded-full bg-white/10" />
      </div>
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.div
            key={l.t}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className={cx("truncate", TONE[l.tone])}
          >
            {l.t}
          </motion.div>
        ))}
      </AnimatePresence>
      <span className="inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-ink-2" aria-hidden />
    </div>
  );
}
