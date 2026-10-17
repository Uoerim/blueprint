import { z } from "zod";
import { ACCENT_HEXES, LIMITS, RESERVED_SLUGS, RESERVED_USERNAMES } from "./constants";
import { GRANTABLE } from "./team-permissions";
import { TOURS } from "./tours";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const HTML_TAGS = /<\/?[a-z][^>]*>/gi;

/** Strips control/bidi characters and HTML tags, collapses runs of spaces. */
export function sanitize(input: string): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAGS, "")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const tooLong = (max: number) => `Keep it to ${max} characters or fewer.`;

const text = (min: number, max: number) =>
  z
    .string()
    .max(max * 2, tooLong(max))
    .transform(sanitize)
    .pipe(z.string().min(min, min === 1 ? "This can't be empty." : `Use at least ${min} characters.`).max(max, tooLong(max)));

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2, tooLong(max))
    .transform(sanitize)
    .pipe(z.string().max(max, tooLong(max)))
    .optional()
    .transform((v) => (v ? v : undefined));

/** Like optionalText, but an empty string means "clear it" (null) on updates. */
const clearableText = (max: number) =>
  z
    .string()
    .max(max * 2, tooLong(max))
    .transform(sanitize)
    .pipe(z.string().max(max, tooLong(max)))
    .transform((v) => (v ? v : null));

export const id = z.string().regex(/^c[a-z0-9]{20,32}$/, "Invalid id");

/** Any colour, as a 6-digit hex code. Stored lowercase; only ever used in inline styles. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour")
  .transform((c) => c.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: a–z, 0–9 and _")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved");

export const accentSchema = z.enum(ACCENT_HEXES);

export const onboardingSchema = z.strictObject({
  username: usernameSchema,
});

export const searchQuerySchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((q) => q.replace(/^@/, ""))
  .pipe(z.string().regex(/^[a-z0-9_]{1,20}$/));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "Lowercase letters, numbers and hyphens")
  .refine((s) => !RESERVED_SLUGS.has(s), "That slug is reserved");

export const createTeamSchema = z.strictObject({
  name: text(2, LIMITS.teamName),
  slug: slugSchema.optional().or(z.literal("").transform(() => undefined)),
  description: optionalText(LIMITS.description),
  /** People to invite straight away (up to 20). */
  inviteeIds: z.array(id).max(20).default([]).transform((ids) => [...new Set(ids)]),
});

export const updateTeamSchema = z.strictObject({
  teamId: id,
  name: text(2, LIMITS.teamName),
  description: clearableText(LIMITS.description),
});

export const teamOnly = z.strictObject({ teamId: id });
export const favoriteSchema = z.strictObject({ teamId: id, favorite: z.boolean() });
/** Destructive team-wide actions repeat the team (or project) name as a typed confirmation. */
export const confirmedTeamSchema = z.strictObject({ teamId: id, confirm: z.string().max(160) });
export const deleteIdeaSchema = z.strictObject({
  teamId: id,
  itemId: id,
  confirm: z.string().max(160).optional(),
});

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((t) => t.replace(/^#/, ""))
  .pipe(z.string().regex(/^[a-z0-9-]{1,24}$/));

export const createIdeaSchema = z.strictObject({
  /** Chosen in the browser (lib/live.ts) so the optimistic item keeps its identity. */
  id: id.optional(),
  teamId: id,
  title: text(1, LIMITS.title),
  description: optionalText(LIMITS.ideaBody),
  tags: z.array(tagSchema).max(LIMITS.tagsPerIdea, `At most ${LIMITS.tagsPerIdea} tags.`).default([]),
});

export const taskStatusSchema = z.enum(["TODO", "READY", "IN_PROGRESS", "DONE"]);
export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const visibilitySchema = z.enum(["TEAM", "ASSIGNEES"]);
/** Up to 20 assignees, de-duplicated. */
export const assigneeIdsSchema = z
  .array(id)
  .max(20, "At most 20 people per task.")
  .transform((ids) => [...new Set(ids)]);

export const taskDraftSchema = z.strictObject({
  title: text(1, LIMITS.title),
  assigneeIds: assigneeIdsSchema.default([]),
  priority: prioritySchema.default("MEDIUM"),
});

export const promoteIdeaSchema = z.strictObject({
  teamId: id,
  ideaId: id,
  // Promoting can come with tasks, or with none and the tasks get added on the project page.
  tasks: z.array(taskDraftSchema).max(12).default([]),
});

export const createTaskSchema = z.strictObject({
  id: id.optional(),
  teamId: id,
  title: text(1, LIMITS.title),
  description: optionalText(LIMITS.description),
  notes: optionalText(LIMITS.notes),
  priority: prioritySchema.default("MEDIUM"),
  assigneeIds: assigneeIdsSchema.default([]),
  visibility: visibilitySchema.default("TEAM"),
  projectId: id.nullable().optional(),
  tags: z.array(tagSchema).max(LIMITS.tagsPerIdea, `At most ${LIMITS.tagsPerIdea} tags.`).default([]),
});

export const updateTaskSchema = z
  .strictObject({
    teamId: id,
    itemId: id,
    title: text(1, LIMITS.title).optional(),
    description: clearableText(LIMITS.description).optional(),
    notes: clearableText(LIMITS.notes).optional(),
    projectId: id.nullable().optional(),
    priority: prioritySchema.optional(),
    visibility: visibilitySchema.optional(),
    tags: z.array(tagSchema).max(LIMITS.tagsPerIdea, `At most ${LIMITS.tagsPerIdea} tags.`).optional(),
  })
  .refine((v) => Object.keys(v).length > 2, "Nothing to update");

export const taskAssigneesSchema = z.strictObject({ teamId: id, itemId: id, userIds: assigneeIdsSchema });

export const createSubtaskSchema = z.strictObject({
  id: id.optional(),
  teamId: id,
  taskId: id,
  title: text(1, LIMITS.title),
  description: optionalText(LIMITS.description),
  assigneeIds: assigneeIdsSchema.default([]),
});
export const updateSubtaskSchema = z
  .strictObject({ teamId: id, itemId: id, title: text(1, LIMITS.title).optional(), description: clearableText(LIMITS.description).optional() })
  .refine((v) => v.title !== undefined || v.description !== undefined, "Nothing to update");
export const toggleSubtaskSchema = z.strictObject({ teamId: id, itemId: id, done: z.boolean() });
export const subtaskAssigneesSchema = taskAssigneesSchema;

export const createProjectSchema = z.strictObject({
  id: id.optional(),
  teamId: id,
  title: text(1, LIMITS.title),
  description: optionalText(LIMITS.description),
});

export const teamScoped = z.strictObject({ teamId: id, itemId: id });

export const inviteSchema = z.strictObject({ teamId: id, inviteeId: id });
export const respondInviteSchema = z.strictObject({ inviteId: id, accept: z.boolean() });

/** Turns a team name into a URL slug candidate. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "team"
  );
}

/* ── Site admin ─────────────────────────────────────────────────────────── */

export const adminUserSchema = z.strictObject({ userId: id });
export const adminSuspendSchema = z.strictObject({ userId: id, reason: clearableText(500) });
export const adminRoleSchema = z.strictObject({ userId: id, role: z.enum(["USER", "SUPPORT", "MODERATOR", "ADMIN"]) });
/** Same rules as claiming a username at sign-up: format, length and the reserved list. */
export const adminRenameSchema = z.strictObject({ userId: id, username: usernameSchema });
export const adminDeleteUserSchema = z.strictObject({ userId: id, confirm: z.string().max(40) });
export const adminDeleteTeamSchema = z.strictObject({ teamId: id, confirm: z.string().max(60) });

/* ── Import a project from JSON ──────────────────────────────────────────── */

const importSubtask = z.union([
  text(1, LIMITS.title),
  z.strictObject({ title: text(1, LIMITS.title), description: optionalText(LIMITS.description) }),
]);

/** What the AI (or a person) writes; the same rules as making things by hand. */
export const importPlanSchema = z.strictObject({
  title: text(1, LIMITS.title),
  description: optionalText(LIMITS.description),
  tags: z.array(z.string().max(48)).max(10).default([]),
  tasks: z
    .array(
      z.strictObject({
        title: text(1, LIMITS.title),
        description: optionalText(LIMITS.description),
        notes: optionalText(LIMITS.notes),
        priority: prioritySchema.default("MEDIUM"),
        tags: z.array(z.string().max(48)).max(10).default([]),
        subtasks: z.array(importSubtask).max(LIMITS.importSubtasks, `At most ${LIMITS.importSubtasks} subtasks per task.`).default([]),
      }),
    )
    .max(LIMITS.importTasks, `At most ${LIMITS.importTasks} tasks per import.`)
    .default([]),
});
export type ImportPlan = z.infer<typeof importPlanSchema>;
export const importProjectSchema = z.strictObject({ teamId: id, plan: importPlanSchema });

/* ── Guided tours ───────────────────────────────────────────────────────── */

export const tourSchema = z.strictObject({ tour: z.enum(TOURS) });

/* ── Bug reports ────────────────────────────────────────────────────────── */

export const bugReportSchema = z.strictObject({
  /** A bug report or a feature request. */
  kind: z.enum(["BUG", "FEATURE"]).default("BUG"),
  body: text(10, 2000),
  /** The page they were on: a path only, no query string or other site. */
  page: z
    .string()
    .max(200)
    .regex(/^\/(?!\/)[A-Za-z0-9/_.~-]*$/, "Invalid page")
    .optional(),
  /** Whether it was sent from the installed app (only used for the device summary). */
  installed: z.boolean().optional(),
});
export const resolveReportSchema = z.strictObject({ reportId: id, resolved: z.boolean() });

/* ── Team roles ─────────────────────────────────────────────────────────── */

export const permissionsSchema = z
  .array(z.enum(GRANTABLE))
  .max(GRANTABLE.length)
  .transform((p) => [...new Set(p)]);
export const createRoleSchema = z.strictObject({
  teamId: id,
  name: text(2, LIMITS.roleName),
  color: hexColorSchema,
  permissions: permissionsSchema,
});
export const updateRoleSchema = z.strictObject({
  teamId: id,
  itemId: id,
  name: text(2, LIMITS.roleName),
  color: hexColorSchema,
  permissions: permissionsSchema,
});
export const memberRoleSchema = z.strictObject({ teamId: id, itemId: id, role: z.enum(["CO_OWNER", "MEMBER"]) });
export const memberCustomRoleSchema = z.strictObject({ teamId: id, itemId: id, roleId: id.nullable() });

/* ── Ideas and tags ─────────────────────────────────────────────────────── */

export const updateIdeaSchema = z
  .strictObject({
    teamId: id,
    itemId: id,
    title: text(1, LIMITS.title).optional(),
    description: clearableText(LIMITS.ideaBody).optional(),
    tags: z.array(tagSchema).max(LIMITS.tagsPerIdea, `At most ${LIMITS.tagsPerIdea} tags.`).optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined || v.tags !== undefined, "Nothing to update");

export const createTagSchema = z.strictObject({ teamId: id, name: tagSchema, color: hexColorSchema });
export const updateTagSchema = z.strictObject({ teamId: id, itemId: id, name: tagSchema, color: hexColorSchema });
