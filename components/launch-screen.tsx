"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark, cx } from "@/components/ui/primitives";
import { SPLASH_MARK } from "@/lib/splash";

/**
 * The installed app's launch screen. It picks up exactly where iOS's own
 * launch image (lib/splash.ts) leaves off: the same mark on the same
 * background, so there's no flash. It stays until the app can respond to taps,
 * shows a slim progress line if that takes a moment, then lifts away. Only the
 * installed phone app shows it (the app: variant); a pure-CSS timeout removes
 * it even if scripts never run.
 */
export function LaunchScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"showing" | "leaving" | "gone">("showing");
  useEffect(() => {
    // Runs once the page has hydrated, so taps work by the time it's gone.
    // On the website it was never visible, so it simply goes.
    const hidden = !ref.current || getComputedStyle(ref.current).display === "none";
    // A timer, not an animation frame: frames pause while the app is in the background.
    const leave = window.setTimeout(() => setState(hidden ? "gone" : "leaving"), 0);
    // Taken out of the page once its exit (0.5s) has played.
    const remove = window.setTimeout(() => setState("gone"), 700);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(remove);
    };
  }, []);
  if (state === "gone") return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className={cx("launch-screen fixed inset-0 z-[200] hidden place-items-center bg-bg text-ink app:grid", state === "leaving" && "is-leaving")}
    >
      <div className="launch-mark">
        <BrandMark size={SPLASH_MARK} />
      </div>
      <span className="launch-progress" />
    </div>
  );
}
