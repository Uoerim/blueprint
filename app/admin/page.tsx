import Link from "next/link";
import { Monogram, readable } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, PageTitle, RolePill, Stat, StatusPill } from "./_components/ui";

export const metadata = { title: "Overview" };

/** Server-side only: a request-time cutoff for "new this week". */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function AdminOverview() {
  await requireStaffPage();
  const weekAgo = daysAgo(7);
  const live = { deletedAt: null };

  // Counts and metadata only: the admin panel never reads or decrypts team content.
  const [accounts, newThisWeek, suspended, staff, teams, ideas, tasks, shipped, focus, security, openReports, recent, actions] = await Promise.all([
    db.user.count({ where: { ...live, onboarded: true } }),
    db.user.count({ where: { ...live, createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { ...live, bannedAt: { not: null } } }),
    db.user.count({ where: { ...live, siteRole: { not: "USER" } } }),
    db.team.count(),
    db.idea.count(),
    db.task.count(),
    db.task.count({ where: { status: "DONE" } }),
    db.taskAssignee.count({ where: { focusedAt: { not: null }, task: { status: "IN_PROGRESS" } } }),
    db.auditLog.count({ where: { action: { startsWith: "security." }, createdAt: { gte: daysAgo(1) } } }),
    db.bugReport.count({ where: { status: "OPEN" } }),
    db.user.findMany({
      where: live,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, username: true, email: true, accentColor: true, siteRole: true, bannedAt: true, onboarded: true, createdAt: true },
    }),
    db.auditLog.findMany({
      where: { action: { startsWith: "admin." } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, action: true, userId: true, entityId: true, createdAt: true },
    }),
  ]);
  const actorIds = [...new Set(actions.flatMap((a) => [a.userId, a.entityId]))];
  const names = new Map(
    (await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true, deletedUsername: true } })).map((u) => [
      u.id,
      u.username ?? (u.deletedUsername ? `${u.deletedUsername} (deleted)` : null),
    ]),
  );

  return (
    <>
      <PageTitle
        title="Overview"
        note="Platform metadata and aggregate counts only. Team content is encrypted per team and is never read or decrypted by the admin panel."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Accounts" value={accounts} />
        <Stat label="New this week" value={newThisWeek} tone="emerald" />
        <Stat label="Suspended" value={suspended} tone="rose" />
        <Stat label="Staff" value={staff} tone="amber" />
        <Stat label="Teams" value={teams} />
        <Stat label="Ideas" value={ideas} />
        <Stat label="Tasks" value={tasks} />
        <Stat label="Tasks shipped" value={shipped} />
        <Stat label="In focus now" value={focus} tone="emerald" />
        <Stat label="Security events (24h)" value={security} tone={security ? "rose" : undefined} />
        <Stat label="Open feedback" value={openReports} tone={openReports ? "amber" : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <section className="card rounded-2xl p-5" aria-labelledby="recent-h">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-h" className="text-[15px] font-semibold">Newest accounts</h2>
            <Link href="/admin/users" className="text-[13px] text-ink-3 hover:text-ink">All accounts →</Link>
          </div>
          <ul className="-mx-2 mt-3 space-y-0.5">
            {recent.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-tint/[0.04]">
                  <Monogram name={u.username ?? u.email} color={u.accentColor} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px]" style={{ color: readable(u.accentColor) }}>
                      {u.username ? `@${u.username}` : "(no username yet)"}
                    </span>
                    <span className="block truncate text-xs text-ink-3">{fmtDateTime(u.createdAt)}</span>
                  </span>
                  <RolePill role={u.siteRole} />
                  <StatusPill banned={!!u.bannedAt} deleted={false} onboarded={u.onboarded} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card rounded-2xl p-5" aria-labelledby="actions-h">
          <div className="flex items-baseline justify-between">
            <h2 id="actions-h" className="text-[15px] font-semibold">Recent staff actions</h2>
            <Link href="/admin/audit" className="text-[13px] text-ink-3 hover:text-ink">Audit log →</Link>
          </div>
          {actions.length ? (
            <ul className="mt-3 space-y-2 text-[13px]">
              {actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-ink">@{names.get(a.userId) ?? "unknown"}</span>
                  <span className="text-ink-2">{a.action.replace(/^admin\./, "").replace(/\./g, " ")}</span>
                  {names.get(a.entityId) !== undefined && <span className="font-mono text-ink-2">@{names.get(a.entityId) ?? "deleted"}</span>}
                  <span className="ml-auto text-xs text-ink-3">{fmtDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-3">No staff actions yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
