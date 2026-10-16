"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cx } from "@/components/ui/primitives";
import { ROLE_NAME } from "@/lib/team-permissions";
import { useTeams } from "./app-shell";
import { TeamSquare } from "./team-switcher";

/**
 * Installed app only: the current team as a chip (tap to switch in a bottom
 * sheet, starred teams first), plus invite and team settings buttons.
 */
export function AppTeamBar({
  team,
  canInvite,
  onInvite,
}: {
  team: { name: string; slug: string };
  canInvite: boolean;
  onInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const teams = useTeams();
  const sorted = [...teams].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <div className="hidden items-center gap-2 app:flex">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface pl-1.5 pr-4 shadow-highlight active:scale-[0.98]"
      >
        <TeamSquare name={team.name} size={32} />
        <span className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-ink">{team.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0 text-ink-3">
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {canInvite && (
        <button
          type="button"
          onClick={onInvite}
          aria-label="Invite teammates"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-highlight active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="8" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2.5 16.5c.9-2.8 3-4.25 5.5-4.25s4.6 1.45 5.5 4.25M15.5 6.5v5M13 9h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <Link
        href={`/dashboard/${team.slug}/settings`}
        aria-label="Team settings"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-highlight active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16.2 12.2a1.3 1.3 0 0 0 .26 1.43l.05.05a1.58 1.58 0 1 1-2.23 2.23l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.58 1.58 0 0 1-3.16 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.58 1.58 0 1 1-2.23-2.23l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79h-.14a1.58 1.58 0 0 1 0-3.16h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.58 1.58 0 1 1 2.23-2.23l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.58 1.58 0 0 1 3.16 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.58 1.58 0 1 1 2.23 2.23l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.58 1.58 0 0 1 0 3.16h-.07a1.3 1.3 0 0 0-1.19.79Z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Link>

      <Dialog open={open} onClose={() => setOpen(false)} title="Switch team">
        <ul className="space-y-1 pb-2">
          {sorted.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/${t.slug}`}
                onClick={() => setOpen(false)}
                aria-current={t.slug === team.slug ? "page" : undefined}
                className={cx(
                  "flex min-h-14 items-center gap-3 rounded-2xl px-3 transition-colors active:scale-[0.99]",
                  t.slug === team.slug ? "bg-surface-2" : "hover:bg-tint/[0.04]",
                )}
              >
                <TeamSquare name={t.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{t.name}</span>
                  <span className="block text-[12px] text-ink-3">{ROLE_NAME[t.role]}</span>
                </span>
                {t.favorite && <span className="text-amber" aria-label="Starred">★</span>}
                {t.slug === team.slug && (
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Current team" className="text-accent">
                    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/dashboard" onClick={() => setOpen(false)} className="mt-1 flex min-h-12 items-center justify-center rounded-2xl text-[14px] text-ink-2 hover:text-ink">
          All teams
        </Link>
      </Dialog>
    </div>
  );
}
