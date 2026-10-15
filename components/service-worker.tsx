"use client";

import { useEffect } from "react";

/** Registers the tiny offline-screen service worker (production only, so dev reloads stay instant). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
