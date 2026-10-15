const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first && IP_RE.test(first) ? first : null;
}

/**
 * Client IP from proxy headers. Order matters: Vercel's header cannot be
 * spoofed by the client on Vercel; x-real-ip is set by most reverse proxies;
 * x-forwarded-for is the most common but the most spoofable, so it goes last.
 */
export function getClientIp(headers: Headers): string {
  return (
    clean(headers.get("x-vercel-forwarded-for")) ??
    clean(headers.get("x-real-ip")) ??
    clean(headers.get("x-forwarded-for")) ??
    "127.0.0.1"
  );
}

/**
 * CSRF defence for mutations: the Origin header must match the Host the request
 * reached. Browsers always send Origin on POST, so a missing one is rejected.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0]!.trim();
  } catch {
    return false;
  }
}
