import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Prisma, type Role, type User } from "@prisma/client";
import { db } from "./db";

export class ActionError extends Error {}

/**
 * Resolves the Clerk session to our Prisma user, creating the row on first
 * sight (lazy sync instead of a webhook). Deduped per request.
 */
export const getViewer = cache(async (): Promise<User | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;
  const primary =
    cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
  const email = (primary?.emailAddress ?? `${clerkId}@users.noreply.invalid`).toLowerCase();
  const displayName = [cu.firstName, cu.lastName].filter(Boolean).join(" ").slice(0, 80) || null;

  try {
    return await db.user.create({ data: { clerkId, email, displayName } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Same request raced us, or the Clerk user was re-created with a
      // verified email we already know: relink that row to the new Clerk id.
      const byClerk = await db.user.findUnique({ where: { clerkId } });
      if (byClerk) return byClerk;
      if (primary?.verification?.status === "verified") {
        return db.user.update({ where: { email }, data: { clerkId } });
      }
    }
    throw e;
  }
});

/** For pages: signed-in and onboarded, otherwise redirect. */
export async function requireOnboardedPage(): Promise<User> {
  const user = await getViewer();
  if (!user) redirect("/sign-in");
  if (!user.onboarded || !user.username) redirect("/onboarding");
  return user;
}

/** For server actions / route handlers: signed-in and onboarded, otherwise throw. */
export async function requireOnboarded(): Promise<User> {
  const user = await getViewer();
  if (!user) throw new ActionError("Sign in required.");
  if (!user.onboarded || !user.username) throw new ActionError("Finish onboarding first.");
  return user;
}

/**
 * Zero-trust membership check: the caller's team id is never trusted until
 * this query proves the viewer belongs to it (and holds one of `roles`).
 */
export async function requireMembership(teamId: string, userId: string, roles?: Role[]) {
  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) throw new ActionError("Team not found.");
  if (roles && !roles.includes(membership.role)) {
    throw new ActionError("You don't have permission to do that.");
  }
  return membership;
}

/** For pages: resolve a team by slug only if the viewer is a member. */
export async function getTeamForViewer(slug: string, userId: string) {
  const team = await db.team.findFirst({
    where: { slug, members: { some: { userId } } },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!team) notFound();
  return team;
}
