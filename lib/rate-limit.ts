import { LRUCache } from "lru-cache";

/**
 * Sliding-window rate limiter.
 *
 * Default store: in-process LRU (one per server instance — fine for a single
 * Node process / dev, approximate across serverless instances).
 * Drop-in: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or Vercel KV's
 * KV_REST_API_URL + KV_REST_API_TOKEN) and the limiter uses Redis sorted sets
 * over the REST API, giving one shared window across every instance.
 */

export type Tier = "global" | "username" | "invite" | "write" | "auth" | "pulse";

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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

async function redisHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(`${redisUrl}/multi-exec`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", key, "0", String(now - windowMs)],
      ["ZADD", key, String(now), member],
      ["ZCARD", key],
      ["ZRANGE", key, "0", "0", "WITHSCORES"],
      ["PEXPIRE", key, String(windowMs)],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("rate limit store unavailable");
  const out = (await res.json()) as { result: unknown }[];
  const count = Number(out[2]?.result ?? 0);
  const oldest = Number((out[3]?.result as string[] | undefined)?.[1] ?? now);
  const success = count <= limit;
  if (!success) {
    // Do not let rejected requests extend the window.
    await fetch(`${redisUrl}/zrem/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: "no-store",
    }).catch(() => {});
  }
  return {
    success,
    limit,
    remaining: Math.max(0, limit - Math.min(count, limit)),
    reset: oldest + windowMs,
  };
}

export async function rateLimit(tier: Tier, identifier: string, limit = TIERS[tier].limit): Promise<RateLimitResult> {
  const { windowMs } = TIERS[tier];
  const key = `rl:${tier}:${identifier}`;
  if (redisUrl && redisToken) {
    try {
      return await redisHit(key, limit, windowMs);
    } catch {
      // Fall through to the in-memory limiter rather than failing open.
    }
  }
  return memoryHit(key, limit, windowMs);
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
