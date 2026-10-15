"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MenuItem, Popover } from "@/components/ui/popover";
import { cx } from "@/components/ui/primitives";
import type { TeamSummary } from "@/lib/types";
import { CreateTeamDialog } from "./create-team-dialog";
import { ROLE_NAME } from "@/lib/team-permissions";


export function TeamSquare({ name, size = 22 }: { name: string; size?: number }) {
  // Deterministic hue per team name, drawn as a flat geometric tile.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[28%] text-[11px] font-semibold"
      style={{ width: size, height: size, backgroundColor: `hsl(${hue} 60% 55% / 0.16)`, color: `color-mix(in oklab, hsl(${hue} 65% 55%) 78%, var(--readable-mix))` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function TeamSwitcher({ teams }: { teams: TeamSummary[] }) {
  const params = useParams<{ teamSlug?: string }>();
  const current = teams.find((t) => t.slug === params.teamSlug);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Popover
        label="Switch team"
        triggerClassName="h-9 gap-2 px-2"
        className="w-64"
        trigger={
          <>
            {current ? <TeamSquare name={current.name} /> : null}
            <span className="max-w-[34vw] truncate text-sm font-medium text-ink sm:max-w-[40vw]">{current?.name ?? "All teams"}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-ink-3">
              <path d="M3.5 4.75 6 2.25l2.5 2.5M3.5 7.25 6 9.75l2.5-2.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        }
      >
        {(close) => (
          <div>
            <Link
              href="/dashboard"
              onClick={close}
              role="menuitem"
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-tint/[0.07] hover:text-ink",
                !current && "bg-tint/[0.05] text-ink",
              )}
            >
              <span className="grid size-[22px] place-items-center rounded-[28%] bg-tint/[0.06]" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 5.5 6 2l4 3.5V10H7.5V7.5h-3V10H2V5.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" /></svg>
              </span>
              All teams
            </Link>
            <p className="px-2.5 pb-1 pt-2 text-xs text-ink-3">Teams</p>
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/${t.slug}`}
                onClick={close}
                role="menuitem"
                className={cx(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-tint/[0.07] hover:text-ink",
                  t.slug === current?.slug && "bg-tint/[0.05] text-ink",
                )}
              >
                <TeamSquare name={t.name} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.favorite && <span className="text-amber" aria-label="Starred">★</span>}
                <span className="text-[11px] text-ink-3">{ROLE_NAME[t.role]}</span>
              </Link>
            ))}
            {!teams.length && <p className="px-2.5 py-2 text-[13px] text-ink-3">No teams yet.</p>}
            <div className="my-1 h-px bg-line" />
            <MenuItem
              onSelect={() => {
                close();
                setCreating(true);
              }}
            >
              <span className="grid size-[22px] place-items-center rounded-[28%] bg-tint/[0.06] text-ink">+</span>
              Create new team
            </MenuItem>
          </div>
        )}
      </Popover>
      <CreateTeamDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
