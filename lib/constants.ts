export const ACCENTS = [
  { name: "Electric Indigo", hex: "#6366F1" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Violet", hex: "#8B5CF6" },
] as const;

export const ACCENT_HEXES = ACCENTS.map((a) => a.hex) as unknown as readonly [string, ...string[]];

/**
 * Input limits, shared by the server schemas (lib/validations.ts) and the form
 * fields, so what a field lets you type is exactly what the server accepts.
 */
export const LIMITS = {
  /** Idea, task, subtask and project titles. */
  title: 120,
  /** An idea's body. */
  ideaBody: 500,
  /** Task, subtask, project and team descriptions. */
  description: 1000,
  /** A task's notes. */
  notes: 2000,
  teamName: 40,
  roleName: 30,
  tagsPerIdea: 5,
  /** Importing a project from JSON (see lib/import-template.ts). */
  importTasks: 40,
  importSubtasks: 20,
  /** Characters of pasted JSON; keeps the request under the 32 KB server action limit. */
  importChars: 30_000,
} as const;

export const RESERVED_USERNAMES = new Set([
  "admin",
  "app",
  "auth",
  "root",
  "support",
  "system",
  "api",
  "dashboard",
  "onboarding",
  "settings",
  "clerk",
  "neon",
  "me",
  "null",
  "undefined",
]);

export const RESERVED_SLUGS = new Set(["new", "settings", "api", "onboarding", "invites", "me", "admin", "tour"]);

export const IDEA_TAGS = ["feature", "bug", "experiment", "random"] as const;

export const TASK_COLUMNS = [
  { status: "TODO", label: "Backlog" },
  { status: "READY", label: "Ready" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
] as const;

export const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Med", HIGH: "High" } as const;

/** Everyone gets a stable colour from their username (used for initials when there's no profile picture). */
export function accentFor(username: string): string {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENT_HEXES[h % ACCENT_HEXES.length]!;
}

/** Tags every new team starts with. Owners and co-owners can rename, recolour, add and remove them. */
export const DEFAULT_TAGS = [
  { name: "feature", color: "#6366F1" },
  { name: "bug", color: "#F43F5E" },
  { name: "experiment", color: "#06B6D4" },
  { name: "random", color: "#F59E0B" },
] as const;
