/**
 * Site-wide staff roles. These are separate from team roles (OWNER / ADMIN /
 * MEMBER), which only apply inside one team.
 *
 *   USER       everyone; no access to /admin
 *   SUPPORT    read-only admin panel: accounts, teams, audit log (never team content)
 *   MODERATOR  SUPPORT + suspend / unsuspend accounts, sign accounts out everywhere
 *   ADMIN      everything: change site roles, delete accounts, delete teams
 *
 * Shared by server code and client components, so no server-only imports here.
 */
export const SITE_ROLES = ["USER", "SUPPORT", "MODERATOR", "ADMIN"] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

const RANK: Record<SiteRole, number> = { USER: 0, SUPPORT: 1, MODERATOR: 2, ADMIN: 3 };

export type Permission =
  | "admin.view"
  | "users.suspend"
  | "users.signout"
  | "users.role"
  | "users.delete"
  | "teams.delete";

const NEEDS: Record<Permission, SiteRole> = {
  "admin.view": "SUPPORT",
  "users.suspend": "MODERATOR",
  "users.signout": "MODERATOR",
  "users.role": "ADMIN",
  "users.delete": "ADMIN",
  "teams.delete": "ADMIN",
};

export const isSiteRole = (v: unknown): v is SiteRole => SITE_ROLES.includes(v as SiteRole);
export const rank = (r: SiteRole) => RANK[r];
export const can = (role: SiteRole, p: Permission) => RANK[role] >= RANK[NEEDS[p]];
export const isStaff = (role: SiteRole) => can(role, "admin.view");

/**
 * Whether `actor` may act on `target` at all: never on yourself (use the CLI),
 * and only on accounts ranked below you, except that admins may act on anyone.
 */
export function outranks(actor: SiteRole, target: SiteRole) {
  return actor === "ADMIN" || RANK[actor] > RANK[target];
}

export const ROLE_LABEL: Record<SiteRole, string> = {
  USER: "User",
  SUPPORT: "Support",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
};

export const ROLE_NOTE: Record<SiteRole, string> = {
  USER: "No admin access.",
  SUPPORT: "Can look up accounts, teams and the audit log. Can't change anything.",
  MODERATOR: "Support, plus suspend accounts and sign them out everywhere.",
  ADMIN: "Everything: roles, deleting accounts and teams.",
};
