"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const EVERY_MS = 4000;
const SLOW_MS = 15000;

/**
 * Live updates for the whole dashboard. While the tab is visible it asks
 * /api/pulse whether the current team or the viewer's notifications changed
 * (two timestamps, one tiny query) and re-fetches the page data only when one
 * moved. Hidden tabs stop polling and check again the moment they're shown.
 *
 * Screens you leave are kept for a short while (staleTimes in next.config), so
 * the stamps are remembered per screen: coming back to one that changed while
 * you were away refreshes it on the very first check.
 */
export function LivePulse() {
  const router = useRouter();
  const path = usePathname();
  const team = /^\/dashboard\/([a-z0-9-]+)/.exec(path)?.[1];
  const seen = useRef(new Map<string, { team: number | null; inbox: number }>());

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let failures = 0;
    const key = team ?? "";

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/pulse${team ? `?team=${encodeURIComponent(team)}` : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const now = (await res.json()) as { team: number | null; inbox: number };
        const prev = seen.current.get(key);
        seen.current.set(key, now);
        failures = 0;
        if (prev && (prev.team !== now.team || prev.inbox !== now.inbox)) router.refresh();
      } catch {
        failures++;
      }
      schedule();
    };

    const schedule = () => {
      window.clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible") timer = window.setTimeout(tick, failures > 2 ? SLOW_MS : EVERY_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
      else window.clearTimeout(timer);
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [team, router]);

  return null;
}
