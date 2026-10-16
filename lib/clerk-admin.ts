import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { logServerError } from "./errors";

/**
 * Mirrors staff actions onto Clerk so they also hold at the sign-in layer.
 * Seed/demo users (fake `seed_*` ids) and tombstones have no Clerk account,
 * so they are skipped. Each call reports whether Clerk accepted it; the
 * database flag is what the app enforces either way.
 */
const isClerkId = (id: string) => id.startsWith("user_");
const notFound = (e: unknown) => (e as { status?: number })?.status === 404;

async function attempt(clerkId: string, fn: (c: Awaited<ReturnType<typeof clerkClient>>) => Promise<unknown>) {
  if (!isClerkId(clerkId)) return true;
  try {
    await fn(await clerkClient());
    return true;
  } catch (e) {
    if (notFound(e)) return true;
    logServerError("clerk-admin", e);
    return false;
  }
}

/** Blocks sign-in and revokes every session. */
export const clerkBan = (clerkId: string) => attempt(clerkId, (c) => c.users.banUser(clerkId));
export const clerkUnban = (clerkId: string) => attempt(clerkId, (c) => c.users.unbanUser(clerkId));
export const clerkDelete = (clerkId: string) => attempt(clerkId, (c) => c.users.deleteUser(clerkId));

/** Signs the account out on every device. */
export const clerkSignOutEverywhere = (clerkId: string) =>
  attempt(clerkId, async (c) => {
    const { data } = await c.sessions.getSessionList({ userId: clerkId, status: "active", limit: 100 });
    await Promise.all(data.map((s) => c.sessions.revokeSession(s.id)));
  });
