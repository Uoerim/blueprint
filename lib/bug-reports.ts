import "server-only";
import { decryptText, encryptText } from "./crypto";

/*
 * Bug report text is encrypted at rest like team content, but with its own
 * key: HKDF over the master key with the scope "bug-reports". Team keys use the
 * team's id as their scope, and team ids never contain a hyphen, so this key
 * can never match a team's. Admin pages may import this module (unlike
 * lib/crypto), because it can only ever open bug reports, never team data.
 */
const SCOPE = "bug-reports";

export const sealReport = (text: string) => encryptText(text, SCOPE);
export const openReport = (value: string) => decryptText(value, SCOPE);

/**
 * A short, privacy-friendly device summary for a report, e.g.
 * "iPhone · Safari · installed app". Never stores the full user agent.
 */
export function describeDevice(userAgent: string | null, installed: boolean): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /OPR\//.test(ua)
          ? "Opera"
          : /Chrome|CriOS/.test(ua)
            ? "Chrome"
            : /Safari/.test(ua)
              ? "Safari"
              : "Other browser";
  return [device, browser, installed ? "installed app" : "browser"].join(" · ");
}
