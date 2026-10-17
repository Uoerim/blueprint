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

export function markLocalChange() {
  lastLocalChange = Date.now();
}

export function changedLocallyWithin(ms: number) {
  return Date.now() - lastLocalChange < ms;
}
