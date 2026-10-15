"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { archiveIdea, deleteIdea, restoreIdea } from "@/app/actions/ideas";
import {
  cancelInvite,
  clearShipped,
  deleteTeam,
  emptyArchive,
  leaveTeam,
  removeMember,
  setMemberRole,
  transferOwnership,
  updateTeam,
} from "@/app/actions/teams";
import { ConfirmDialog, type ConfirmLevel } from "@/components/ui/confirm-dialog";
import { inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, Pill, readable } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/action-types";
import { timeAgo } from "@/lib/time";
import type { MemberDTO, OutgoingInvite } from "@/lib/types";

type Role = MemberDTO["role"];
type Member = { userId: string; username: string; displayName: string | null; accentColor: string; role: Role; joinedAt: string };
export type ManagedIdea = { id: string; title: string; authorId: string; taskCount: number; doneCount: number; updatedAt: string };
type Team = { id: string; name: string; slug: string; description: string | null };
type Run = <T>(fn: () => Promise<ActionResult<T>>, success?: string, onOk?: () => void) => void;

/** One pending confirmation; `tasks` > 0 adds an "also delete its tasks" option. */
type Ask = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  level: ConfirmLevel;
  tone?: "danger" | "neutral";
  tasks?: number;
  onConfirm: (withTasks: boolean) => void;
};

const ROLE_COLOR = { OWNER: "#F59E0B", ADMIN: "#06B6D4", MEMBER: undefined } as const;
const dots = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
    <circle cx="3" cy="7" r="1.2" fill="currentColor" />
    <circle cx="7" cy="7" r="1.2" fill="currentColor" />
    <circle cx="11" cy="7" r="1.2" fill="currentColor" />
  </svg>
);

export function TeamSettings({
  team,
  viewerId,
  myRole,
  members,
  invites,
  projects,
  archived,
  shippedCount,
}: {
  team: Team;
  viewerId: string;
  myRole: Role;
  members: Member[];
  invites: OutgoingInvite[];
  projects: ManagedIdea[];
  archived: ManagedIdea[];
  shippedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "error" } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [withTasks, setWithTasks] = useState(false);
  const canEdit = myRole === "OWNER" || myRole === "ADMIN";

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.tone === "error" ? 4200 : 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const run: Run = (fn, success, onOk) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setToast({ id: Date.now(), text: res.error, tone: "error" });
      if (success) setToast({ id: Date.now(), text: success, tone: "ok" });
      if (onOk) onOk();
      else router.refresh();
    });

  const confirmIt = (a: Ask) => {
    setWithTasks(false);
    setAsk(a);
  };

  const shared = { team, myRole, viewerId, run, confirmIt };

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-8 sm:px-6">
      <Link href={`/dashboard/${team.slug}`} className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> Back to {team.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Team settings</h1>
      <p className="mt-1 text-[15px] text-ink-2">
        {team.name} · <span className="font-mono text-[13px] text-ink-3">/{team.slug}</span>
      </p>

      <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-1.5 text-[13px]">
        {[
          ["general", "General"],
          ["members", "Members"],
          ["projects", "Projects"],
          ["archive", "Archive"],
          ["danger", "Danger zone"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-ink-2 shadow-highlight transition-colors hover:bg-surface-3 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <General team={team} canEdit={canEdit} pending={pending} run={run} />
      <Members {...shared} members={members} invites={invites} />
      <Projects {...shared} projects={projects} />
      <Archive {...shared} archived={archived} />
      <Danger
        {...shared}
        archivedCount={archived.length}
        shippedCount={shippedCount}
        onGone={() => router.push("/dashboard")}
      />

      <ConfirmDialog
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.title ?? ""}
        description={ask?.description}
        confirmLabel={ask?.confirmLabel ?? ""}
        level={ask?.level ?? { kind: "plain" }}
        tone={ask?.tone}
        onConfirm={() => ask?.onConfirm(withTasks)}
      >
        {!!ask?.tasks && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-[14px] text-ink">
            <input type="checkbox" checked={withTasks} onChange={(e) => setWithTasks(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--rose)]" />
            <span>
              Also delete its {ask.tasks} task{ask.tasks === 1 ? "" : "s"}
              <span className="block text-[13px] text-ink-3">Otherwise they stay on the board, outside any project.</span>
            </span>
          </label>
        )}
      </ConfirmDialog>

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

type Shared = { team: Team; myRole: Role; viewerId: string; run: Run; confirmIt: (a: Ask) => void };

function Card({ id, title, note, children, tone }: { id: string; title: string; note?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cx(
        "card mt-4 scroll-mt-20 rounded-2xl p-5 sm:p-6",
        tone === "danger" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--rose)_35%,transparent)]",
      )}
    >
      <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-1 text-[14px] text-ink-2">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ── General ────────────────────────────────────────────────────────────── */

function General({ team, canEdit, pending, run }: { team: Team; canEdit: boolean; pending: boolean; run: Run }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const dirty = name.trim() !== team.name || description.trim() !== (team.description ?? "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    run(() => updateTeam({ teamId: team.id, name, description }), "Team details saved.");
  };

  return (
    <Card id="general" title="General" note={canEdit ? "The name and description everyone on the team sees." : "Only owners and admins can change these."}>
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
              <button
                type="button"
                onClick={() => {
                  setName(team.name);
                  setDescription(team.description ?? "");
                }}
                className={cx(btn.ghost, btn.sm)}
              >
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

function Members({ team, viewerId, myRole, run, confirmIt, members, invites }: Shared & { members: Member[]; invites: OutgoingInvite[] }) {
  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  return (
    <Card
      id="members"
      title={`Members · ${members.length}`}
      note={
        <>
          The owner can do everything. Admins can edit team details, manage projects and remove members.{" "}
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
                <Popover label={`Manage @${m.username}`} align="end" triggerClassName="size-8 justify-center text-ink-3 hover:text-ink" trigger={dots}>
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
                            confirmIt({
                              title: "Transfer ownership?",
                              description: <>@{m.username} becomes the owner of {team.name}, with full control including deleting it. You become an admin, and only they can make you the owner again.</>,
                              confirmLabel: "Transfer ownership",
                              level: { kind: "type", phrase: team.name, what: "team name" },
                              onConfirm: () => run(() => transferOwnership({ teamId: team.id, itemId: m.userId }), `@${m.username} now owns ${team.name}.`),
                            });
                          }}
                        >
                          Make owner
                        </MenuItem>
                      )}
                      <MenuItem
                        onSelect={() => {
                          close();
                          confirmIt({
                            title: `Remove @${m.username}?`,
                            description: <>They lose access to {team.name} straight away and their tasks become unassigned. You can invite them again later.</>,
                            confirmLabel: "Remove member",
                            level: { kind: "ack" },
                            onConfirm: () => run(() => removeMember({ teamId: team.id, itemId: m.userId }), `Removed @${m.username}.`),
                          });
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

/* ── Projects ───────────────────────────────────────────────────────────── */

function Projects({ team, viewerId, myRole, run, confirmIt, projects }: Shared & { projects: ManagedIdea[] }) {
  const can = (p: ManagedIdea) => myRole !== "MEMBER" || p.authorId === viewerId;
  return (
    <Card id="projects" title={`Projects · ${projects.length}`} note="Open, archive or delete the team's projects. Archiving is reversible; deleting is not.">
      {projects.length ? (
        <ul className="-mx-2 space-y-0.5">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
                <span className="text-violet" aria-hidden>◆</span>
                <span className="min-w-0 flex-1">
                  <Link href={`/dashboard/${team.slug}?view=board&project=${p.id}`} className="block truncate text-[14px] font-medium text-ink hover:underline">
                    {p.title}
                  </Link>
                  <span className="block text-xs text-ink-3">
                    {p.taskCount} task{p.taskCount === 1 ? "" : "s"} · {pct}% done
                  </span>
                </span>
                {can(p) ? (
                  <Popover label={`Manage ${p.title}`} align="end" triggerClassName="size-8 justify-center text-ink-3 hover:text-ink" trigger={dots}>
                    {(close) => (
                      <>
                        <MenuItem
                          onSelect={() => {
                            close();
                            confirmIt({
                              title: "Archive project?",
                              description: <>&ldquo;{p.title}&rdquo; leaves Execution. Its tasks stay on the board without a project. You can restore it from the archive below.</>,
                              confirmLabel: "Archive project",
                              tone: "neutral",
                              level: { kind: "plain" },
                              onConfirm: () => run(() => archiveIdea({ teamId: team.id, itemId: p.id }), "Project archived."),
                            });
                          }}
                        >
                          Archive
                        </MenuItem>
                        <MenuItem
                          onSelect={() => {
                            close();
                            confirmIt({
                              title: "Delete project?",
                              description: <>&ldquo;{p.title}&rdquo;, its description and its notes will be deleted for everyone on the team.</>,
                              confirmLabel: "Delete project",
                              level: { kind: "type", phrase: p.title, what: "project name" },
                              tasks: p.taskCount,
                              onConfirm: (withTasks) =>
                                run(
                                  () => deleteIdea({ teamId: team.id, itemId: p.id, confirm: p.title, withTasks }),
                                  withTasks ? "Project and its tasks deleted." : "Project deleted.",
                                ),
                            });
                          }}
                        >
                          <span className="text-rose">Delete project</span>
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
      ) : (
        <p className="text-[14px] text-ink-3">No projects yet. Promote an idea or start one from Execution.</p>
      )}
    </Card>
  );
}

/* ── Archive ────────────────────────────────────────────────────────────── */

function Archive({ team, viewerId, myRole, run, confirmIt, archived }: Shared & { archived: ManagedIdea[] }) {
  const can = (i: ManagedIdea) => myRole !== "MEMBER" || i.authorId === viewerId;
  return (
    <Card id="archive" title={`Archive · ${archived.length}`} note="Archived ideas and projects. Restore them, or delete them for good.">
      {archived.length ? (
        <ul className="-mx-2 space-y-0.5">
          {archived.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink">{i.title}</span>
                <span className="block text-xs text-ink-3" suppressHydrationWarning>
                  {i.taskCount ? `Project · ${i.taskCount} task${i.taskCount === 1 ? "" : "s"}` : "Idea"} · archived {timeAgo(i.updatedAt)}
                </span>
              </span>
              {can(i) && (
                <>
                  <button
                    type="button"
                    onClick={() => run(() => restoreIdea({ teamId: team.id, itemId: i.id }), i.taskCount ? "Restored to Execution." : "Restored to the idea vault.")}
                    className={cx(btn.ghost, btn.xs)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      confirmIt({
                        title: "Delete for good?",
                        description: <>&ldquo;{i.title}&rdquo; will be permanently deleted.</>,
                        confirmLabel: "Delete",
                        level: { kind: "ack" },
                        tasks: i.taskCount,
                        onConfirm: (withTasks) => run(() => deleteIdea({ teamId: team.id, itemId: i.id, withTasks }), "Deleted."),
                      })
                    }
                    className={cx(btn.ghost, btn.xs, "text-rose hover:text-rose")}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-3">Nothing archived.</p>
      )}
    </Card>
  );
}

/* ── Danger zone ────────────────────────────────────────────────────────── */

function DangerRow({ title, note, action }: { title: string; note: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

const dangerBtn = cx(btn.outline, btn.sm, "text-rose hover:text-rose disabled:opacity-40");

function Danger({
  team,
  myRole,
  run,
  confirmIt,
  archivedCount,
  shippedCount,
  onGone,
}: Shared & { archivedCount: number; shippedCount: number; onGone: () => void }) {
  const canManage = myRole !== "MEMBER";
  const typed: ConfirmLevel = { kind: "type", phrase: team.name, what: "team name" };

  return (
    <Card id="danger" title="Danger zone" note="These can't be undone." tone="danger">
      {canManage && (
        <DangerRow
          title="Clear shipped tasks"
          note={`Permanently deletes all ${shippedCount} finished task${shippedCount === 1 ? "" : "s"} in Shipped.`}
          action={
            <button
              type="button"
              disabled={!shippedCount}
              onClick={() =>
                confirmIt({
                  title: "Clear shipped tasks?",
                  description: <>All {shippedCount} finished tasks in {team.name} will be permanently deleted, along with their notes.</>,
                  confirmLabel: "Clear shipped",
                  level: typed,
                  onConfirm: () => run(() => clearShipped({ teamId: team.id, confirm: team.name }), "Shipped tasks cleared."),
                })
              }
              className={dangerBtn}
            >
              Clear shipped
            </button>
          }
        />
      )}
      {canManage && (
        <DangerRow
          title="Empty the archive"
          note={`Permanently deletes ${archivedCount} archived idea${archivedCount === 1 ? "" : "s"} and project${archivedCount === 1 ? "" : "s"}. Their tasks stay.`}
          action={
            <button
              type="button"
              disabled={!archivedCount}
              onClick={() =>
                confirmIt({
                  title: "Empty the archive?",
                  description: <>All {archivedCount} archived ideas and projects in {team.name} will be permanently deleted. Tasks that belonged to them stay on the board.</>,
                  confirmLabel: "Empty archive",
                  level: typed,
                  onConfirm: () => run(() => emptyArchive({ teamId: team.id, confirm: team.name }), "Archive emptied."),
                })
              }
              className={dangerBtn}
            >
              Empty archive
            </button>
          }
        />
      )}
      {myRole === "OWNER" ? (
        <DangerRow
          title="Delete team"
          note="Deletes the team with every idea, project, task and invite, for everyone. To leave instead, make someone else the owner first."
          action={
            <button
              type="button"
              onClick={() =>
                confirmIt({
                  title: `Delete ${team.name}?`,
                  description: <>Every idea, project, task, member and invite in {team.name} will be permanently deleted for everyone.</>,
                  confirmLabel: "Delete team",
                  level: typed,
                  onConfirm: () => run(() => deleteTeam({ teamId: team.id, confirm: team.name }), `${team.name} was deleted.`, onGone),
                })
              }
              className={cx("inline-flex h-8 items-center rounded-lg bg-rose px-3 text-[13px] font-medium text-white transition-[filter] hover:brightness-110")}
            >
              Delete team
            </button>
          }
        />
      ) : (
        <DangerRow
          title="Leave team"
          note="You lose access to this team. Tasks assigned to you become unassigned."
          action={
            <button
              type="button"
              onClick={() =>
                confirmIt({
                  title: `Leave ${team.name}?`,
                  description: <>You&apos;ll lose access to its ideas, projects and tasks. Someone will need to invite you again to come back.</>,
                  confirmLabel: "Leave team",
                  level: { kind: "ack" },
                  onConfirm: () => run(() => leaveTeam({ teamId: team.id }), `You left ${team.name}.`, onGone),
                })
              }
              className={dangerBtn}
            >
              Leave team
            </button>
          }
        />
      )}
    </Card>
  );
}
