/*
 * Client-side helpers for smooth live updates.
 *
 * newId(): ids for things created in the browser. The server stores the item
 * under this exact id (it's validated like any other id), so the item shown
 * the moment you press Add is the same item the server returns: no swap, no
 * remount, no replayed entrance animation.
 *
 * markLocalChange(): your own saves already refresh the page through the
 * server action, so the live change-check skips its extra refresh for a moment
 * afterwards instead of re-rendering everything a second time.
 */

export function newId(): string {
  return `c${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

let lastLocalChange = 0;

let preloadedAt = 0;

/** The app's tab bar just asked for its screens ahead of time (see BottomNav). */
export function markPreloaded() {
  preloadedAt = Date.now();
}

/**
 * Whether a screen opened now may be showing data preloaded a while ago: older
 * than a few seconds, but still within the 5 minutes Next.js keeps preloads.
 */
export function mayBePreloadedStale() {
  const age = Date.now() - preloadedAt;
  return preloadedAt > 0 && age > 6_000 && age < 300_000;
}

export function markLocalChange() {
  lastLocalChange = Date.now();
}

export function changedLocallyWithin(ms: number) {
  return Date.now() - lastLocalChange < ms;
}
