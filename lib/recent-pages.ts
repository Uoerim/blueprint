/*
 * The last few pages someone visited in this tab, so feedback can say which
 * page it's about even when it's sent from somewhere else (on a phone, Contact
 * support lives on the Profile tab). Paths only, kept in this tab's
 * sessionStorage, never sent anywhere unless they pick one in a report.
 */

const KEY = "bp:recent-pages";
const MAX = 6;
/** Where Contact support itself lives on phones; never what a report is about. */
const SKIP = /^\/dashboard\/me(\/|$)/;

export function rememberPage(path: string) {
  if (SKIP.test(path)) return;
  try {
    const list = [path, ...recentPages().filter((p) => p !== path)].slice(0, MAX);
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode or storage blocked: the report just offers the current page.
  }
}

export function recentPages(): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string" && /^\/(?!\/)[A-Za-z0-9/_.~-]{0,199}$/.test(p)) : [];
  } catch {
    return [];
  }
}

/** A readable name for a page: "Home", "Night shift", "Night shift · settings". */
export function describePage(path: string, teamNames?: ReadonlyMap<string, string>): string {
  if (path === "/dashboard") return "Home";
  if (SKIP.test(path)) return "Profile";
  if (path === "/dashboard/tour") return "Demo team";
  if (path === "/dashboard/new") return "Create a team";
  const team = /^\/dashboard\/([a-z0-9-]+)(\/settings)?\/?$/.exec(path);
  if (team) {
    const name = teamNames?.get(team[1]!);
    if (name) return team[2] ? `${name} · settings` : name;
    return `${team[2] ? "Team settings" : "Team"} · ${team[1]}`;
  }
  if (path.startsWith("/admin")) return "Admin panel";
  if (path.startsWith("/onboarding")) return "Choosing a username";
  if (path === "/") return "Home page";
  return path;
}
