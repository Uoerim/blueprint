import type { Metadata } from "next";
import { requireTeamPage } from "@/lib/auth";
import { decryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { permissionsFor } from "@/lib/team-permissions";
import { visibleTasks } from "@/lib/task-visibility";
import { type ManagedIdea, TeamSettings } from "./team-settings";

export async function generateMetadata({ params }: PageProps<"/dashboard/[teamSlug]/settings">): Promise<Metadata> {
  const { teamSlug } = await params;
  return { title: `Settings · ${teamSlug.replace(/-/g, " ")}` };
}

export default async function TeamSettingsPage({ params }: PageProps<"/dashboard/[teamSlug]/settings">) {
  const { teamSlug } = await params;
  // Session check and membership in one wait; 404 unless you're in this team.
  const { user, team, me } = await requireTeamPage(teamSlug);
  const perms = permissionsFor(me.role, me.customRole?.permissions);
  const has = (p: (typeof perms)[number]) => perms.includes(p);
  const taskWhere = visibleTasks(team.id, user.id, has("tasks.viewPrivate"));

  const [members, invites, roles, ideas, shippedCount, tags] = await Promise.all([
    db.teamMember.findMany({
      where: { teamId: team.id },
      select: {
        role: true,
        joinedAt: true,
        customRole: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, username: true, displayName: true, accentColor: true, imageUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    has("members.invite")
      ? db.teamInvite.findMany({
          where: { teamId: team.id, status: "PENDING" },
          select: { id: true, createdAt: true, invitee: { select: { username: true, accentColor: true, imageUrl: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.teamRole.findMany({
      where: { teamId: team.id },
      select: { id: true, name: true, color: true, permissions: true, _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.idea.findMany({
      where: { teamId: team.id, status: { in: ["PROMOTED", "ARCHIVED"] } },
      select: {
        id: true,
        title: true,
        status: true,
        createdById: true,
        updatedAt: true,
        tasks: { where: taskWhere, select: { status: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    has("team.cleanup") ? db.task.count({ where: { teamId: team.id, status: "DONE" } }) : Promise.resolve(0),
    db.teamTag.findMany({ where: { teamId: team.id }, select: { id: true, name: true, color: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const managed = (status: "PROMOTED" | "ARCHIVED"): ManagedIdea[] =>
    ideas
      .filter((i) => i.status === status)
      .map((i) => ({
        id: i.id,
        title: decryptText(i.title, team.id),
        authorId: i.createdById,
        // Counts shown are what the viewer can see; isProject uses the real count so the rules match the server.
        taskCount: i.tasks.length,
        doneCount: i.tasks.filter((t) => t.status === "DONE").length,
        isProject: i.status === "PROMOTED" || i._count.tasks > 0,
        updatedAt: i.updatedAt.toISOString(),
      }));

  return (
    <TeamSettings
      team={team}
      viewerId={user.id}
      myRole={me.role}
      perms={perms}
      members={members.map((m) => ({
        userId: m.user.id,
        username: m.user.username ?? "unknown",
        displayName: m.user.displayName,
        accentColor: m.user.accentColor,
        imageUrl: m.user.imageUrl,
        role: m.role,
        customRole: m.role === "MEMBER" ? m.customRole : null,
        joinedAt: m.joinedAt.toISOString(),
      }))}
      invites={invites.map((i) => ({
        id: i.id,
        username: i.invitee.username ?? "unknown",
        accentColor: i.invitee.accentColor,
        imageUrl: i.invitee.imageUrl,
        createdAt: i.createdAt.toISOString(),
      }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name, color: r.color, permissions: r.permissions, members: r._count.members }))}
      projects={managed("PROMOTED")}
      archived={managed("ARCHIVED")}
      shippedCount={shippedCount}
      tags={tags}
    />
  );
}
