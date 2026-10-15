import type { Metadata } from "next";
import { getTeamForViewer, requireMembership, requireOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { type ManagedIdea, TeamSettings } from "./team-settings";

export async function generateMetadata({ params }: PageProps<"/dashboard/[teamSlug]/settings">): Promise<Metadata> {
  const { teamSlug } = await params;
  return { title: `Settings · ${teamSlug.replace(/-/g, " ")}` };
}

export default async function TeamSettingsPage({ params }: PageProps<"/dashboard/[teamSlug]/settings">) {
  const user = await requireOnboardedPage();
  const { teamSlug } = await params;
  const team = await getTeamForViewer(teamSlug, user.id);
  const me = await requireMembership(team.id, user.id);

  const [members, invites, ideas, shippedCount] = await Promise.all([
    db.teamMember.findMany({
      where: { teamId: team.id },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, username: true, displayName: true, accentColor: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { teamId: team.id, status: "PENDING" },
      select: { id: true, createdAt: true, invitee: { select: { username: true, accentColor: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.idea.findMany({
      where: { teamId: team.id, status: { in: ["PROMOTED", "ARCHIVED"] } },
      select: { id: true, title: true, status: true, createdById: true, updatedAt: true, tasks: { select: { status: true } } },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    db.task.count({ where: { teamId: team.id, status: "DONE" } }),
  ]);

  const managed = (status: "PROMOTED" | "ARCHIVED"): ManagedIdea[] =>
    ideas
      .filter((i) => i.status === status)
      .map((i) => ({
        id: i.id,
        title: i.title,
        authorId: i.createdById,
        taskCount: i.tasks.length,
        doneCount: i.tasks.filter((t) => t.status === "DONE").length,
        updatedAt: i.updatedAt.toISOString(),
      }));

  return (
    <TeamSettings
      team={team}
      viewerId={user.id}
      myRole={me.role}
      members={members.map((m) => ({
        userId: m.user.id,
        username: m.user.username ?? "unknown",
        displayName: m.user.displayName,
        accentColor: m.user.accentColor,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      }))}
      invites={invites.map((i) => ({
        id: i.id,
        username: i.invitee.username ?? "unknown",
        accentColor: i.invitee.accentColor,
        createdAt: i.createdAt.toISOString(),
      }))}
      projects={managed("PROMOTED")}
      archived={managed("ARCHIVED")}
      shippedCount={shippedCount}
    />
  );
}
