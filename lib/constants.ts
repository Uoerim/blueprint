export const ACCENTS = [
  { name: "Electric Indigo", hex: "#6366F1" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Violet", hex: "#8B5CF6" },
] as const;

export const ACCENT_HEXES = ACCENTS.map((a) => a.hex) as unknown as readonly [string, ...string[]];

export const RESERVED_USERNAMES = new Set([
  "admin",
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

export const RESERVED_SLUGS = new Set(["new", "settings", "api", "onboarding", "invites"]);

export const IDEA_TAGS = ["feature", "bug", "experiment", "random"] as const;

export const TASK_COLUMNS = [
  { status: "TODO", label: "Backlog" },
  { status: "READY", label: "Ready" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
] as const;

export const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Med", HIGH: "High" } as const;
