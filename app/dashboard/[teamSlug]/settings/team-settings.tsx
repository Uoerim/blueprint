"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { archiveIdea, deleteIdea, restoreIdea } from "@/app/actions/ideas";
import { createTag, deleteTag, updateTag } from "@/app/actions/tags";
import {
  cancelInvite,
  clearShipped,
  createTeamRole,
  deleteTeam,
  deleteTeamRole,
  emptyArchive,
  leaveTeam,
  removeMember,
  setMemberCustomRole,
  setMemberRole,
  transferOwnership,
  updateTeam,
  updateTeamRole,
} from "@/app/actions/teams";
import { ConfirmDialog, type ConfirmLevel } from "@/components/ui/confirm-dialog";
import { Dialog, inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, Pill, readable } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-types";
import {
  DEFAULT_MEMBER,
  GRANTABLE,
  type Grantable,
  PERMISSION_INFO,
  ROLE_COLORS,
  ROLE_NAME,
  TAG_PALETTE,
  type TeamPermission,
  type TeamRole,
} from "@/lib/team-permissions";
import { timeAgo } from "@/lib/time";
import type { OutgoingInvite, TagDTO } from "@/lib/types";

type Member = {
  userId: string;
  username: string;
  displayName: string | null;
  accentColor: string;
  imageUrl: string | null;
  role: TeamRole;
  customRole: { id: string; name: string; color: string } | null;
  joinedAt: string;
};
export type ManagedIdea = {
  id: string;
  title: string;
  authorId: string;
  taskCount: number;
  doneCount: number;
  isProject: boolean;
  updatedAt: string;
};
type RoleRow = { id: string; name: string; color: string; permissions: string[]; members: number };
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

type Shared = {
  team: Team;
  myRole: TeamRole;
  viewerId: string;
  can: (p: TeamPermission) => boolean;
  run: Run;
  confirmIt: (a: Ask) => void;
};

const ROLE_COLOR = { OWNER: "#F59E0B", CO_OWNER: "#06B6D4", MEMBER: undefined } as const;
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
  perms,
  members,
  invites,
  roles,
  projects,
  archived,
  shippedCount,
  tags,
}: {
  team: Team;
  viewerId: string;
  myRole: TeamRole;
  perms: TeamPermission[];
  members: Member[];
  invites: OutgoingInvite[];
  roles: RoleRow[];
  projects: ManagedIdea[];
  archived: ManagedIdea[];
  shippedCount: number;
  tags: TagDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [withTasks, setWithTasks] = useState(false);
  const can = (p: TeamPermission) => perms.includes(p);

  const run: Run = (fn, success, onOk) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return show(res.error, "error");
      if (success) show(success);
      if (onOk) onOk();
      else router.refresh();
    });

  const confirmIt = (a: Ask) => {
    setWithTasks(false);
    setAsk(a);
  };

  const shared: Shared = { team, myRole, viewerId, can, run, confirmIt };
  const sections = [
    ["general", "General"],
    ["members", "Members"],
    ["roles", "Roles"],
    ["tags", "Tags"],
    ["projects", "Projects"],
    ["archive", "Archive"],
    ["danger", myRole === "OWNER" || can("team.cleanup") ? "Danger zone" : "Leave"],
  ];

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-24 pt-8 sm:px-6">
      <Link href={`/dashboard/${team.slug}`} className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> Back to {team.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Team settings</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-ink-2">
        {team.name} · <span className="font-mono text-[13px] text-ink-3">/{team.slug}</span>
        <Pill color={ROLE_COLOR[myRole]}>You: {ROLE_NAME[myRole].toLowerCase()}</Pill>
      </p>

      <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-1.5 text-[13px]">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-ink-2 shadow-highlight transition-colors hover:bg-surface-3 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <General team={team} canEdit={can("team.edit")} pending={pending} run={run} />
      <Members {...shared} members={members} invites={invites} roles={roles} />
      <Roles {...shared} roles={roles} />
      <Tags {...shared} tags={tags} />
      <Projects {...shared} projects={projects} />
      <Archive {...shared} archived={archived} />
      <Danger {...shared} archivedCount={archived.length} shippedCount={shippedCount} onGone={() => router.push("/dashboard")} />

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
      <ToastView toast={toast} />
    </div>
  );
}

function Card({ id, title, note, children, tone, action }: { id: string; title: string; note?: ReactNode; children: ReactNode; tone?: "danger"; action?: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cx("card mt-4 scroll-mt-20 rounded-2xl p-5 sm:p-6", tone === "danger" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--rose)_35%,transparent)]")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight">{title}</h2>
          {note && <p className="mt-1 max-w-[68ch] text-[14px] text-ink-2">{note}</p>}
        </div>
        {action}
      </div>
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
    <Card id="general" title="General" note={canEdit ? "The name and description everyone on the team sees." : "Only the owner, co-owners and roles with permission can change these."}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="team-name" className="block text-sm font-medium text-ink">Team name</label>
          <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required minLength={2} maxLength={50} className={cx(inputCls, "mt-1.5 h-10 disabled:opacity-60")} />
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
            <button type="submit" disabled={!dirty || pending} className={cx(btn.primary, btn.sm, "disabled:opacity-50")}>Save changes</button>
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

function RoleBadge({ m }: { m: Pick<Member, "role" | "customRole"> }) {
  if (m.customRole) return <Pill color={m.customRole.color}>{m.customRole.name}</Pill>;
  return <Pill color={ROLE_COLOR[m.role]}>{ROLE_NAME[m.role].toLowerCase()}</Pill>;
}

function Members({ team, viewerId, myRole, can, run, confirmIt, members, invites, roles }: Shared & { members: Member[]; invites: OutgoingInvite[]; roles: RoleRow[] }) {
  // A member with members.manage can only hand out roles within their own power (the server checks this too).
  const assignable = roles.filter((r) => myRole !== "MEMBER" || r.permissions.every((p) => can(p as TeamPermission)));

  return (
    <Card
      id="members"
      title={`Members · ${members.length}`}
      note={
        <>
          The owner can do everything. Co-owners can do everything except delete the team or its projects. Members get the default
          permissions or a custom role.{" "}
          {can("members.invite") && (
            <Link href={`/dashboard/${team.slug}?invite=1`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
              Invite people
            </Link>
          )}
        </>
      }
    >
      <ul className="-mx-2 space-y-0.5">
        {members.map((m) => {
          const isMe = m.userId === viewerId;
          const ownerActions = can("members.coOwner") && !isMe && m.role !== "OWNER";
          const manageActions = can("members.manage") && !isMe && m.role === "MEMBER";
          const removable = !isMe && m.role !== "OWNER" && (m.role === "CO_OWNER" ? can("members.coOwner") : can("members.manage"));
          return (
            <li key={m.userId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
              <Monogram name={m.displayName ?? m.username} color={m.accentColor} src={m.imageUrl} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[13px]" style={{ color: readable(m.accentColor) }}>
                  @{m.username} {isMe && <span className="text-ink-3">(you)</span>}
                </span>
                <span className="block truncate text-xs text-ink-3" suppressHydrationWarning>
                  {m.displayName ? `${m.displayName} · ` : ""}joined {timeAgo(m.joinedAt)}
                </span>
              </span>
              <RoleBadge m={m} />
              {ownerActions || manageActions || removable ? (
                <Popover label={`Manage @${m.username}`} align="end" className="w-60" triggerClassName="size-8 justify-center text-ink-3 hover:text-ink" trigger={dots}>
                  {(close) => (
                    <>
                      {ownerActions && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            const role = m.role === "CO_OWNER" ? "MEMBER" : "CO_OWNER";
                            run(() => setMemberRole({ teamId: team.id, itemId: m.userId, role }), `@${m.username} is now ${role === "CO_OWNER" ? "a co-owner" : "a member"}.`);
                          }}
                        >
                          {m.role === "CO_OWNER" ? "Make member" : "Make co-owner"}
                        </MenuItem>
                      )}
                      {manageActions && (
                        <>
                          <p className="px-2.5 pb-1 pt-2 text-xs text-ink-3">Role</p>
                          <MenuItem
                            active={!m.customRole}
                            onSelect={() => {
                              close();
                              run(() => setMemberCustomRole({ teamId: team.id, itemId: m.userId, roleId: null }), `@${m.username} has the default member role.`);
                            }}
                          >
                            Member (default)
                          </MenuItem>
                          {assignable.map((r) => (
                            <MenuItem
                              key={r.id}
                              active={m.customRole?.id === r.id}
                              onSelect={() => {
                                close();
                                run(() => setMemberCustomRole({ teamId: team.id, itemId: m.userId, roleId: r.id }), `@${m.username} is now ${r.name}.`);
                              }}
                            >
                              <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                              {r.name}
                            </MenuItem>
                          ))}
                        </>
                      )}
                      {ownerActions && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            confirmIt({
                              title: "Transfer ownership?",
                              description: <>@{m.username} becomes the owner of {team.name}, with full control including deleting it. You become a co-owner.</>,
                              confirmLabel: "Transfer ownership",
                              level: { kind: "type", phrase: team.name, what: "team name" },
                              onConfirm: () => run(() => transferOwnership({ teamId: team.id, itemId: m.userId }), `@${m.username} now owns ${team.name}.`),
                            });
                          }}
                        >
                          Make owner…
                        </MenuItem>
                      )}
                      {removable && (
                        <MenuItem
                          onSelect={() => {
                            close();
                            confirmIt({
                              title: `Remove @${m.username}?`,
                              description: <>They lose access to {team.name} straight away and are taken off every task and subtask. You can invite them again later.</>,
                              confirmLabel: "Remove member",
                              level: { kind: "ack" },
                              onConfirm: () => run(() => removeMember({ teamId: team.id, itemId: m.userId }), `Removed @${m.username}.`),
                            });
                          }}
                        >
                          <span className="text-rose">Remove from team</span>
                        </MenuItem>
                      )}
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
                <Monogram name={i.username} color={i.accentColor} src={i.imageUrl} size={30} />
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

/* ── Roles ──────────────────────────────────────────────────────────────── */

const GROUPS = [...new Set(GRANTABLE.map((p) => PERMISSION_INFO[p].group))];

function Roles({ team, can, run, confirmIt, roles }: Shared & { roles: RoleRow[] }) {
  const manage = can("roles.manage");
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);

  return (
    <Card
      id="roles"
      title="Roles"
      note="Built-in roles are fixed. Custom roles let the owner and co-owners decide exactly what other members can do."
      action={manage && <button type="button" onClick={() => setEditing("new")} className={cx(btn.primary, btn.sm)}>New role</button>}
    >
      <ul className="space-y-2">
        <BuiltIn name="Owner" color={ROLE_COLOR.OWNER} note="Everything, including deleting the team and its projects, and choosing co-owners." />
        <BuiltIn name="Co-owner" color={ROLE_COLOR.CO_OWNER} note="Everything except deleting the team or projects and choosing co-owners. Manages custom roles." />
        <BuiltIn
          name="Member (default)"
          note={`${DEFAULT_MEMBER.map((p) => PERMISSION_INFO[p].label).join(", ")}, spark ideas, and work on and finish tasks assigned to them.`}
        />
        {roles.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink">
                {r.name} <span className="font-normal text-ink-3">· {r.members} member{r.members === 1 ? "" : "s"}</span>
              </span>
              <span className="block text-[12px] text-ink-3">
                {r.permissions.length ? r.permissions.filter((p): p is Grantable => p in PERMISSION_INFO).map((p) => PERMISSION_INFO[p].label).join(", ") : "No extra permissions"}
              </span>
            </span>
            {manage && (
              <span className="flex gap-1">
                <button type="button" onClick={() => setEditing(r)} className={cx(btn.ghost, btn.xs)}>Edit</button>
                <button
                  type="button"
                  onClick={() =>
                    confirmIt({
                      title: `Delete the ${r.name} role?`,
                      description: <>{r.members ? `${r.members} member${r.members === 1 ? "" : "s"} will go back to the default member role.` : "Nobody has this role."}</>,
                      confirmLabel: "Delete role",
                      level: { kind: "ack" },
                      onConfirm: () => run(() => deleteTeamRole({ teamId: team.id, itemId: r.id }), "Role deleted."),
                    })
                  }
                  className={cx(btn.ghost, btn.xs, "text-rose hover:text-rose")}
                >
                  Delete
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <RoleDialog key={editing === "new" ? "new" : editing?.id ?? "closed"} team={team} role={editing} onClose={() => setEditing(null)} run={run} />
      )}
    </Card>
  );
}

function BuiltIn({ name, note, color }: { name: string; note: string; color?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl p-3 shadow-highlight">
      <span className="size-2.5 shrink-0 rounded-full bg-ink-3" style={color ? { backgroundColor: color } : undefined} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{name} <span className="text-[12px] font-normal text-ink-3">built in</span></span>
        <span className="block text-[12px] text-ink-3">{note}</span>
      </span>
    </li>
  );
}

function RoleDialog({ team, role, onClose, run }: { team: Team; role: RoleRow | "new" | null; onClose: () => void; run: Run }) {
  const existing = role && role !== "new" ? role : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState<string>(existing?.color ?? ROLE_COLORS[0]);
  const [picked, setPicked] = useState<Grantable[]>((existing?.permissions.filter((p): p is Grantable => p in PERMISSION_INFO)) ?? [...DEFAULT_MEMBER]);
  const toggle = (p: Grantable) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return;
    const permissions = GRANTABLE.filter((p) => picked.includes(p));
    const c = color as (typeof ROLE_COLORS)[number];
    onClose();
    if (existing) run(() => updateTeamRole({ teamId: team.id, itemId: existing.id, name: n, color: c, permissions }), `${n} saved.`);
    else run(() => createTeamRole({ teamId: team.id, name: n, color: c, permissions }), `${n} created. Give it to members from the list above.`);
  };

  return (
    <Dialog open={!!role} onClose={onClose} size="lg" title={existing ? `Edit ${existing.name}` : "New role"} description="Choose a name and exactly what people with this role can do.">
      <form onSubmit={submit} className="space-y-5 pt-1">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="role-name" className="block text-sm font-medium text-ink">Name</label>
            <input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={30} placeholder="e.g. Project lead" className={cx(inputCls, "mt-1.5 h-10")} />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Colour</legend>
            <div className="mt-1.5 flex h-10 items-center gap-1.5">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cx("size-6 rounded-full transition-transform active:scale-90", color === c && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
        </div>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <fieldset key={g}>
              <legend className="text-[12px] font-medium uppercase tracking-wide text-ink-3">{g}</legend>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {GRANTABLE.filter((p) => PERMISSION_INFO[p].group === g).map((p) => (
                  <label key={p} className={cx("flex cursor-pointer items-start gap-2.5 rounded-xl p-2.5 transition-colors", picked.includes(p) ? "bg-surface-2" : "hover:bg-tint/[0.03]")}>
                    <input type="checkbox" checked={picked.includes(p)} onChange={() => toggle(p)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
                    <span>
                      <span className="block text-[14px] text-ink">{PERMISSION_INFO[p].label}</span>
                      <span className="block text-[12px] text-ink-3">{PERMISSION_INFO[p].note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-[12px] text-ink-3">
            Everyone can always spark ideas, manage their own ideas, and work on and finish tasks assigned to them. Deleting projects and the team stays with the owner.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>Cancel</button>
          <button type="submit" disabled={name.trim().length < 2} className={cx(btn.primary, btn.sm)}>{existing ? "Save role" : "Create role"}</button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Tags ───────────────────────────────────────────────────────────────── */

const tagName = (v: string) => v.toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]/g, "").slice(0, 24);

function Tags({ team, can, run, confirmIt, tags }: Shared & { tags: TagDTO[] }) {
  const manage = can("tags.manage");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PALETTE[0]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = tagName(name);
    if (!n) return;
    setName("");
    run(() => createTag({ teamId: team.id, name: n, color: color as (typeof TAG_PALETTE)[number] }), `#${n} added.`);
  };

  return (
    <Card id="tags" title={`Tags · ${tags.length}`} note={manage ? "The tags people can put on ideas. Renaming or deleting a tag updates every idea that uses it." : "The tags people can put on ideas."}>
      <ul className="-mx-2 space-y-0.5">
        {tags.map((t) => (
          <TagRow key={t.id} tag={t} manage={manage} team={team} run={run} confirmIt={confirmIt} />
        ))}
        {!tags.length && <li className="px-2 text-[14px] text-ink-3">No tags yet.</li>}
      </ul>
      {manage && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="font-mono text-sm text-ink-3">#</span>
          <input
            value={name}
            onChange={(e) => setName(tagName(e.target.value))}
            maxLength={24}
            aria-label="New tag name"
            placeholder="new-tag"
            className={cx(inputCls, "h-9 w-44 font-mono")}
          />
          <ColorDots value={color} onChange={setColor} />
          <button type="submit" disabled={!name} className={cx(btn.primary, btn.sm)}>Add tag</button>
        </form>
      )}
    </Card>
  );
}

function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <span className="flex items-center gap-1" role="radiogroup" aria-label="Tag colour">
      {TAG_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          className={cx("size-5 rounded-full transition-transform active:scale-90", value === c && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]")}
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}

function TagRow({ tag, manage, team, run, confirmIt }: { tag: TagDTO; manage: boolean; team: Team; run: Run; confirmIt: (a: Ask) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-2 py-2">
        <span className="font-mono text-sm text-ink-3">#</span>
        <input value={name} onChange={(e) => setName(tagName(e.target.value))} maxLength={24} aria-label="Tag name" className={cx(inputCls, "h-8 w-40 font-mono")} />
        <ColorDots value={color} onChange={setColor} />
        <span className="flex-1" />
        <button type="button" onClick={() => { setEditing(false); setName(tag.name); setColor(tag.color); }} className={cx(btn.ghost, btn.xs)}>Cancel</button>
        <button
          type="button"
          disabled={!name}
          onClick={() => {
            setEditing(false);
            run(() => updateTag({ teamId: team.id, itemId: tag.id, name, color: color as (typeof TAG_PALETTE)[number] }), `#${name} saved.`);
          }}
          className={cx(btn.primary, btn.xs)}
        >
          Save
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-tint/[0.03]">
      <Pill color={tag.color}>#{tag.name}</Pill>
      <span className="flex-1" />
      {manage && (
        <>
          <button type="button" onClick={() => setEditing(true)} className={cx(btn.ghost, btn.xs)}>Edit</button>
          <button
            type="button"
            onClick={() =>
              confirmIt({
                title: `Delete #${tag.name}?`,
                description: <>The tag is removed from every idea that has it. The ideas themselves stay.</>,
                confirmLabel: "Delete tag",
                level: { kind: "ack" },
                onConfirm: () => run(() => deleteTag({ teamId: team.id, itemId: tag.id }), `#${tag.name} deleted.`),
              })
            }
            className={cx(btn.ghost, btn.xs, "text-rose hover:text-rose")}
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}

/* ── Projects ───────────────────────────────────────────────────────────── */

function Projects({ team, viewerId, can, run, confirmIt, projects }: Shared & { projects: ManagedIdea[] }) {
  return (
    <Card id="projects" title={`Projects · ${projects.length}`} note="Archiving is reversible. Only the owner can delete projects.">
      {projects.length ? (
        <ul className="-mx-2 space-y-0.5">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            const canArchive = p.authorId === viewerId || can("projects.archive");
            const canDelete = can("projects.delete");
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
                <span className="text-violet" aria-hidden>◆</span>
                <span className="min-w-0 flex-1">
                  <Link href={`/dashboard/${team.slug}?view=board&project=${p.id}`} className="block truncate text-[14px] font-medium text-ink hover:underline">{p.title}</Link>
                  <span className="block text-xs text-ink-3">{p.taskCount} task{p.taskCount === 1 ? "" : "s"} · {pct}% done</span>
                </span>
                {canArchive || canDelete ? (
                  <Popover label={`Manage ${p.title}`} align="end" triggerClassName="size-8 justify-center text-ink-3 hover:text-ink" trigger={dots}>
                    {(close) => (
                      <>
                        {canArchive && (
                          <MenuItem
                            onSelect={() => {
                              close();
                              confirmIt({
                                title: "Archive project?",
                                description: <>&ldquo;{p.title}&rdquo; leaves Execution. You can restore it from the archive below.</>,
                                confirmLabel: "Archive project",
                                tone: "neutral",
                                level: { kind: "plain" },
                                onConfirm: () => run(() => archiveIdea({ teamId: team.id, itemId: p.id }), "Project archived."),
                              });
                            }}
                          >
                            Archive
                          </MenuItem>
                        )}
                        {canDelete && (
                          <MenuItem
                            onSelect={() => {
                              close();
                              confirmIt({
                                title: "Delete project?",
                                description: <>&ldquo;{p.title}&rdquo; and its description will be deleted for everyone on the team.</>,
                                confirmLabel: "Delete project",
                                level: { kind: "type", phrase: p.title, what: "project name" },
                                tasks: p.taskCount,
                                onConfirm: (withTasks) =>
                                  run(() => deleteIdea({ teamId: team.id, itemId: p.id, confirm: p.title, withTasks }), withTasks ? "Project and its tasks deleted." : "Project deleted."),
                              });
                            }}
                          >
                            <span className="text-rose">Delete project</span>
                          </MenuItem>
                        )}
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
        <p className="text-[14px] text-ink-3">No projects yet.</p>
      )}
    </Card>
  );
}

/* ── Archive ────────────────────────────────────────────────────────────── */

function Archive({ team, viewerId, can, run, confirmIt, archived }: Shared & { archived: ManagedIdea[] }) {
  return (
    <Card id="archive" title={`Archive · ${archived.length}`} note="Archived ideas and projects. Restore them, or delete them for good.">
      {archived.length ? (
        <ul className="-mx-2 space-y-0.5">
          {archived.map((i) => {
            const own = i.authorId === viewerId;
            const canRestore = own || can(i.isProject ? "projects.archive" : "ideas.manage");
            const canDelete = i.isProject ? can("projects.delete") : own || can("ideas.manage");
            return (
              <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-tint/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{i.title}</span>
                  <span className="block text-xs text-ink-3" suppressHydrationWarning>
                    {i.isProject ? `Project · ${i.taskCount} task${i.taskCount === 1 ? "" : "s"}` : "Idea"} · archived {timeAgo(i.updatedAt)}
                  </span>
                </span>
                {canRestore && (
                  <button type="button" onClick={() => run(() => restoreIdea({ teamId: team.id, itemId: i.id }), i.isProject ? "Restored to Execution." : "Restored to the idea vault.")} className={cx(btn.ghost, btn.xs)}>
                    Restore
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() =>
                      confirmIt({
                        title: "Delete for good?",
                        description: <>&ldquo;{i.title}&rdquo; will be permanently deleted.</>,
                        confirmLabel: "Delete",
                        level: { kind: "ack" },
                        tasks: i.isProject ? i.taskCount : 0,
                        onConfirm: (withTasks) => run(() => deleteIdea({ teamId: team.id, itemId: i.id, withTasks }), "Deleted."),
                      })
                    }
                    className={cx(btn.ghost, btn.xs, "text-rose hover:text-rose")}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
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

function Danger({ team, myRole, can, run, confirmIt, archivedCount, shippedCount, onGone }: Shared & { archivedCount: number; shippedCount: number; onGone: () => void }) {
  const typed: ConfirmLevel = { kind: "type", phrase: team.name, what: "team name" };
  const cleanup = can("team.cleanup");
  return (
    <Card id="danger" title={myRole === "OWNER" || cleanup ? "Danger zone" : "Leave team"} note="These can't be undone." tone="danger">
      {cleanup && (
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
                  description: <>All {shippedCount} finished tasks in {team.name} will be permanently deleted, with their notes and subtasks.</>,
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
      {cleanup && (
        <DangerRow
          title="Empty the archive"
          note={can("projects.delete") ? "Permanently deletes every archived idea and project. Their tasks stay." : "Permanently deletes archived ideas. Archived projects stay (only the owner deletes projects)."}
          action={
            <button
              type="button"
              disabled={!archivedCount}
              onClick={() =>
                confirmIt({
                  title: "Empty the archive?",
                  description: <>Archived items in {team.name} will be permanently deleted. Tasks that belonged to them stay on the board.</>,
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
          note="Deletes the team with every idea, project, task, role and invite, for everyone. To leave instead, make someone else the owner first."
          action={
            <button
              type="button"
              onClick={() =>
                confirmIt({
                  title: `Delete ${team.name}?`,
                  description: <>Every idea, project, task, role, member and invite in {team.name} will be permanently deleted for everyone.</>,
                  confirmLabel: "Delete team",
                  level: typed,
                  onConfirm: () => run(() => deleteTeam({ teamId: team.id, confirm: team.name }), `${team.name} was deleted.`, onGone),
                })
              }
              className="inline-flex h-8 items-center rounded-lg bg-rose px-3 text-[13px] font-medium text-white transition-[filter] hover:brightness-110"
            >
              Delete team
            </button>
          }
        />
      ) : (
        <DangerRow
          title="Leave team"
          note="You lose access to this team and come off every task and subtask."
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
