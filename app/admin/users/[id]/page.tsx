import Link from "next/link";
import { notFound } from "next/navigation";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, outranks } from "@/lib/site-roles";
import { id as idSchema } from "@/lib/validations";
import { fmtDate, fmtDateTime, RolePill, StatusPill } from "../../_components/ui";
import { UserActions } from "./user-actions";

export const metadata = { title: "Account" };

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireStaffPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      clerkId: true,
      username: true,
      displayName: true,
      email: true,
      accentColor: true,
      siteRole: true,
      onboarded: true,
      bannedAt: true,
      banReason: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: { role: true, joinedAt: true, team: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { ideasCreated: true, tasksCreated: true, tasksAssigned: true } },
    },
  });
  if (!user) notFound();

  const [shipped, history] = await Promise.all([
    db.task.count({ where: { assigneeId: user.id, status: "DONE" } }),
    db.auditLog.findMany({
      where: { OR: [{ userId: user.id }, { entityId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, action: true, userId: true, ipAddress: true, createdAt: true },
    }),
  ]);
  const actors = new Map(
    (await db.user.findMany({ where: { id: { in: [...new Set(history.map((h) => h.userId))] } }, select: { id: true, username: true } })).map((u) => [
      u.id,
      u.username,
    ]),
  );

  const isMe = user.id === me.id;
  const reachable = !isMe && !user.deletedAt && outranks(me.siteRole, user.siteRole);
  const perms = {
    suspend: reachable && can(me.siteRole, "users.suspend"),
    signout: reachable && can(me.siteRole, "users.signout"),
    role: reachable && can(me.siteRole, "users.role"),
    delete: reachable && can(me.siteRole, "users.delete"),
  };
  const showIp = me.siteRole === "ADMIN";

  return (
    <>
      <Link href="/admin/users" className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> All accounts
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Monogram name={user.username ?? user.email} color={user.accentColor} size={56} />
        <div className="min-w-0">
          <h1 className="font-mono text-2xl font-semibold tracking-tight" style={{ color: readable(user.accentColor) }}>
            {user.username ? `@${user.username}` : user.deletedAt ? "Deleted account" : "No username yet"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
            {user.displayName && <span>{user.displayName}</span>}
            <RolePill role={user.siteRole} />
            <StatusPill banned={!!user.bannedAt} deleted={!!user.deletedAt} onboarded={user.onboarded} />
            {isMe && <span className="text-ink-3">(you)</span>}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="card rounded-2xl p-5" aria-labelledby="info-h">
            <h2 id="info-h" className="text-[15px] font-semibold">Details</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              {[
                ["Email", user.deletedAt ? "Scrubbed" : user.email],
                ["Account id", user.id],
                ["Joined", fmtDateTime(user.createdAt)],
                ["Last updated", fmtDateTime(user.updatedAt)],
                ["Sign-in", user.clerkId.startsWith("user_") ? "Clerk" : user.clerkId.startsWith("seed_") ? "Demo account (no sign-in)" : "None"],
                ["Suspended", user.bannedAt ? fmtDateTime(user.bannedAt) : "No"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="mt-0.5 break-all text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {user.banReason && (
              <p className="mt-4 rounded-xl bg-rose/[0.07] p-3 text-[13px] text-ink-2">
                <span className="block text-[12px] text-rose">Suspension reason</span>
                {user.banReason}
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Ideas", user._count.ideasCreated],
                ["Tasks created", user._count.tasksCreated],
                ["Assigned", user._count.tasksAssigned],
                ["Shipped", shipped],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-[12px] text-ink-3">{k}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card rounded-2xl p-5" aria-labelledby="teams-h">
            <h2 id="teams-h" className="text-[15px] font-semibold">Teams · {user.memberships.length}</h2>
            {user.memberships.length ? (
              <ul className="mt-3 divide-y divide-line text-[13px]">
                {user.memberships.map((m) => (
                  <li key={m.team.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{m.team.name}</span>
                      <span className="block font-mono text-xs text-ink-3">/{m.team.slug} · {m.team._count.members} members</span>
                    </span>
                    <span className="text-xs text-ink-2">{m.role.toLowerCase()}</span>
                    <span className="text-xs text-ink-3">since {fmtDate(m.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-ink-3">Not in any team.</p>
            )}
          </section>

          <section className="card rounded-2xl p-5" aria-labelledby="history-h">
            <h2 id="history-h" className="text-[15px] font-semibold">Activity</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">Actions by or on this account. Content is never logged.</p>
            {history.length ? (
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                    {h.userId !== user.id && <span className="font-mono text-ink">@{actors.get(h.userId) ?? "unknown"}</span>}
                    <span className="text-ink-2">{h.action}</span>
                    {showIp && <span className="font-mono text-[11px] text-ink-3">{h.ipAddress}</span>}
                    <span className="ml-auto text-xs text-ink-3">{fmtDateTime(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-ink-3">Nothing recorded.</p>
            )}
          </section>
        </div>

        <UserActions
          user={{ id: user.id, username: user.username, siteRole: user.siteRole, banned: !!user.bannedAt, deleted: !!user.deletedAt }}
          perms={perms}
          isMe={isMe}
        />
      </div>
    </>
  );
}
