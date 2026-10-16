"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Monogram, cx } from "@/components/ui/primitives";
import { APP_PREVIEW_COOKIE } from "@/lib/app-preview";
import type { Theme } from "@/lib/theme";
import type { IncomingInvite, TeamSummary } from "@/lib/types";
import { InvitesBell } from "./invites-bell";

/*
 * Chrome for the installed phone app. Everything here is rendered for all
 * visitors but only shown under the `app:` variant (home-screen launch on a
 * phone, or the ?app=1 preview), so the website layout never changes.
 */

const LAST_TEAM_COOKIE = "bp-last-team";

/** Remembers the team you were last in, so the Ideas and Tasks tabs open it. */
export function rememberTeam(slug: string) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LAST_TEAM_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax${secure}`;
}

/** You, as the dashboard layout already loaded you. Only your own account, never anyone else's. */
export type Me = {
  username: string;
  displayName: string | null;
  accentColor: string;
  imageUrl: string | null;
  theme: Theme;
  staff: boolean;
};

type DashboardData = { teams: TeamSummary[]; me: Me | null };
const DashboardContext = createContext<DashboardData>({ teams: [], me: null });
export const useTeams = () => use(DashboardContext).teams;
export function useMe(): Me {
  const me = use(DashboardContext).me;
  if (!me) throw new Error("useMe() needs <DashboardProvider>.");
  return me;
}

/**
 * Shares what the dashboard layout loaded (your teams and your account) with the
 * screens under it, so tabs like Profile open without another trip to the server.
 */
export function DashboardProvider({ teams, me, children }: DashboardData & { children: ReactNode }) {
  return <DashboardContext value={{ teams, me }}>{children}</DashboardContext>;
}

/** ?app=1 turns the app-layout preview on for this browser, ?app=0 turns it off. */
export function AppPreviewSwitch() {
  const params = useSearchParams();
  const router = useRouter();
  const flag = params.get("app");
  useEffect(() => {
    if (flag !== "1" && flag !== "0") return;
    const on = flag === "1";
    // Cosmetic only: it switches the layout and grants nothing.
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${APP_PREVIEW_COOKIE}=${on ? "1" : ""}; path=/; max-age=${on ? 2592000 : 0}; samesite=lax${secure}`;
    document.documentElement.classList.toggle("app-preview", on);
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    router.replace(`${url.pathname}${url.search}`);
  }, [flag, router]);
  return null;
}

/** "Hello, Yosif" with your photo, today's date and the invites bell. */
export function AppHeader({
  name,
  username,
  accentColor,
  imageUrl,
  invites,
}: {
  name: string;
  username: string;
  accentColor: string;
  imageUrl: string | null;
  invites: IncomingInvite[];
}) {
  return (
    <header className="hidden px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] app:block">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/me" aria-label="Your profile" className="shrink-0 rounded-full active:scale-95">
          <Monogram name={username} color={accentColor} src={imageUrl} size={38} className="!rounded-full" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-tight tracking-tight text-ink">Hello, {name}</p>
          <p className="truncate text-[12px] leading-tight text-ink-3" suppressHydrationWarning>
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-highlight">
          <InvitesBell invites={invites} />
        </div>
      </div>
    </header>
  );
}

type Tab = "home" | "ideas" | "tasks" | "profile";

/** The floating tab bar: Home · Ideas · Tasks · Profile. */
export function BottomNav({ lastTeam }: { lastTeam: string | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const teams = useTeams();
  const onTeam = /^\/dashboard\/([a-z0-9-]+)(\/|$)/.exec(path);
  const slugHere = onTeam && onTeam[1] !== "me" ? onTeam[1] : null;
  const team = slugHere ?? lastTeam ?? teams[0]?.slug ?? null;
  const view = params.get("view");
  const here = `${path}?${params.toString()}`;
  // Light the tapped tab at once, before the next screen arrives; forgotten as soon as the address moves.
  const [tapped, setTapped] = useState<{ tab: Tab; from: string } | null>(null);

  const routed: Tab | null =
    path === "/dashboard"
      ? "home"
      : path.startsWith("/dashboard/me")
        ? "profile"
        : slugHere && !path.endsWith("/settings")
          ? view === "board" || view === "shipped" ? "tasks" : "ideas"
          : null;
  const active = tapped && tapped.from === here ? tapped.tab : routed;

  const tabs: { id: Tab; label: string; href: string; icon: ReactNode }[] = [
    { id: "home", label: "Home", href: "/dashboard", icon: <HomeIcon /> },
    { id: "ideas", label: "Ideas", href: team ? `/dashboard/${team}?view=vault` : "/dashboard", icon: <IdeasIcon /> },
    { id: "tasks", label: "Tasks", href: team ? `/dashboard/${team}?view=board` : "/dashboard", icon: <TasksIcon /> },
    { id: "profile", label: "Profile", href: "/dashboard/me", icon: <ProfileIcon /> },
  ];

  const go = (e: MouseEvent<HTMLAnchorElement>, t: Tab, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const url = new URL(href, window.location.href);
    // Ideas and Tasks of the team already on screen: the workspace holds all its data
    // and follows the address, so switch views without asking the server again.
    if (slugHere && url.pathname === path) {
      e.preventDefault();
      if (url.search !== window.location.search) window.history.pushState(null, "", url);
      window.scrollTo({ top: 0 });
      return;
    }
    if (url.pathname !== path) setTapped({ tab: t, from: here });
  };

  return (
    <nav
      aria-label="App"
      className="glass-solid fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto hidden h-[4.25rem] max-w-md items-center justify-around rounded-full border border-line-strong px-2 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] app:flex"
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <Link
            key={t.id}
            href={t.href}
            onClick={(e) => go(e, t.id, t.href)}
            aria-label={t.label}
            aria-current={on ? "page" : undefined}
            className={cx(
              "grid size-[3.25rem] place-items-center rounded-full transition-[background-color,color,transform] active:scale-90",
              on ? "bg-ink text-bg" : "text-ink-3 hover:text-ink",
            )}
          >
            {t.icon}
          </Link>
        );
      })}
    </nav>
  );
}

const icon = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function HomeIcon() {
  return (
    <svg {...icon}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}
function IdeasIcon() {
  return (
    <svg {...icon}>
      <path d="M12 3.5 14 9.5l6 2.5-6 2.5-2 6-2-6-6-2.5 6-2.5 2-6Z" />
    </svg>
  );
}
function TasksIcon() {
  return (
    <svg {...icon}>
      <rect x="3.5" y="4.5" width="7" height="15" rx="2" />
      <rect x="13.5" y="4.5" width="7" height="9" rx="2" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}
