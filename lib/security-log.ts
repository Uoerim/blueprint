import "server-only";
import { LRUCache } from "lru-cache";
import { db } from "./db";

// One entry per (user, tier) per minute at most, so a flood of blocked
// requests can't turn into a flood of database writes.
const recent = new LRUCache<string, true>({ max: 5000, ttl: 60_000 });

/** Records that a signed-in caller hit a rate limit (shown in the admin Security log). */
export async function logRateLimited(userId: string, ip: string, tier: string) {
  const key = `${userId}:${tier}`;
  if (recent.has(key)) return;
  recent.set(key, true);
  try {
    await db.auditLog.create({
      data: { userId, action: "security.rate_limited", entityType: "RateLimit", entityId: tier, ipAddress: ip },
    });
  } catch (e) {
    console.error("[security-log]", e);
  }
}
