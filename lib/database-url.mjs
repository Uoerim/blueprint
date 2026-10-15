// Resolves the Neon connection strings from whatever names the host provides.
// Plain .mjs so the build script (plain Node) and the app share one copy.
//
// Accepted, in order:
//   pooled  POSTGRES_PRISMA_URL, DATABASE_URL, POSTGRES_URL
//   direct  POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED
// ...also with any prefix (e.g. STORAGE_DATABASE_URL from a prefixed Vercel
// integration). If only a pooled Neon URL exists, the direct URL is derived
// by dropping "-pooler" from the host, which is Neon's naming convention.

/** @param {Record<string, string | undefined>} env @param {string[]} names */
function pick(env, names) {
  for (const n of names) if (env[n]) return env[n];
  for (const n of names) {
    const key = Object.keys(env).find((k) => k.endsWith(`_${n}`) && env[k]);
    if (key) return env[key];
  }
  return undefined;
}

/** @param {string} url */
function directFromPooled(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("-pooler.")) return url;
    u.hostname = u.hostname.replace("-pooler.", ".");
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ pooled?: string, direct?: string }}
 */
export function resolveDatabaseUrls(env = process.env) {
  const pooled = pick(env, ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"]);
  const direct = pick(env, ["POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED"]) ?? (pooled && directFromPooled(pooled));
  return { pooled, direct };
}
