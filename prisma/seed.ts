/**
 * Seeds two demo squads with members, ideas, tasks and shipped history.
 *
 *   npm run db:seed
 *
 * Demo users get fake `seed_*` Clerk ids, so nobody can sign in as them; they
 * exist so you can search @handles and invite them. Set SEED_INVITE_USERNAME
 * to your own @handle (after onboarding) to receive pending invites to both
 * demo teams. Re-running is safe: it wipes and rebuilds only seed data.
 */
import type { Priority, TaskStatus } from "@prisma/client";
import { createPrisma } from "../lib/prisma";

const db = createPrisma();

const people = [
  { username: "ada", displayName: "Ada Okafor", accentColor: "#10B981" },
  { username: "linus_k", displayName: "Linus Karlsson", accentColor: "#F59E0B" },
  { username: "grace", displayName: "Grace Ibarra", accentColor: "#F43F5E" },
  { username: "mo", displayName: "Mo Haddad", accentColor: "#06B6D4" },
  { username: "juno", displayName: "Juno Park", accentColor: "#8B5CF6" },
  { username: "tariq", displayName: "Tariq Bello", accentColor: "#6366F1" },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function main() {
  // Demo data only. Never let it near a production database by accident.
  const prod = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (prod && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Refusing to seed in production. Set SEED_ALLOW_PRODUCTION=1 if you really mean it.");
  }
  const seedClerkIds = people.map((p) => `seed_${p.username}`);
  const old = await db.user.findMany({ where: { clerkId: { in: seedClerkIds } }, select: { id: true } });
  const oldIds = old.map((u) => u.id);
  if (oldIds.length) {
    await db.team.deleteMany({ where: { createdById: { in: oldIds } } });
    await db.teamInvite.deleteMany({ where: { OR: [{ inviterId: { in: oldIds } }, { inviteeId: { in: oldIds } }] } });
    await db.task.deleteMany({ where: { OR: [{ createdById: { in: oldIds } }, { assigneeId: { in: oldIds } }] } });
    await db.idea.deleteMany({ where: { createdById: { in: oldIds } } });
    await db.teamMember.deleteMany({ where: { userId: { in: oldIds } } });
    await db.user.deleteMany({ where: { id: { in: oldIds } } });
  }

  const u: Record<string, string> = {};
  for (const p of people) {
    const user = await db.user.create({
      data: {
        ...p,
        clerkId: `seed_${p.username}`,
        email: `${p.username}@seed.blueprint.invalid`,
        onboarded: true,
      },
    });
    u[p.username] = user.id;
  }

  // ── Team 1: Night Shift ───────────────────────────────────────────────────
  const night = await db.team.create({
    data: {
      name: "Night Shift",
      slug: "night-shift",
      description: "Four friends shipping a pocket synth app after work.",
      createdById: u.ada,
      members: {
        create: [
          { userId: u.ada, role: "OWNER" },
          { userId: u.linus_k, role: "ADMIN" },
          { userId: u.grace, role: "MEMBER" },
          { userId: u.mo, role: "MEMBER" },
        ],
      },
    },
  });

  const idea = (
    teamId: string,
    by: string,
    title: string,
    tags: string[],
    sparkers: string[],
    h: number,
    status: "VAULT" | "PROMOTED" | "ARCHIVED" = "VAULT",
    description?: string,
  ) =>
    db.idea.create({
      data: {
        teamId,
        createdById: u[by],
        title,
        description,
        tags,
        status,
        sparkedByUserIds: sparkers.map((s) => u[s]),
        sparksCount: sparkers.length,
        createdAt: hoursAgo(h),
      },
    });

  const arp = await idea(night.id, "linus_k", "Arpeggiator that follows the phone's tilt", ["feature", "experiment"], ["ada", "grace", "mo"], 52, "PROMOTED", "Tilt forward = faster, tilt sideways = octave spread.");
  const share = await idea(night.id, "grace", "Share a loop as a 10-second link", ["feature"], ["ada", "linus_k"], 30, "PROMOTED");
  await idea(night.id, "mo", "Audio glitches when the screen locks", ["bug"], ["linus_k"], 6);
  await idea(night.id, "ada", "Preset packs named after cities we've lived in", ["random"], ["grace"], 3);
  await idea(night.id, "grace", "Haptic tick on every downbeat", ["experiment"], [], 1);

  const task = (
    teamId: string,
    by: string,
    title: string,
    status: TaskStatus,
    priority: Priority,
    assignee: string | null,
    ideaId: string | null,
    opts: { focused?: boolean; doneH?: number; h?: number } = {},
  ) =>
    db.task.create({
      data: {
        teamId,
        createdById: u[by],
        title,
        status,
        priority,
        assigneeId: assignee ? u[assignee] : null,
        ideaId,
        isFocused: opts.focused ?? false,
        completedAt: opts.doneH !== undefined ? hoursAgo(opts.doneH) : null,
        createdAt: hoursAgo(opts.h ?? 40),
      },
    });

  await task(night.id, "linus_k", "Read accelerometer at 60Hz without draining battery", "DONE", "HIGH", "linus_k", arp.id, { doneH: 26 });
  await task(night.id, "linus_k", "Map tilt angle to tempo curve", "IN_PROGRESS", "HIGH", "linus_k", arp.id, { focused: true });
  await task(night.id, "linus_k", "Octave spread on sideways tilt", "READY", "MEDIUM", "grace", arp.id);
  await task(night.id, "grace", "Encode loop as compressed URL fragment", "IN_PROGRESS", "HIGH", "grace", share.id, { focused: true });
  await task(night.id, "grace", "Landing page for shared loops", "READY", "MEDIUM", null, share.id);
  await task(night.id, "ada", "Fix audio session category on lock", "TODO", "HIGH", "mo", null);
  await task(night.id, "ada", "Settle on the app name", "DONE", "LOW", "ada", null, { doneH: 70 });
  await task(night.id, "mo", "TestFlight build for the four of us", "DONE", "MEDIUM", "mo", null, { doneH: 8 });
  await task(night.id, "ada", "Record demo video for friends", "TODO", "LOW", null, null);

  // ── Team 2: Garden Club ───────────────────────────────────────────────────
  const garden = await db.team.create({
    data: {
      name: "Garden Club",
      slug: "garden-club",
      description: "Shared allotment, shared spreadsheet, now shared ideas.",
      createdById: u.juno,
      members: {
        create: [
          { userId: u.juno, role: "OWNER" },
          { userId: u.tariq, role: "MEMBER" },
          { userId: u.ada, role: "MEMBER" },
        ],
      },
    },
  });
  const rota = await idea(garden.id, "juno", "Watering rota that texts whoever's turn it is", ["feature"], ["tariq", "ada"], 20, "PROMOTED");
  await idea(garden.id, "tariq", "Swap seeds with the plot next door", ["random"], ["juno"], 4);
  await task(garden.id, "juno", "List who's away in August", "DONE", "MEDIUM", "tariq", rota.id, { doneH: 12 });
  await task(garden.id, "juno", "Draft the rota message", "IN_PROGRESS", "MEDIUM", "juno", rota.id, { focused: true });
  await task(garden.id, "juno", "Buy a second hose", "TODO", "LOW", null, null);

  await db.teamInvite.create({ data: { teamId: night.id, inviterId: u.ada, inviteeId: u.juno } });

  // Optional: invite your own account to both demo teams.
  const me = process.env.SEED_INVITE_USERNAME?.replace(/^@/, "").toLowerCase();
  if (me) {
    const mine = await db.user.findUnique({ where: { username: me } });
    if (mine) {
      for (const [team, inviter] of [[night.id, u.ada], [garden.id, u.juno]] as const) {
        await db.teamInvite.create({ data: { teamId: team, inviterId: inviter, inviteeId: mine.id } });
      }
      console.log(`Invited @${me} to Night Shift and Garden Club.`);
    } else {
      console.log(`@${me} not found — onboard first, then re-run the seed.`);
    }
  }

  console.log(`Seeded ${people.length} users, 2 teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
