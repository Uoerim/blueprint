"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  cancelInvite,
  deleteTeam,
  leaveTeam,
  removeMember,
  setMemberRole,
  transferOwnership,
  updateTeam,
} from "@/app/actions/teams";
import { inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, Pill, readable } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/action-types";
import { timeAgo } from "@/lib/time";
import type { MemberDTO, OutgoingInvite } from "@/lib/types";

type Role = MemberDTO["role"];
type Member = { userId: string; username: string; displayName: string | null; accentColor: string; role: Role; joinedAt: string };

const ROLE_COLOR = { OWNER: "#F59E0B", ADMIN: "#06B6D4", MEMBER: undefined } as const;

export function TeamSettings({
  team,
  viewerId,
  myRole,
  members,
  invites,
}: {
  team: { id: string; name: string; slug: string; description: string | null };
  viewerId: string;
  myRole: Role;
  members: Member[];
  invites: OutgoingInvite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "error" } | null>(null);
  const canEdit = myRole === "OWNER" || myRole === "ADMIN";

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.tone === "error" ? 4200 : 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const run = <T,>(fn: () => Promise<ActionResult<T>>, success?: string, onOk?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setToast({ id: Date.now(), text: res.error, tone: "error" });
      if (success) setToast({ id: Date.now(), text: success, tone: "ok" });
      if (onOk) onOk();
      else router.refresh();
    });

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-8 sm:px-6">
      <Link href={`/dashboard/${team.slug}`} className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> Back to {team.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Team settings</h1>
      <p className="mt-1 text-[15px] text-ink-2">
        {team.name} · <span className="font-mono text-[13px] text-ink-3">/{team.slug}</span>
      </p>

      <General team={team} canEdit={canEdit} pending={pending} run={run} />
      <Members team={team} viewerId={viewerId} myRole={myRole} members={members} invites={invites} run={run} />
      <Danger team={team} myRole={myRole} pending={pending} run={run} onGone={() => router.push("/dashboard")} />

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className={cx(
                "glass-solid pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]",
                toast.tone === "error" ? "border-rose/40 text-rose" : "border-line-strong text-ink",
              )}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type Run = <T>(fn: () => Promise<ActionResult<T>>, success?: string, onOk?: () => void) => void;

function Card({ id, title, note, children, tone }: { id: string; title: string; note?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <section aria-labelledby={id} className={cx("card mt-4 rounded-2xl p-5 sm:p-6", tone === "danger" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--rose)_35%,transparent)]")}>
      <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-1 text-[14px] text-ink-2">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ── General ────────────────────────────────────────────────────────────── */

function General({ team, canEdit, pending, run }: { team: { id: string; name: string; description: string | null }; canEdit: boolean; pending: boolean; run: Run }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const dirty = name.trim() !== team.name || description.trim() !== (team.description ?? "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    run(() => updateTeam({ teamId: team.id, name, description }), "Team details saved.");
  };

  return (
    <Card id="general-h" title="General" note={canEdit ? "The name and description everyone on the team sees." : "Only owners and admins can change these."}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="team-name" className="block text-sm font-medium text-ink">Team name</label>
          <input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            required
            minLength={2}
            maxLength={50}
            className={cx(inputCls, "mt-1.5 h-10 disabled:opacity-60")}
          />
        </div>
        <div>
          <label htmlFor="team-desc" className="block text-sm font-medium text-ink">Description</label>
          <textarea
            id="team-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            maxLength={2000}
            rows={3}
            placeholder="What is this team working on?"
            className={cx(inputCls, "mt-1.5 resize-y py-2.5 leading-relaxed disabled:opacity-60")}
          />
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!dirty || pending} className={cx(btn.primary, btn.sm, "disabled:opacity-50")}>
              Save changes
            </button>
            {dirty && (
              <button type="button" onClick={() => { setName(team.name); setDescription(team.description ?? ""); }} className={cx(btn.ghost, btn.sm)}>
                Reset
              </button>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

/* ── Members ────────────────────────────────────────────────────────────── */

function Members({
  team,
  viewerId,
  myRole,
  members,
  invites,
  run,
}: {
  team: { id: string; name: string; slug: string };
  viewerId: string;
  myRole: Role;
  members: Member[];
  invites: OutgoingInvite[];
  run: Run;
}) {
  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  return (
    <Card
      id="members-h"
      title={`Members · ${members.length}`}
      note={
        <>
          The owner can do everything. Admins can edit team details and remove members.{" "}
          <Link href={`/dashboard/${team.slug}?invite=1`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
            Invite people
          </Link>
        </>
      }
    >
      <ul className="-mx-2 space-y-0.5">
        {members.map((m) => {
          const isMe = m.userId === viewerId;
          const manageable = canManage && !isMe && m.role !== "OWNER" && !(myRole === "ADMIN" && m.role === "ADMIN");
          return (
            <li key={m.userId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
              <Monogram name={m.displayName ?? m.username} color={m.accentColor} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[13px]" style={{ color: readable(m.accentColor) }}>
                  @{m.username} {isMe && <span className="text-ink-3">(you)</span>}
                </span>
                <span className="block truncate text-xs text-ink-3" suppressHydrationWarning>
                  {m.displayName ? `${m.displayName} · ` : ""}joined {timeAgo(m.joinedAt)}
                </span>
              </span>
              <Pill color={ROLE_COLOR[m.role]}>{m.role.toLowerCase()}</Pill>
              {manageable ? (
                <Popover
                  label={`Manage @${m.username}`}
                  align="end"
                  triggerClassName="size-8 justify-center text-ink-3 hover:text-ink"
                  trigger={<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>}
                >
                  {(close) => (
                    <>
                      {myRole === "OWNER" && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            const role = m.role === "ADMIN" ? "MEMBER" : "ADMIN";
                            run(() => setMemberRole({ teamId: team.id, itemId: m.userId, role }), `@${m.username} is now ${role === "ADMIN" ? "an admin" : "a member"}.`);
                          }}
                        >
                          {m.role === "ADMIN" ? "Make member" : "Make admin"}
                        </MenuItem>
                      )}
                      {myRole === "OWNER" && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            if (window.confirm(`Make @${m.username} the owner of ${team.name}? You'll become an admin.`)) {
                              run(() => transferOwnership({ teamId: team.id, itemId: m.userId }), `@${m.username} now owns ${team.name}.`);
                            }
                          }}
                        >
                          Make owner
                        </MenuItem>
                      )}
                      <MenuItem
                        onSelect={() => {
                          close();
                          if (window.confirm(`Remove @${m.username} from ${team.name}? Their tasks become unassigned.`)) {
                            run(() => removeMember({ teamId: team.id, itemId: m.userId }), `Removed @${m.username}.`);
                          }
                        }}
                      >
                        <span className="text-rose">Remove from team</span>
                      </MenuItem>
                    </>
                  )}
                </Popover>
              ) : (
                <span className="size-8" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>

      {invites.length > 0 && (
        <>
          <h3 className="mt-6 text-xs font-medium text-ink-3">Pending invites · {invites.length}</h3>
          <ul className="-mx-2 mt-2 space-y-0.5">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Monogram name={i.username} color={i.accentColor} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px]" style={{ color: readable(i.accentColor) }}>@{i.username}</span>
                  <span className="block text-xs text-ink-3" suppressHydrationWarning>invited {timeAgo(i.createdAt)}</span>
                </span>
                <button type="button" onClick={() => run(() => cancelInvite({ teamId: team.id, itemId: i.id }), "Invite cancelled.")} className={cx(btn.ghost, btn.xs)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ── Leave / delete ─────────────────────────────────────────────────────── */

function Danger({ team, myRole, pending, run, onGone }: { team: { id: string; name: string }; myRole: Role; pending: boolean; run: Run; onGone: () => void }) {
  const [confirm, setConfirm] = useState("");

  if (myRole !== "OWNER") {
    return (
      <Card id="leave-h" title="Leave team" note="You'll lose access to this team's ideas and tasks. Tasks assigned to you become unassigned." tone="danger">
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm(`Leave ${team.name}?`) && run(() => leaveTeam({ teamId: team.id }), `You left ${team.name}.`, onGone)}
          className={cx(btn.outline, btn.sm, "text-rose disabled:opacity-50")}
        >
          Leave {team.name}
        </button>
      </Card>
    );
  }

  return (
    <Card
      id="delete-h"
      title="Delete team"
      note="Deletes the team with all of its ideas, projects, tasks and invites, for everyone. This can't be undone. To leave instead, make someone else the owner first."
      tone="danger"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => deleteTeam({ teamId: team.id, confirm }), `${team.name} was deleted.`, onGone);
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="confirm-delete" className="block text-sm text-ink-2">
            Type <span className="font-medium text-ink">{team.name}</span> to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={cx(inputCls, "mt-1.5 h-10")}
          />
        </div>
        <button
          type="submit"
          disabled={confirm.trim() !== team.name || pending}
          className={cx("inline-flex h-10 items-center justify-center rounded-lg bg-rose px-4 text-sm font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-40")}
        >
          Delete team
        </button>
      </form>
    </Card>
  );
}
