"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cancelInvite, removeMember, sendInvite, setMemberRole } from "@/app/actions/teams";
import { Dialog } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, Pill, readable } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/time";
import type { OutgoingInvite } from "@/lib/types";
import { useWorkspace } from "./workspace";

type Result = { id: string; username: string; displayName: string | null; accentColor: string; state: "member" | "invited" | "none" };

const ROLE_COLOR = { OWNER: "#F59E0B", ADMIN: "#06B6D4", MEMBER: undefined } as const;

export function InviteDialog({ open, onClose, invites }: { open: boolean; onClose: () => void; invites: OutgoingInvite[] }) {
  const { team, members, viewer, myRole, run } = useWorkspace();
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<{ for: string; users: Result[]; limited: boolean } | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  const term = q.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
  const fresh = reply?.for === term ? reply : null;
  const results = term && fresh ? fresh.users : [];
  const status: "idle" | "loading" | "limited" = !term ? "idle" : !fresh ? "loading" : fresh.limited ? "limited" : "idle";

  useEffect(() => {
    if (!term) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&teamId=${encodeURIComponent(team.id)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (res.status === 429) return setReply({ for: term, users: [], limited: true });
        const data = (await res.json()) as { users?: Result[] };
        setReply({ for: term, users: data.users ?? [], limited: false });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setReply({ for: term, users: [], limited: false });
      }
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [term, team.id]);

  const invite = (u: Result) =>
    run(() => sendInvite({ teamId: team.id, inviteeId: u.id }), {
      optimistic: () => setSent((s) => [...s, u.id]),
      success: `Invite sent to @${u.username}.`,
    });

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  return (
    <Dialog open={open} onClose={onClose} title="Invite teammates" description={`Search anyone on Blueprint by @username and add them to ${team.name}.`}>
      <div className="pt-2">
        <label className="flex h-11 items-center gap-2 rounded-lg bg-bg px-3 shadow-[inset_0_0_0_1px_var(--line-strong)] focus-within:shadow-[inset_0_0_0_1px_#6366F1]">
          <span className="font-mono text-sm text-ink-3">@</span>
          <span className="sr-only">Search by username</span>
          <input
            autoFocus
            value={q}
            maxLength={21}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="username"
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {status === "loading" && <span className="size-3.5 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" aria-label="Searching" />}
        </label>

        <ul className="mt-2 space-y-0.5" aria-live="polite">
          <AnimatePresence initial={false}>
            {results.map((u, i) => {
              const state = sent.includes(u.id) ? "invited" : u.state;
              return (
                <motion.li
                  key={u.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]"
                >
                  <Monogram name={u.displayName ?? u.username} color={u.accentColor} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px]" style={{ color: readable(u.accentColor) }}>@{u.username}</span>
                    {u.displayName && <span className="block truncate text-xs text-ink-3">{u.displayName}</span>}
                  </span>
                  {state === "member" && <span className="text-xs text-ink-3">Already on team</span>}
                  {state === "invited" && <span className="rounded-md bg-emerald/15 px-2 py-1 text-xs text-emerald">Invited</span>}
                  {state === "none" && (
                    <button type="button" onClick={() => invite(u)} className={cx(btn.accent, btn.xs)}>Send invite</button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {term && status === "idle" && !results.length && <li className="px-2 py-3 text-[13px] text-ink-3">No one with a handle starting @{term}.</li>}
          {status === "limited" && <li className="px-2 py-3 text-[13px] text-rose">Searching too fast — give it a few seconds.</li>}
        </ul>

        <h3 className="mt-7 text-xs font-medium text-ink-3">Members · {members.length}</h3>
        <ul className="mt-2 space-y-0.5">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Monogram name={m.displayName ?? m.username} color={m.accentColor} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[13px]" style={{ color: readable(m.accentColor) }}>
                  @{m.username} {m.userId === viewer.id && <span className="text-ink-3">(you)</span>}
                </span>
                {m.displayName && <span className="block truncate text-xs text-ink-3">{m.displayName}</span>}
              </span>
              <Pill color={ROLE_COLOR[m.role]}>{m.role.toLowerCase()}</Pill>
              {canManage && m.role !== "OWNER" && m.userId !== viewer.id && !(myRole === "ADMIN" && m.role === "ADMIN") && (
                <Popover
                  label={`Manage @${m.username}`}
                  align="end"
                  triggerClassName="size-7 justify-center text-ink-3 hover:text-ink"
                  trigger={<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>}
                >
                  {(close) => (
                    <>
                      {myRole === "OWNER" && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            run(() => setMemberRole({ teamId: team.id, itemId: m.userId, role: m.role === "ADMIN" ? "MEMBER" : "ADMIN" }), {
                              success: `@${m.username} is now ${m.role === "ADMIN" ? "a member" : "an admin"}.`,
                            });
                          }}
                        >
                          {m.role === "ADMIN" ? "Make member" : "Make admin"}
                        </MenuItem>
                      )}
                      <MenuItem
                        onSelect={() => {
                          close();
                          if (window.confirm(`Remove @${m.username} from ${team.name}?`)) {
                            run(() => removeMember({ teamId: team.id, itemId: m.userId }), { success: `Removed @${m.username}.` });
                          }
                        }}
                      >
                        <span className="text-rose">Remove from team</span>
                      </MenuItem>
                    </>
                  )}
                </Popover>
              )}
            </li>
          ))}
        </ul>

        {invites.length > 0 && (
          <>
            <h3 className="mt-7 text-xs font-medium text-ink-3">Pending invites · {invites.length}</h3>
            <ul className="mt-2 space-y-0.5">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Monogram name={i.username} color={i.accentColor} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px]" style={{ color: readable(i.accentColor) }}>@{i.username}</span>
                    <span className="block text-xs text-ink-3" suppressHydrationWarning>invited {timeAgo(i.createdAt)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => cancelInvite({ teamId: team.id, itemId: i.id }), { success: "Invite cancelled." })}
                    className={cx(btn.ghost, btn.xs)}
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  );
}
