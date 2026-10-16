import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { openReport } from "@/lib/bug-reports";
import { db } from "@/lib/db";
import { can } from "@/lib/site-roles";
import { fmtDateTime, PAGE_SIZE, PageTitle, Pager, pageOf } from "../_components/ui";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "Bug reports" };

const FILTERS = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["all", "All"],
] as const;
type Filter = (typeof FILTERS)[number][0];

/**
 * Bug reports sent from the Contact support window. Support staff and above.
 * Each shows who sent it, the page and device, and the text, decrypted here
 * with the bug-report key only (it can't open team content).
 */
export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const me = await requireStaffPage("reports.view");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const filter: Filter = raw === "resolved" || raw === "all" ? raw : "open";
  const where: Prisma.BugReportWhereInput = filter === "all" ? {} : { status: filter === "open" ? "OPEN" : "RESOLVED" };

  const [total, openCount, rows] = await Promise.all([
    db.bugReport.count({ where }),
    db.bugReport.count({ where: { status: "OPEN" } }),
    db.bugReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        username: true,
        body: true,
        page: true,
        device: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        resolvedById: true,
        user: { select: { username: true } },
      },
    }),
  ]);
  const resolverIds = [...new Set(rows.map((r) => r.resolvedById).filter((v): v is string => !!v))];
  const resolvers = new Map(
    (await db.user.findMany({ where: { id: { in: resolverIds } }, select: { id: true, username: true } })).map((u) => [u.id, u.username]),
  );
  const canResolve = can(me.siteRole, "reports.resolve");

  return (
    <>
      <PageTitle
        title="Bug reports"
        note="Sent from the Contact support window. Each report carries the page it came from and a short device summary, never the full browser details. The text is encrypted at rest."
      />
      <nav aria-label="Filter" className="mt-5 flex gap-1.5 text-[13px]">
        {FILTERS.map(([f, label]) => (
          <Link
            key={f}
            href={f === "open" ? "/admin/reports" : `/admin/reports?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cx(
              "rounded-lg px-2.5 py-1 shadow-highlight transition-colors",
              filter === f ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {label}
            {f === "open" && <span className="ml-1.5 font-mono text-[11px] opacity-70">{openCount}</span>}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const name = r.user?.username ?? r.username;
            return (
              <li key={r.id} className="card rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <span
                    className={cx(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                      r.status === "OPEN" ? "bg-amber/15 text-amber" : "bg-emerald/12 text-emerald",
                    )}
                  >
                    {r.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                  {r.userId ? (
                    <Link href={`/admin/users/${r.userId}`} className="font-mono text-ink hover:underline">
                      @{name ?? "unknown"}
                    </Link>
                  ) : (
                    <span className="font-mono text-ink-3">@{name ?? "deleted"}</span>
                  )}
                  <span className="text-ink-3">{fmtDateTime(r.createdAt)}</span>
                  {canResolve && (
                    <span className="ml-auto">
                      <ResolveButton reportId={r.id} resolved={r.status === "RESOLVED"} />
                    </span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">{openReport(r.body)}</p>
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-3">
                  {r.page && (
                    <div className="flex gap-1.5">
                      <dt>Page</dt>
                      <dd className="break-all font-mono text-ink-2">{r.page}</dd>
                    </div>
                  )}
                  {r.device && (
                    <div className="flex gap-1.5">
                      <dt>Device</dt>
                      <dd className="text-ink-2">{r.device}</dd>
                    </div>
                  )}
                  {r.status === "RESOLVED" && r.resolvedAt && (
                    <div className="flex gap-1.5">
                      <dt>Resolved</dt>
                      <dd className="text-ink-2">
                        {fmtDateTime(r.resolvedAt)}
                        {r.resolvedById && <> by @{resolvers.get(r.resolvedById) ?? "deleted"}</>}
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card mt-4 rounded-2xl px-6 py-12 text-center">
          <p className="text-[15px] text-ink">{filter === "open" ? "No open bug reports." : filter === "resolved" ? "Nothing resolved yet." : "No bug reports yet."}</p>
          <p className="mt-1 text-sm text-ink-3">Reports sent from the Contact support window show up here.</p>
        </div>
      )}
      <Pager base="/admin/reports" page={page} total={total} params={filter === "open" ? {} : { status: filter }} />
    </>
  );
}
