import "server-only";
import { LRUCache } from "lru-cache";
import { writeAudit } from "./audit";

// One entry per (user, tier) per minute at most, so a flood of blocked
// requests can't turn into a flood of database writes. Anonymous floods are
// stopped in proxy.ts and only logged to the server console, for the same reason.
const recent = new LRUCache<string, true>({ max: 5000, ttl: 60_000 });

/** Records that a signed-in caller hit a rate limit (shown in the admin Security log). */
export async function logRateLimited(user: { id: string; username: string | null }, ip: string, tier: string) {
  const key = `${user.id}:${tier}`;
  if (recent.has(key)) return;
  recent.set(key, true);
  await writeAudit(user, ip, { action: "security.rate_limited", entityType: "RateLimit", entityId: tier });
}
