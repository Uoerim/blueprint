import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { cx, Monogram, readable } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, PAGE_SIZE, PageTitle, Pager, pageOf, queryOf, RolePill, SearchBox, StatusPill, Table } from "../_components/ui";

export const metadata = { title: "Accounts" };

const FILTERS = [
  ["all", "All"],
  ["staff", "Staff"],
  ["suspended", "Suspended"],
  ["deleted", "Deleted"],
] as const;
type Filter = (typeof FILTERS)[number][0];

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  await requireStaffPage();
  const sp = await searchParams;
  const q = queryOf(sp.q);
  const page = pageOf(sp.page);
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: Filter = FILTERS.some(([f]) => f === raw) ? (raw as Filter) : "all";

  const where: Prisma.UserWhereInput = {
    ...(filter === "deleted" ? { deletedAt: { not: null } } : { deletedAt: null }),
    ...(filter === "staff" && { siteRole: { not: "USER" } }),
    ...(filter === "suspended" && { bannedAt: { not: null } }),
    ...(q && {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        accentColor: true,
        imageUrl: true,
        siteRole: true,
        onboarded: true,
        bannedAt: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);

  return (
    <>
      <PageTitle title="Accounts" note="Look up anyone by username, name or email. Open an account to change its role, suspend it or delete it.">
        <SearchBox action="/admin/users" q={q} placeholder="Username, name or email">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </SearchBox>
      </PageTitle>

      <nav aria-label="Filter accounts" className="mt-5 flex flex-wrap gap-1.5 text-[13px]">
        {FILTERS.map(([f, label]) => (
          <Link
            key={f}
            href={`/admin/users?${new URLSearchParams({ ...(q && { q }), ...(f !== "all" && { filter: f }) })}`}
            aria-current={filter === f ? "page" : undefined}
            className={cx(
              "rounded-lg px-2.5 py-1 shadow-highlight transition-colors",
              filter === f ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Table head={["Account", "Colour", "Email", "Role", "Status", "Teams", "Joined"]} empty={!users.length}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-tint/[0.03]">
            <td className="px-4 py-2.5">
              <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5">
                <Monogram name={u.username ?? u.email} color={u.accentColor} src={u.imageUrl} size={26} />
                <span className="min-w-0">
                  <span className="block font-mono text-[13px]" style={{ color: readable(u.accentColor) }}>
                    {u.username ? `@${u.username}` : u.deletedAt ? "(deleted)" : "(no username)"}
                  </span>
                  {u.displayName && <span className="block truncate text-xs text-ink-3">{u.displayName}</span>}
                </span>
              </Link>
            </td>
            <td className="px-4 py-2.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase text-ink-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: u.accentColor }} aria-hidden />
                {u.accentColor}
              </span>
            </td>
            <td className="max-w-[240px] truncate px-4 py-2.5 text-ink-2">{u.deletedAt ? "None" : u.email}</td>
            <td className="px-4 py-2.5"><RolePill role={u.siteRole} /></td>
            <td className="px-4 py-2.5"><StatusPill banned={!!u.bannedAt} deleted={!!u.deletedAt} onboarded={u.onboarded} /></td>
            <td className="px-4 py-2.5 tabular-nums text-ink-2">{u._count.memberships}</td>
            <td className="px-4 py-2.5 text-ink-3">{fmtDate(u.createdAt)}</td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/users" page={page} total={total} params={{ ...(q && { q }), ...(filter !== "all" && { filter }) }} />
    </>
  );
}
