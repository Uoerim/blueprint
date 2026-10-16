"use client";

import { useSyncExternalStore } from "react";

/*
 * "App mode" = Blueprint launched from the home screen on a phone-sized screen,
 * or a phone with the ?app=1 preview on (html.app-preview). Layout differences
 * are pure CSS via the `app:` Tailwind variant (no flash, works before JS);
 * this hook is only for behaviour CSS can't express, like bottom-sheet motion.
 */

const STANDALONE_PHONE = "(display-mode: standalone) and (max-width: 767px)";
const PHONE = "(max-width: 767px)";

function snapshot() {
  return (
    window.matchMedia(STANDALONE_PHONE).matches ||
    (document.documentElement.classList.contains("app-preview") && window.matchMedia(PHONE).matches)
  );
}

function subscribe(cb: () => void) {
  const a = window.matchMedia(STANDALONE_PHONE);
  const b = window.matchMedia(PHONE);
  a.addEventListener("change", cb);
  b.addEventListener("change", cb);
  return () => {
    a.removeEventListener("change", cb);
    b.removeEventListener("change", cb);
  };
}

export function useAppMode() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
