"use client";

import { useSyncExternalStore } from "react";

/*
 * Sample content that a guided tour shows on screen for one step, so every
 * step has something real-looking to point at (an invite, an idea). It lives
 * only in this tab's memory: nothing is ever saved, and it disappears as soon
 * as the step or the tour ends.
 */

export type TourDemo = "invite" | "idea";

let shown: ReadonlySet<TourDemo> = new Set();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Shows exactly these demos (an empty list hides them all). */
export function showTourDemos(...demos: TourDemo[]) {
  shown = new Set(demos);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTourDemo(demo: TourDemo): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown.has(demo),
    () => false,
  );
}
