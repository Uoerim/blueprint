import type { Metadata } from "next";
import { requireTeamPage } from "@/lib/auth";
import { decryptOptional, decryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { permissionsFor } from "@/lib/team-permissions";
import { visibleTasks } from "@/lib/task-visibility";
import type { IdeaDTO, MemberDTO, OutgoingInvite, TaskDTO, Viewer } from "@/lib/types";
import { Workspace } from "./workspace";

export async function generateMetadata({ params }: PageProps<"/dashboard/[teamSlug]">): Promise<Metadata> {
  const { teamSlug } = await params;
  return { title: teamSlug.replace(/-/g, " ") };
}

export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/[teamSlug]">) {
  const [{ teamSlug }, sp] = await Promise.all([params, searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // Session check and membership in one wait; 404 unless you're in this team.
  const { user, team, me } = await requireTeamPage(teamSlug);

  // Everything below is scoped to the verified team id, never the URL.
  const perms = permissionsFor(me.role, me.customRole?.permissions);
  const taskWhere = visibleTasks(team.id, user.id, perms.includes("tasks.viewPrivate"));

  const [members, ideas, tasks, invites, tags] = await Promise.all([
    db.teamMember.findMany({
      where: { teamId: team.id },
      select: {
        role: true,
        customRole: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, username: true, displayName: true, accentColor: true, imageUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.idea.findMany({
      where: { teamId: team.id, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sparksCount: true,
        sparkedByUserIds: true,
        createdById: true,
        createdAt: true,
        tasks: { where: taskWhere, select: { status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    }),
    db.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        description: true,
        notes: true,
        status: true,
        priority: true,
        visibility: true,
        tags: true,
        createdById: true,
        completedById: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        idea: { select: { id: true, title: true } },
        assignees: { select: { userId: true, focusedAt: true }, orderBy: { assignedAt: "asc" } },
        subtasks: {
          select: { id: true, title: true, description: true, done: true, completedAt: true, assignees: { select: { userId: true } } },
          orderBy: { position: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    }),
    perms.includes("members.invite")
      ? db.teamInvite.findMany({
          where: { teamId: team.id, status: "PENDING" },
          select: { id: true, createdAt: true, invitee: { select: { username: true, accentColor: true, imageUrl: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.teamTag.findMany({ where: { teamId: team.id }, select: { id: true, name: true, color: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const viewer: Viewer = {
    id: user.id,
    username: user.username!,
    accentColor: user.accentColor,
    displayName: user.displayName,
    imageUrl: user.imageUrl,
  };
  const memberDTOs: MemberDTO[] = members.map((m) => ({
    userId: m.user.id,
    username: m.user.username ?? "unknown",
    displayName: m.user.displayName,
    accentColor: m.user.accentColor,
    imageUrl: m.user.imageUrl,
    role: m.role,
    customRole: m.role === "MEMBER" ? m.customRole : null,
  }));
  const ideaDTOs: IdeaDTO[] = ideas.map((i) => ({
    id: i.id,
    title: decryptText(i.title, team.id),
    description: decryptOptional(i.description, team.id),
    status: i.status,
    sparksCount: i.sparksCount,
    sparkedByMe: i.sparkedByUserIds.includes(user.id),
    authorId: i.createdById,
    createdAt: i.createdAt.toISOString(),
    taskCount: i.tasks.length,
    doneCount: i.tasks.filter((t) => t.status === "DONE").length,
  }));
  const taskDTOs: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: decryptText(t.title, team.id),
    description: decryptOptional(t.description, team.id),
    notes: decryptOptional(t.notes, team.id),
    status: t.status,
    priority: t.priority,
    visibility: t.visibility,
    tags: t.tags,
    createdById: t.createdById,
    assigneeIds: t.assignees.map((a) => a.userId),
    focus: t.status === "IN_PROGRESS"
      ? t.assignees.filter((a) => a.focusedAt).map((a) => ({ userId: a.userId, since: a.focusedAt!.toISOString() }))
      : [],
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: decryptText(s.title, team.id),
      description: decryptOptional(s.description, team.id),
      done: s.done,
      assigneeIds: s.assignees.map((a) => a.userId),
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
    idea: t.idea && { id: t.idea.id, title: decryptText(t.idea.title, team.id) },
    completedAt: t.completedAt?.toISOString() ?? null,
    completedById: t.completedById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
  const outgoing: OutgoingInvite[] = invites.map((i) => ({
    id: i.id,
    username: i.invitee.username ?? "unknown",
    accentColor: i.invitee.accentColor,
    imageUrl: i.invitee.imageUrl,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <Workspace
      key={team.id}
      team={team}
      viewer={viewer}
      myRole={me.role}
      perms={perms}
      members={memberDTOs}
      ideas={ideaDTOs}
      tasks={taskDTOs}
      invites={outgoing}
      tags={tags}
      initialView={one(sp.view)}
      initialIdea={one(sp.idea)}
      initialProject={one(sp.project)}
      initialInvite={one(sp.invite) === "1"}
      showTour={!user.toursDone.includes("team")}
    />
  );
}
