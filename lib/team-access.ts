import "server-only";
import { ActionError } from "./auth";
import { db } from "./db";
import { permissionsFor, type TeamPermission, type TeamRole } from "./team-permissions";

export type TeamAccess = {
  teamId: string;
  userId: string;
  memberId: string;
  role: TeamRole;
  customRoleId: string | null;
  perms: ReadonlySet<TeamPermission>;
  can: (p: TeamPermission) => boolean;
};

/**
 * Zero-trust team check for server actions: proves the user belongs to the
 * team (read fresh from Postgres on every call) and returns their effective
 * permissions. Pass `need` to require one of them.
 */
export async function requireTeamAccess(teamId: string, userId: string, need?: TeamPermission): Promise<TeamAccess> {
  const m = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true, role: true, customRoleId: true, customRole: { select: { permissions: true } } },
  });
  if (!m) throw new ActionError("Team not found.");
  const perms = new Set(permissionsFor(m.role, m.customRole?.permissions));
  const access: TeamAccess = {
    teamId,
    userId,
    memberId: m.id,
    role: m.role,
    customRoleId: m.customRoleId,
    perms,
    can: (p) => perms.has(p),
  };
  if (need && !perms.has(need)) throw new ActionError("You don't have permission to do that in this team.");
  return access;
}

export function assertCan(access: TeamAccess, p: TeamPermission) {
  if (!access.can(p)) throw new ActionError("You don't have permission to do that in this team.");
}

/** Every id must be a member of this exact team (used for assignees). */
export async function assertMembers(teamId: string, userIds: readonly string[]) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return unique;
  const n = await db.teamMember.count({ where: { teamId, userId: { in: unique } } });
  if (n !== unique.length) throw new ActionError("Everyone you assign must be on this team.");
  return unique;
}
