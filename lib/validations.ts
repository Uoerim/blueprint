import { z } from "zod";
import { ACCENT_HEXES, RESERVED_SLUGS, RESERVED_USERNAMES } from "./constants";

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

const text = (min: number, max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(sanitize)
    .pipe(z.string().min(min).max(max));

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(sanitize)
    .pipe(z.string().max(max))
    .optional()
    .transform((v) => (v ? v : undefined));

/** Like optionalText, but an empty string means "clear it" (null) on updates. */
const clearableText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(sanitize)
    .pipe(z.string().max(max))
    .transform((v) => (v ? v : null));

export const id = z.string().regex(/^c[a-z0-9]{20,32}$/, "Invalid id");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: a–z, 0–9 and _")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That handle is reserved");

export const accentSchema = z.enum(ACCENT_HEXES);

export const onboardingSchema = z.strictObject({
  username: usernameSchema,
  accentColor: accentSchema,
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
  name: text(2, 50),
  slug: slugSchema.optional().or(z.literal("").transform(() => undefined)),
  description: optionalText(2000),
});

export const updateTeamSchema = z.strictObject({
  teamId: id,
  name: text(2, 50),
  description: clearableText(2000),
});

export const teamOnly = z.strictObject({ teamId: id });
export const deleteTeamSchema = z.strictObject({ teamId: id, confirm: z.string().max(60) });

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((t) => t.replace(/^#/, ""))
  .pipe(z.string().regex(/^[a-z0-9-]{1,24}$/));

export const createIdeaSchema = z.strictObject({
  teamId: id,
  title: text(1, 140),
  description: optionalText(2000),
  tags: z.array(tagSchema).max(5).default([]),
});

export const taskStatusSchema = z.enum(["TODO", "READY", "IN_PROGRESS", "DONE"]);
export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const taskDraftSchema = z.strictObject({
  title: text(1, 140),
  assigneeId: id.nullable().optional(),
  priority: prioritySchema.default("MEDIUM"),
});

export const promoteIdeaSchema = z.strictObject({
  teamId: id,
  ideaId: id,
  tasks: z.array(taskDraftSchema).min(1).max(12),
});

export const createTaskSchema = z.strictObject({
  teamId: id,
  title: text(1, 140),
  notes: optionalText(4000),
  priority: prioritySchema.default("MEDIUM"),
  assigneeId: id.nullable().optional(),
  projectId: id.nullable().optional(),
});

export const updateTaskSchema = z
  .strictObject({
    teamId: id,
    itemId: id,
    title: text(1, 140).optional(),
    notes: clearableText(4000).optional(),
    projectId: id.nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.notes !== undefined || v.projectId !== undefined, "Nothing to update");

export const createProjectSchema = z.strictObject({
  teamId: id,
  title: text(1, 140),
  description: optionalText(2000),
});

export const updateProjectSchema = z
  .strictObject({
    teamId: id,
    itemId: id,
    title: text(1, 140).optional(),
    description: clearableText(2000).optional(),
    notes: clearableText(8000).optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined || v.notes !== undefined, "Nothing to update");

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
