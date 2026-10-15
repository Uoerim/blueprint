"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setFavorite } from "@/app/actions/teams";
import { cx, Pill } from "@/components/ui/primitives";
import { ROLE_NAME, type TeamRole } from "@/lib/team-permissions";
import { timeAgo } from "@/lib/time";
import { TeamSquare } from "./team-switcher";

export type HomeTeam = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: TeamRole;
  customRole: { name: string; color: string } | null;
  favorite: boolean;
  members: number;
  openForMe: number;
  activityAt: string;
};

const ROLE_COLOR = { OWNER: "#F59E0B", CO_OWNER: "#06B6D4", MEMBER: undefined } as const;

export function TeamHome({ teams: initial }: { teams: HomeTeam[] }) {
  const [q, setQ] = useState("");
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [, start] = useTransition();
  const [teams, toggle] = useOptimistic(initial, (state: HomeTeam[], id: string) =>
    state.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)),
  );

  const star = (t: HomeTeam) =>
    start(async () => {
      toggle(t.id);
      await setFavorite({ teamId: t.id, favorite: !t.favorite });
    });

  const term = q.trim().toLowerCase();
  const shown = teams
    .filter((t) => (!onlyStarred || t.favorite) && (!term || t.name.toLowerCase().includes(term) || t.slug.includes(term)))
    // Starred first, then the most recently active.
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.activityAt.localeCompare(a.activityAt));
  const starred = teams.filter((t) => t.favorite).length;

  if (!teams.length) return null;

  return (
    <section aria-labelledby="teams-h" className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="teams-h" className="text-sm font-medium text-ink-2">
          Your teams <span className="font-mono text-[11px] text-ink-3">{teams.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <label className="field flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 sm:w-64 sm:flex-none">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-3">
              <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Search teams</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search teams"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </label>
          <button
            type="button"
            aria-pressed={onlyStarred}
            onClick={() => setOnlyStarred((v) => !v)}
            className={cx(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] shadow-highlight transition-colors",
              onlyStarred ? "bg-amber/15 text-amber" : "bg-surface text-ink-2 hover:text-ink",
            )}
          >
            <span aria-hidden>★</span> Starred <span className="font-mono text-[11px] opacity-70">{starred}</span>
          </button>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((t) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 480, damping: 38 }}
              className="relative"
            >
              <Link
                href={`/dashboard/${t.slug}`}
                className="card group flex h-full flex-col rounded-2xl p-4 pr-12 transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <TeamSquare name={t.name} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold tracking-tight text-ink">{t.name}</span>
                    <span className="block truncate font-mono text-[12px] text-ink-3">/{t.slug}</span>
                  </span>
                </span>
                <span className="mt-3 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-ink-2">
                  {t.description || <span className="text-ink-3">No description.</span>}
                </span>
                <span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-3">
                  {t.customRole ? <Pill color={t.customRole.color}>{t.customRole.name}</Pill> : <Pill color={ROLE_COLOR[t.role]}>{ROLE_NAME[t.role].toLowerCase()}</Pill>}
                  <span>{t.members} member{t.members === 1 ? "" : "s"}</span>
                  {t.openForMe > 0 && <span className="text-amber">{t.openForMe} for you</span>}
                  <span className="ml-auto" suppressHydrationWarning>{timeAgo(t.activityAt)}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => star(t)}
                aria-pressed={t.favorite}
                aria-label={t.favorite ? `Unstar ${t.name}` : `Star ${t.name}`}
                className={cx(
                  "absolute right-2 top-2 grid size-10 place-items-center rounded-xl text-lg transition-[color,transform] active:scale-90",
                  t.favorite ? "text-amber" : "text-ink-3 hover:text-ink",
                )}
              >
                {t.favorite ? "★" : "☆"}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!shown.length && (
        <p className="card mt-4 rounded-2xl px-6 py-10 text-center text-sm text-ink-3">
          {onlyStarred && !term ? "No starred teams yet. Tap ☆ on a team to keep it at the top." : `No team matches “${q}”.`}
        </p>
      )}
    </section>
  );
}
