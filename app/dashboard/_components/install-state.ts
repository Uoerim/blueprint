"use client";

import { useSyncExternalStore } from "react";

/**
 * Is Blueprint installed on *this* device? Combines every signal browsers give:
 *  - running inside the installed app (display-mode: standalone / iOS navigator.standalone): certain
 *  - "appinstalled" fired here before (remembered per device in localStorage): Android, desktop
 *  - navigator.getInstalledRelatedApps() lists our web app: Android Chrome, desktop Chrome/Edge
 *  - "beforeinstallprompt" fires: the browser says it is NOT installed, so any stale flag is cleared
 * iPhone Safari offers no API at all, so there it is only known from inside the app.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type RelatedApp = { platform: string; url?: string; id?: string };

export type InstallState = {
  /** Running as the installed app right now. */
  standalone: boolean;
  /** Installed on this device (certain or detected). */
  installed: boolean;
  platform: "ios" | "android" | "other";
  /** Chrome's native install dialog, when the browser offers one. */
  deferred: InstallEvent | null;
};

const FLAG = "bp-installed";
const SERVER: InstallState = { standalone: false, installed: false, platform: "other", deferred: null };

let state: InstallState = SERVER;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function remember(installed: boolean) {
  try {
    if (installed) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {}
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let flagged = false;
  try {
    flagged = localStorage.getItem(FLAG) === "1";
  } catch {}
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  state = { standalone, installed: standalone || flagged, platform: ios ? "ios" : /android/i.test(ua) ? "android" : "other", deferred: null };
  if (standalone) remember(true);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    remember(false); // the browser only offers this when the app isn't installed
    set({ deferred: e as InstallEvent, installed: false });
  });
  window.addEventListener("appinstalled", () => {
    remember(true);
    set({ installed: true, deferred: null });
  });

  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.some((a) => a.platform === "webapp")) {
        remember(true);
        set({ installed: true });
      }
    })
    .catch(() => {});
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => {
      start();
      return state;
    },
    () => SERVER,
  );
}

/** Opens Chrome's install dialog. Resolves true if the person accepted. */
export async function promptInstall(deferred: InstallEvent) {
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  set({ deferred: null });
  if (outcome === "accepted") {
    remember(true);
    set({ installed: true });
  }
  return outcome === "accepted";
}
