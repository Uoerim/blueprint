import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, PAGE_SIZE, PageTitle, Pager, pageOf, Table } from "../_components/ui";

export const metadata = { title: "Audit log" };

const SCOPES = [
  ["staff", "Staff actions"],
  ["all", "Everything"],
] as const;

export default async function AdminAudit({ searchParams }: PageProps<"/admin/audit">) {
  const me = await requireStaffPage();
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const scope = (Array.isArray(sp.scope) ? sp.scope[0] : sp.scope) === "all" ? "all" : "staff";
  const where: Prisma.AuditLogWhereInput = scope === "staff" ? { action: { startsWith: "admin." } } : {};

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, action: true, userId: true, teamId: true, entityType: true, entityId: true, ipAddress: true, createdAt: true },
    }),
  ]);
  const userIds = [...new Set(rows.flatMap((r) => [r.userId, ...(r.entityType === "User" ? [r.entityId] : [])]))];
  const teamIds = [...new Set(rows.map((r) => r.teamId).filter((v): v is string => !!v))];
  const [users, teams] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } }),
    db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
  ]);
  const uname = new Map(users.map((u) => [u.id, u.username]));
  const tname = new Map(teams.map((t) => [t.id, t.name]));
  const showIp = me.siteRole === "ADMIN";

  return (
    <>
      <PageTitle title="Audit log" note="Who did what, and when. Entries hold ids and action names only, never idea or task text." />
      <nav aria-label="Scope" className="mt-5 flex gap-1.5 text-[13px]">
        {SCOPES.map(([s, label]) => (
          <Link
            key={s}
            href={s === "staff" ? "/admin/audit" : "/admin/audit?scope=all"}
            aria-current={scope === s ? "page" : undefined}
            className={cx(
              "rounded-lg px-2.5 py-1 shadow-highlight transition-colors",
              scope === s ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Table head={["When", "Who", "Action", "Target", "Team", ...(showIp ? ["IP"] : [])]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-2 text-ink-3">{fmtDateTime(r.createdAt)}</td>
            <td className="px-4 py-2">
              <Link href={`/admin/users/${r.userId}`} className="font-mono text-ink hover:underline">
                @{uname.get(r.userId) ?? "deleted"}
              </Link>
            </td>
            <td className="px-4 py-2 font-mono text-[12px] text-ink-2">{r.action}</td>
            <td className="px-4 py-2 text-ink-2">
              {r.entityType === "User" ? (
                <Link href={`/admin/users/${r.entityId}`} className="font-mono hover:underline">
                  @{uname.get(r.entityId) ?? "deleted"}
                </Link>
              ) : (
                <span className="text-ink-3">{r.entityType}</span>
              )}
            </td>
            <td className="px-4 py-2 text-ink-2">{r.teamId ? (tname.get(r.teamId) ?? "deleted team") : "None"}</td>
            {showIp && <td className="px-4 py-2 font-mono text-[12px] text-ink-3">{r.ipAddress}</td>}
          </tr>
        ))}
      </Table>
      <Pager base="/admin/audit" page={page} total={total} params={scope === "all" ? { scope } : {}} />
    </>
  );
}
