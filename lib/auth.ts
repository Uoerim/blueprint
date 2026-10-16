import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Prisma, type User } from "@prisma/client";
import { db } from "./db";
import { can, type Permission, type SiteRole } from "./site-roles";

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
    return await db.user.create({ data: { clerkId, email, displayName, imageUrl: cu.hasImage ? cu.imageUrl : null } });
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

/** Suspended or deleted accounts are locked out of everything, even with a live Clerk session. */
export const isLockedOut = (user: Pick<User, "bannedAt" | "deletedAt">) => !!user.bannedAt || !!user.deletedAt;

/** For pages: signed-in, not suspended and onboarded, otherwise redirect. */
export async function requireOnboardedPage(): Promise<User> {
  const user = await getViewer();
  if (!user) redirect("/sign-in");
  if (isLockedOut(user)) redirect("/suspended");
  if (!user.onboarded || !user.username) redirect("/onboarding");
  return user;
}

/** For server actions / route handlers: signed-in, not suspended and onboarded, otherwise throw. */
export async function requireOnboarded(): Promise<User> {
  const user = await getViewer();
  if (!user) throw new ActionError("Sign in required.");
  if (isLockedOut(user)) throw new ActionError("This account is suspended.");
  if (!user.onboarded || !user.username) throw new ActionError("Finish onboarding first.");
  return user;
}

/**
 * For /admin pages: staff with the permission, otherwise a plain 404 so the
 * panel's existence isn't revealed to regular accounts.
 */
export async function requireStaffPage(permission: Permission = "admin.view"): Promise<User & { siteRole: SiteRole }> {
  const user = await requireOnboardedPage();
  if (!can(user.siteRole, permission)) notFound();
  return user;
}

/** For admin server actions: re-checked from the database on every call. */
export function requirePermission(user: User, permission: Permission) {
  if (isLockedOut(user) || !can(user.siteRole, permission)) {
    throw new ActionError("You don't have permission to do that.");
  }
}

/**
 * For pages: requireOnboardedPage() and the page's own queries side by side, so
 * the page waits for the database once instead of twice. `load` gets the Clerk
 * id of the verified session and must scope every query to it (for example
 * `where: { user: { clerkId } }`); nothing it returns is used unless the session
 * checks pass, because a failed check redirects before the results come back.
 */
export async function withOnboardedPage<T>(load: (clerkId: string) => Promise<T>): Promise<[User, T]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  return Promise.all([requireOnboardedPage(), load(clerkId)]);
}

/**
 * For team pages: the signed-in, onboarded viewer plus their membership of the
 * team at `slug`, fetched together. A plain 404 unless they're a member, so a
 * team's existence isn't revealed to outsiders.
 */
export async function requireTeamPage(slug: string) {
  const [user, member] = await withOnboardedPage((clerkId) =>
    db.teamMember.findFirst({
      where: { team: { slug }, user: { clerkId } },
      select: {
        userId: true,
        role: true,
        customRole: { select: { permissions: true } },
        team: { select: { id: true, name: true, slug: true, description: true } },
      },
    }),
  );
  if (!member || member.userId !== user.id) notFound();
  return { user, team: member.team, me: { role: member.role, customRole: member.customRole } };
}
