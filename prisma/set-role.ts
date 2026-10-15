/**
 * Grant a team role from the command line (there is no app-wide admin; roles
 * are per team). Adds the user to the team if they aren't a member yet.
 *
 *   npm run team:role -- <username> <team-slug> <OWNER|CO_OWNER|MEMBER>
 *   npm run team:role -- yosuf night-shift CO_OWNER
 *
 * Making someone OWNER transfers ownership: the previous owner becomes CO_OWNER.
 */
import { createPrisma } from "../lib/prisma";

const db = createPrisma();
const ROLES = ["OWNER", "CO_OWNER", "MEMBER"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [rawUser, slug, rawRole] = process.argv.slice(2);
  const username = rawUser?.replace(/^@/, "").toLowerCase();
  const role = rawRole?.toUpperCase() as Role;
  if (!username || !slug || !ROLES.includes(role)) {
    console.error("Usage: npm run team:role -- <username> <team-slug> <OWNER|CO_OWNER|MEMBER>");
    process.exit(2);
  }

  const user = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) throw new Error(`No user @${username}. Sign up and claim the handle first.`);
  const team = await db.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) throw new Error(`No team with slug "${slug}".`);

  await db.$transaction(async (tx) => {
    if (role === "OWNER") {
      await tx.teamMember.updateMany({
        where: { teamId: team.id, role: "OWNER", userId: { not: user.id } },
        data: { role: "CO_OWNER" },
      });
      await tx.team.update({ where: { id: team.id }, data: { createdById: user.id } });
    } else {
      const current = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        select: { role: true },
      });
      if (current?.role === "OWNER") {
        throw new Error("That user owns the team. Make someone else OWNER first.");
      }
    }
    await tx.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      create: { teamId: team.id, userId: user.id, role },
      update: { role, ...(role !== "MEMBER" && { customRoleId: null }) },
    });
    // A pending invite is moot once they're a member.
    await tx.teamInvite.deleteMany({ where: { teamId: team.id, inviteeId: user.id, status: "PENDING" } });
  });

  console.log(`@${username} is now ${role} of ${team.name}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
