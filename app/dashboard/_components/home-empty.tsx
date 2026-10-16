import type { ReactNode } from "react";
import { CopyUsername } from "./copy-username";

/*
 * Dashboard home for someone who isn't in a team yet: instead of a blank page,
 * say plainly that there are no invites and no teams, and what to do next.
 */

/** No pending invites, with your username to share so someone can invite you. */
export function NoInvites({ username }: { username: string }) {
  return (
    <div className="card mt-2 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
      <EmptyIcon>
        <path d="M3.5 8.5 5.6 4.2A1.5 1.5 0 0 1 7 3.5h6a1.5 1.5 0 0 1 1.4.7l2.1 4.3V15a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V8.5Z" />
        <path d="M3.5 8.5h3.75l1 2h3.5l1-2h3.75" />
      </EmptyIcon>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">No pending invites</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
          When someone invites you to their team, it shows up here straight away. They&apos;ll need your username.
        </p>
      </div>
      <CopyUsername username={username} className="self-start sm:self-auto" />
    </div>
  );
}

/** Not in any team yet. */
export function NoTeams() {
  return (
    <div className="card mt-2 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
      <EmptyIcon>
        <circle cx="7.5" cy="7.5" r="2.75" />
        <circle cx="13.75" cy="8.75" r="2.25" />
        <path d="M2.75 16c.6-2.6 2.5-4 4.75-4s4.15 1.4 4.75 4M12.5 13.1c.4-.1.8-.1 1.25-.1 1.9 0 3.3 1.1 3.75 3" />
      </EmptyIcon>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">You&apos;re not in a team yet</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
          Teams hold your ideas, projects and tasks. Start one for yourself or your squad with{" "}
          <span className="text-ink-2">Create new team</span>, or join one by accepting an invite.
        </p>
      </div>
    </div>
  );
}

/** The icon tile at the start of an empty-state card. */
function EmptyIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint/[0.06] text-ink-3">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}
