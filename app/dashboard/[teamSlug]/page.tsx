import type { Metadata } from "next";
import { getTeamForViewer, requireOnboardedPage } from "@/lib/auth";
import { decryptOptional, decryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { IdeaDTO, MemberDTO, OutgoingInvite, TaskDTO, Viewer } from "@/lib/types";
import { Workspace } from "./workspace";

export async function generateMetadata({ params }: PageProps<"/dashboard/[teamSlug]">): Promise<Metadata> {
  const { teamSlug } = await params;
  return { title: teamSlug.replace(/-/g, " ") };
}

export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/[teamSlug]">) {
  const user = await requireOnboardedPage();
  const { teamSlug } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const team = await getTeamForViewer(teamSlug, user.id);

  // Everything below is scoped to the verified team id, never the URL.
  const [members, ideas, tasks, invites] = await Promise.all([
    db.teamMember.findMany({
      where: { teamId: team.id },
      select: {
        role: true,
        user: { select: { id: true, username: true, displayName: true, accentColor: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.idea.findMany({
      where: { teamId: team.id, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        description: true,
        notes: true,
        tags: true,
        status: true,
        sparksCount: true,
        sparkedByUserIds: true,
        createdById: true,
        createdAt: true,
        tasks: { select: { status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    }),
    db.task.findMany({
      where: { teamId: team.id },
      select: {
        id: true,
        title: true,
        notes: true,
        status: true,
        priority: true,
        isFocused: true,
        assigneeId: true,
        createdById: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        idea: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    }),
    db.teamInvite.findMany({
      where: { teamId: team.id, status: "PENDING" },
      select: { id: true, createdAt: true, invitee: { select: { username: true, accentColor: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const viewer: Viewer = {
    id: user.id,
    username: user.username!,
    accentColor: user.accentColor,
    displayName: user.displayName,
  };
  const memberDTOs: MemberDTO[] = members.map((m) => ({
    userId: m.user.id,
    username: m.user.username ?? "unknown",
    displayName: m.user.displayName,
    accentColor: m.user.accentColor,
    role: m.role,
  }));
  const ideaDTOs: IdeaDTO[] = ideas.map((i) => ({
    id: i.id,
    title: decryptText(i.title, team.id),
    description: decryptOptional(i.description, team.id),
    notes: decryptOptional(i.notes, team.id),
    tags: i.tags,
    status: i.status,
    sparksCount: i.sparksCount,
    sparkedByMe: i.sparkedByUserIds.includes(user.id),
    authorId: i.createdById,
    createdAt: i.createdAt.toISOString(),
    taskCount: i.tasks.length,
    doneCount: i.tasks.filter((t) => t.status === "DONE").length,
  }));
  const taskDTOs: TaskDTO[] = tasks.map((t) => ({
    ...t,
    title: decryptText(t.title, team.id),
    notes: decryptOptional(t.notes, team.id),
    idea: t.idea && { id: t.idea.id, title: decryptText(t.idea.title, team.id) },
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
  const outgoing: OutgoingInvite[] = invites.map((i) => ({
    id: i.id,
    username: i.invitee.username ?? "unknown",
    accentColor: i.invitee.accentColor,
    createdAt: i.createdAt.toISOString(),
  }));
  const myRole = memberDTOs.find((m) => m.userId === user.id)?.role ?? "MEMBER";

  return (
    <Workspace
      key={team.id}
      team={team}
      viewer={viewer}
      myRole={myRole}
      members={memberDTOs}
      ideas={ideaDTOs}
      tasks={taskDTOs}
      invites={outgoing}
      initialView={one(sp.view)}
      initialProject={one(sp.project)}
      initialInvite={one(sp.invite) === "1"}
    />
  );
}
