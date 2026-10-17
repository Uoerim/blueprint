"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState, useTransition } from "react";
import { approveConnection, denyConnection } from "@/app/actions/connect";
import { BrandMark, btn, cx } from "@/components/ui/primitives";

type Team = { id: string; name: string; slug: string; allowed: boolean; owner: boolean };
type ScopeId = "read" | "tasks" | "create";

const SCOPES: { id: ScopeId; title: string; note: string; locked?: boolean }[] = [
  { id: "read", title: "Read", note: "Ideas, projects and tasks you can see in the teams you pick.", locked: true },
  { id: "tasks", title: "Work on tasks", note: "Edit tasks, move them between columns, add and tick subtasks." },
  { id: "create", title: "Add ideas and tasks", note: "Capture new ideas and create new tasks." },
];

const NEVER = [
  "Delete anything",
  "Invite, remove or change anyone's role",
  "Change team or account settings",
  "See teams you don't pick, or tasks you can't see",
];

export function ConsentForm({
  request,
  username,
  kind,
  clientName,
  returnHost,
  teams,
  initialTeams,
  initialScopes,
}: {
  request: Record<string, string>;
  username: string;
  kind: "claude" | "local";
  clientName: string;
  returnHost: string;
  teams: Team[];
  initialTeams: string[];
  initialScopes: string[];
}) {
  const allowedTeams = teams.filter((t) => t.allowed);
  const [picked, setPicked] = useState<string[]>(() => {
    const prior = initialTeams.filter((id) => allowedTeams.some((t) => t.id === id));
    return prior.length ? prior : allowedTeams.length === 1 ? [allowedTeams[0]!.id] : [];
  });
  const [scopes, setScopes] = useState<ScopeId[]>(() => ["read", ...(["tasks", "create"] as const).filter((s) => initialScopes.includes(s))]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const go = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = approve ? await approveConnection({ request, teamIds: picked, scopes }) : await denyConnection({ request });
      if (!res.ok) return setError(res.error);
      setLeaving(true);
      window.location.assign(res.data.redirectTo);
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="card w-full max-w-lg rounded-2xl p-6 sm:p-8"
    >
      <div className="flex items-center justify-center gap-3" aria-hidden>
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink shadow-highlight">
          <BrandMark size={26} />
        </span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-ink-3"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </span>
        {/* A plain assistant glyph, not anyone's logo. */}
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent shadow-highlight">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
            <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.4" />
          </svg>
        </span>
      </div>

      <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">Connect Claude to Blueprint</h1>
      <p className="mt-1.5 text-center text-[14px] leading-relaxed text-ink-2">
        {kind === "claude" ? "Claude" : "Claude on this computer"} wants to work in Blueprint as{" "}
        <span className="font-mono text-ink">@{username}</span>. It can only ever do what you can do.
      </p>
      {kind === "local" && (
        <p className="mt-3 rounded-xl bg-amber/10 px-3 py-2.5 text-[13px] leading-relaxed text-amber">
          This request will finish on this computer ({returnHost}). Only continue if you just started it from Claude Code or Claude Desktop.
        </p>
      )}

      <section aria-labelledby="teams-h" className="mt-6">
        <h2 id="teams-h" className="text-[14px] font-medium text-ink">Which teams</h2>
        {allowedTeams.length === 0 && (
          <p className="mt-2 rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-2">
            None of your teams allow Claude yet. A team&apos;s owner turns it on in the team&apos;s settings, under <em>Claude</em>.
          </p>
        )}
        <ul className="mt-2 space-y-1.5">
          {teams.map((t) => {
            const on = picked.includes(t.id);
            return (
              <li key={t.id}>
                <label
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-highlight transition-colors",
                    t.allowed ? "cursor-pointer bg-surface-2 hover:bg-surface-3" : "bg-surface-2/50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!t.allowed || pending}
                    onChange={() => setPicked((p) => toggle(p, t.id))}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className={cx("min-w-0 flex-1 truncate text-[14px]", t.allowed ? "text-ink" : "text-ink-3")}>{t.name}</span>
                  {!t.allowed &&
                    (t.owner ? (
                      <Link href={`/dashboard/${t.slug}/settings#claude`} className="shrink-0 text-[12px] text-accent hover:underline">
                        Allow in settings
                      </Link>
                    ) : (
                      <span className="shrink-0 text-[12px] text-ink-3">Owner hasn&apos;t allowed Claude</span>
                    ))}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="perms-h" className="mt-6">
        <h2 id="perms-h" className="text-[14px] font-medium text-ink">What Claude may do</h2>
        <ul className="mt-2 space-y-1.5">
          {SCOPES.map((s) => (
            <li key={s.id}>
              <label className={cx("flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5 shadow-highlight", !s.locked && "cursor-pointer hover:bg-surface-3")}>
                <input
                  type="checkbox"
                  checked={scopes.includes(s.id)}
                  disabled={s.locked || pending}
                  onChange={() => setScopes((p) => toggle(p, s.id))}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] text-ink">
                    {s.title}
                    {s.locked && <span className="ml-1.5 text-[11px] text-ink-3">always</span>}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-3">{s.note}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-[12px] font-medium text-ink-2">Claude can never</p>
          <ul className="mt-1.5 grid gap-1 text-[12px] text-ink-3 sm:grid-cols-2">
            {NEVER.map((n) => (
              <li key={n} className="flex gap-1.5">
                <span aria-hidden className="text-rose">×</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-5 text-[12px] leading-relaxed text-ink-3">
        When Claude reads something, that text is sent to Anthropic to answer you, under Anthropic&apos;s own terms and privacy policy. Changes Claude makes show up in your team as yours, marked &ldquo;via Claude&rdquo; in the history. You can disconnect any time from{" "}
        <Link href="/dashboard/connections" className="text-ink underline decoration-line-strong underline-offset-2">Connect Claude</Link> in your account.
      </p>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-4 text-[13px] text-rose">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => go(false)} disabled={pending || leaving} className={cx(btn.ghost, "disabled:opacity-40")}>
          Cancel
        </button>
        <button type="button" onClick={() => go(true)} disabled={!picked.length || pending || leaving} className={cx(btn.primary, "disabled:opacity-40 sm:min-w-40")}>
          {leaving ? "Returning to Claude…" : pending ? "Connecting…" : "Allow and connect"}
        </button>
      </div>
      <p className="mt-4 text-center text-[11px] text-ink-3">Requested by &ldquo;{clientName}&rdquo; · returns to {returnHost}</p>
    </motion.div>
  );
}
