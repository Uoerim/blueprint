import { LRUCache } from "lru-cache";

/**
 * Sliding-window rate limiter.
 *
 * Shared store: Upstash Redis over its REST API (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN, or the KV_REST_API_URL + KV_REST_API_TOKEN pair the
 * Vercel integration adds), giving one window across every serverless instance.
 * Each check is a single Lua script call, which Upstash bills as one command.
 *
 * Fallback: an in-process LRU window per server instance, used when Redis isn't
 * configured or can't be reached, so limits never fail open.
 */

export type Tier = "global" | "username" | "invite" | "write" | "auth" | "pulse";

/**
 * `limit` applies per signed-in user (and per IP when there's no user);
 * `ipLimit`, when set, is the per-IP ceiling instead. It's higher than the
 * per-user one so a few teammates on the same office or home network don't
 * use up each other's allowance.
 */
export const TIERS: Record<Tier, { limit: number; ipLimit?: number; windowMs: number; local?: boolean }> = {
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
  // Counted in memory only: it's a cheap signed-in read, and sending every poll to
  // Redis would cost more than everything else put together.
  pulse: { limit: 90, windowMs: 60_000, local: true },
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

// Drops hits older than the window, adds this one only if there's room (so refused
// requests never extend the window), and reports the count and the oldest hit.
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, ARGV[4])
  count = count + 1
  allowed = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return { allowed, count, tonumber(oldest[2] or now) }
`;

async function redisHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", SLIDING_WINDOW, "1", key, String(now), String(windowMs), String(limit), member]),
    cache: "no-store",
    // A slow store must not hold up every page: give up and use the local window.
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error("rate limit store unavailable");
  const { result } = (await res.json()) as { result?: [number, number, number] };
  if (!Array.isArray(result)) throw new Error("rate limit store returned an unexpected reply");
  const [allowed, count, oldest] = result.map(Number) as [number, number, number];
  return {
    success: allowed === 1,
    limit,
    remaining: Math.max(0, limit - count),
    reset: (Number.isFinite(oldest) ? oldest : now) + windowMs,
  };
}

export async function rateLimit(tier: Tier, identifier: string, limit = TIERS[tier].limit): Promise<RateLimitResult> {
  const { windowMs } = TIERS[tier];
  const key = `rl:${tier}:${identifier}`;
  if (redisUrl && redisToken && !TIERS[tier].local) {
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
