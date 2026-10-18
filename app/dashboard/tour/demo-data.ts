import { permissionsFor } from "@/lib/team-permissions";
import type { IdeaDTO, MemberDTO, TagDTO, TaskDTO, Viewer } from "@/lib/types";

/*
 * The demo team shown after the welcome tour. It exists only on screen: these
 * ids never touch the database, and the workspace runs in demo mode, so no
 * action is ever sent. Teammates are fictional and marked as examples.
 */

export const DEMO_TEAM = { id: "cdemoteamdemoteamdemo0001", name: "Demo team", slug: "tour", description: "A sample team to look around. Nothing here is saved." };
export const DEMO_PERMS = permissionsFor("OWNER", undefined);

const MAYA = "cdemomayademomayademo0001";
const SAM = "cdemosamdemosamdemosa0001";

export const DEMO_TAGS: TagDTO[] = [
  { id: "cdemotagfeaturedemotag001", name: "feature", color: "#6366f1" },
  { id: "cdemotagbugdemotagbugd001", name: "bug", color: "#f43f5e" },
  { id: "cdemotagexperimentdemo001", name: "experiment", color: "#10b981" },
];

export function demoMembers(viewer: Viewer): MemberDTO[] {
  return [
    { userId: viewer.id, username: viewer.username, displayName: viewer.displayName, accentColor: viewer.accentColor, imageUrl: viewer.imageUrl, role: "OWNER", customRole: null },
    { userId: MAYA, username: "maya_example", displayName: "Maya (example)", accentColor: "#f472b6", imageUrl: null, role: "CO_OWNER", customRole: null },
    { userId: SAM, username: "sam_example", displayName: "Sam (example)", accentColor: "#22d3ee", imageUrl: null, role: "MEMBER", customRole: null },
  ];
}

export function demoContent(viewer: Viewer, now = Date.now()) {
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const project = { id: "cdemoprojectdemoproject01", title: "Pocket synth beta" };
  const ideas: IdeaDTO[] = [
    { id: "cdemoideadarkmodedemo0001", title: "Dark mode for the synth", description: "Night sessions are half our usage.", status: "VAULT", createdVia: null, sparksCount: 3, sparkedByMe: true, authorId: MAYA, createdAt: ago(40), taskCount: 0, doneCount: 0 },
    { id: "cdemoideashakeundodemo001", title: "Shake to undo the last note", description: null, status: "VAULT", createdVia: null, sparksCount: 1, sparkedByMe: false, authorId: viewer.id, createdAt: ago(180), taskCount: 0, doneCount: 0 },
    { ...project, description: "Ship a beta to 50 friends and collect feedback.", status: "PROMOTED", createdVia: null, sparksCount: 4, sparkedByMe: true, authorId: viewer.id, createdAt: ago(2_000), taskCount: 4, doneCount: 1 },
  ];
  const task = (t: Partial<TaskDTO> & Pick<TaskDTO, "id" | "title">): TaskDTO => ({
    description: null,
    notes: null,
    status: "TODO",
    priority: "MEDIUM",
    visibility: "TEAM",
    tags: [],
    createdById: viewer.id,
    assigneeIds: [],
    focus: [],
    subtasks: [],
    idea: project,
    completedAt: null,
    completedById: null,
    createdVia: null,
    completedVia: null,
    claudeAt: null,
    createdAt: ago(1_500),
    updatedAt: ago(30),
    ...t,
  });
  const tasks: TaskDTO[] = [
    task({ id: "cdemotaskrecorddemovid001", title: "Record the demo video", priority: "HIGH", status: "IN_PROGRESS", assigneeIds: [MAYA], focus: [{ userId: MAYA, since: ago(12) }], tags: ["feature"], subtasks: [
      { id: "cdemosubshotlistdemosub01", title: "Write the shot list", description: null, done: true, assigneeIds: [MAYA], completedAt: ago(60), createdVia: null, completedVia: null },
      { id: "cdemosubfilmdemosubfilm01", title: "Film", description: null, done: false, assigneeIds: [MAYA], completedAt: null, createdVia: null, completedVia: null },
    ] }),
    task({ id: "cdemotasktestflightdemo01", title: "Set up the TestFlight build", status: "READY", assigneeIds: [viewer.id] }),
    task({ id: "cdemotaskcrashfixdemo0001", title: "Fix the crash on rotate", priority: "HIGH", tags: ["bug"], assigneeIds: [SAM] }),
    task({ id: "cdemotaskiconsdemotask001", title: "Design the app icon", status: "DONE", assigneeIds: [viewer.id], completedAt: ago(300), completedById: viewer.id }),
  ];
  return { ideas, tasks };
}
