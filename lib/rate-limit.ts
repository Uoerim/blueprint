import { LRUCache } from "lru-cache";

/**
 * Sliding-window rate limiter, kept in memory (an LRU per server instance).
 *
 * No external store and no extra cost. On serverless hosting each running
 * instance counts on its own, so limits are approximate across instances;
 * bot screening, origin checks, auth and per-team checks don't depend on it.
 */

export type Tier = "global" | "username" | "invite" | "write" | "auth" | "report" | "pulse";

/**
 * `limit` applies per signed-in user (and per IP when there's no user);
 * `ipLimit`, when set, is the per-IP ceiling instead. It's higher than the
 * per-user one so a few teammates on the same office or home network don't
 * use up each other's allowance.
 */
export const TIERS: Record<Tier, { limit: number; ipLimit?: number; windowMs: number }> = {
  // Every page and read, checked in proxy.ts before any auth work.
  global: { limit: 120, windowMs: 60_000 },
  // Live "is this username free?" checks: tight, so names can't be harvested from a dictionary.
  username: { limit: 25, windowMs: 60_000 },
  // Team invites and @username search: stops invite spam and profile scraping.
  invite: { limit: 15, ipLimit: 30, windowMs: 60_000 },
  // Ideas, tasks, subtasks, focus, teams: every mutation.
  write: { limit: 30, ipLimit: 60, windowMs: 60_000 },
  // Onboarding (claiming a username) and profile refreshes.
  auth: { limit: 5, windowMs: 60_000 },
  // Bug reports: plenty for real problems, too few to flood the staff inbox.
  report: { limit: 5, ipLimit: 10, windowMs: 60 * 60_000 },
  // The live change-check: one tiny request every ~4s per open tab, a few tabs at once.
  pulse: { limit: 90, windowMs: 60_000 },
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** epoch ms when the oldest counted hit leaves the window */
  reset: number;
};

const memory = new LRUCache<string, number[]>({
  max: 50_000,
  ttl: 5 * 60_000,
  ttlAutopurge: false,
});

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const since = now - windowMs;
  const hits = (memory.get(key) ?? []).filter((t) => t > since);
  const success = hits.length < limit;
  if (success) hits.push(now);
  memory.set(key, hits);
  const reset = (hits[0] ?? now) + windowMs;
  return { success, limit, remaining: Math.max(0, limit - hits.length), reset };
}

export async function rateLimit(tier: Tier, identifier: string, limit = TIERS[tier].limit): Promise<RateLimitResult> {
  const { windowMs } = TIERS[tier];
  return memoryHit(`rl:${tier}:${identifier}`, limit, windowMs);
}

/** Checks the IP and (when signed in) the user bucket; both must pass. */
export async function rateLimitRequest(
  tier: Tier,
  ip: string,
  userId?: string | null,
): Promise<RateLimitResult> {
  const byIp = await rateLimit(tier, `ip:${ip}`, TIERS[tier].ipLimit ?? TIERS[tier].limit);
  if (!byIp.success || !userId) return byIp;
  const byUser = await rateLimit(tier, `user:${userId}`);
  return byUser.success ? (byUser.remaining < byIp.remaining ? byUser : byIp) : byUser;
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset / 1000)),
  };
  if (!r.success) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)));
  }
  return headers;
}
