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
 * Shortens an IP for logs and the audit trail: IPv4 keeps its /24 network
 * (203.0.113.0), IPv6 its /48 (2001:db8:85a3::). Enough to spot an abusive
 * network, not enough to identify a person.
 */
export function anonymizeIp(ip: string): string {
  if (ip.includes(":")) {
    const groups = ip.split("::")[0]!.split(":").filter(Boolean).slice(0, 3);
    return `${groups.join(":")}::`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0` : "unknown";
}

/**
 * Origins allowed to send mutations. Set ALLOWED_ORIGINS (comma-separated,
 * e.g. "https://blueprint.raqameen.com") to pin them in production; otherwise
 * the origin must be the host the request reached.
 */
function originAllowed(origin: URL, headers: Headers): boolean {
  const pinned = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  if (pinned?.length) return pinned.includes(origin.origin);
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim();
  return !!host && origin.host === host;
}

/**
 * CSRF and request-forgery defence for every mutation (server actions and any
 * non-GET request). Returns why a request is refused, or null when it's fine:
 * - Origin is required (browsers always send it on POST) and must be allowed;
 * - Fetch metadata, when the browser sends it, must say same-origin;
 * - a Referer, when present, must come from that same origin.
 */
export function mutationBlockReason(headers: Headers): string | null {
  const rawOrigin = headers.get("origin");
  if (!rawOrigin || rawOrigin === "null") return "missing origin";
  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return "bad origin";
  }
  if (!originAllowed(origin, headers)) return "cross-origin";
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return "cross-site fetch";
  const referer = headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== origin.origin) return "referer mismatch";
    } catch {
      return "bad referer";
    }
  }
  return null;
}

export const isSameOrigin = (headers: Headers) => mutationBlockReason(headers) === null;

// Libraries, scanners and headless browsers. Real browsers never send these.
const AUTOMATION =
  /\b(curl|wget|httpie|python-requests|python-urllib|python-httpx|aiohttp|httpx|go-http-client|okhttp|apache-httpclient|java\/|libwww-perl|node-fetch|undici|axios|got \(|scrapy|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|httrack|nikto|sqlmap|nmap|masscan|zgrab|nuclei|gobuster|dirbuster|wpscan)\b/i;

/**
 * Screens out obvious automation on the app's private routes. Not a CAPTCHA:
 * a determined bot can fake headers, which is why rate limits, auth and the
 * per-team checks sit behind this. Search engines and link previews are only
 * ever sent to the public pages, which this isn't applied to.
 */
export function automationReason(headers: Headers, mutation: boolean): string | null {
  const ua = headers.get("user-agent")?.trim() ?? "";
  if (!ua) return "no user agent";
  if (AUTOMATION.test(ua)) return "automation user agent";
  if (/headless/i.test(headers.get("sec-ch-ua") ?? "")) return "headless browser";
  // Browsers attach a real Accept-Language to every request, fetches included;
  // HTTP libraries send none, or a bare "*".
  const lang = headers.get("accept-language")?.trim();
  if (mutation && (!lang || lang === "*")) return "missing browser headers";
  return null;
}
