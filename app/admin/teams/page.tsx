import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { readable } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/site-roles";
import { fmtDate, PAGE_SIZE, PageTitle, Pager, pageOf, queryOf, SearchBox, Table } from "../_components/ui";
import { DeleteTeamButton } from "./delete-team-button";

export const metadata = { title: "Teams" };

export default async function AdminTeams({ searchParams }: PageProps<"/admin/teams">) {
  const me = await requireStaffPage();
  const sp = await searchParams;
  const q = queryOf(sp.q);
  const page = pageOf(sp.page);
  const canDelete = can(me.siteRole, "teams.delete");

  const where: Prisma.TeamWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] }
    : {};

  const [total, teams] = await Promise.all([
    db.team.count({ where }),
    db.team.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        members: { where: { role: "OWNER" }, select: { user: { select: { id: true, username: true, accentColor: true } } }, take: 1 },
        _count: { select: { members: true, ideas: true, tasks: true } },
      },
    }),
  ]);

  return (
    <>
      <PageTitle
        title="Teams"
        note="Every team on Blueprint, with counts only. Ideas and tasks are encrypted with each team's own key and are not readable here."
      >
        <SearchBox action="/admin/teams" q={q} placeholder="Team name or slug" />
      </PageTitle>

      <Table head={["Team", "Owner", "Members", "Ideas", "Tasks", "Created", ""]} empty={!teams.length}>
        {teams.map((t) => {
          const owner = t.members[0]?.user;
          return (
            <tr key={t.id} className="hover:bg-tint/[0.03]">
              <td className="px-4 py-2.5">
                <span className="block text-ink">{t.name}</span>
                <span className="block font-mono text-xs text-ink-3">/{t.slug}</span>
              </td>
              <td className="px-4 py-2.5">
                {owner ? (
                  <Link href={`/admin/users/${owner.id}`} className="font-mono hover:underline" style={{ color: readable(owner.accentColor) }}>
                    @{owner.username ?? "deleted"}
                  </Link>
                ) : (
                  <span className="text-ink-3">None</span>
                )}
              </td>
              <td className="px-4 py-2.5 tabular-nums text-ink-2">{t._count.members}</td>
              <td className="px-4 py-2.5 tabular-nums text-ink-2">{t._count.ideas}</td>
              <td className="px-4 py-2.5 tabular-nums text-ink-2">{t._count.tasks}</td>
              <td className="px-4 py-2.5 text-ink-3">{fmtDate(t.createdAt)}</td>
              <td className="px-4 py-2.5 text-right">{canDelete && <DeleteTeamButton team={{ id: t.id, name: t.name }} />}</td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/teams" page={page} total={total} params={q ? { q } : {}} />
    </>
  );
}
