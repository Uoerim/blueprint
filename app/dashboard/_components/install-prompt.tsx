"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { btn, cx } from "@/components/ui/primitives";
import { promptInstall, useInstallState } from "./install-state";

const DISMISS_KEY = "bp-install-dismissed";
const DISMISS_DAYS = 30;
export const OPEN_INSTALL = "bp:install";

const isPhone = () => window.matchMedia("(max-width: 767px)").matches && window.matchMedia("(pointer: coarse)").matches;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * "Add Blueprint to your home screen". On phones it appears once on the
 * dashboard (hidden for 30 days after "Not now"). It never appears, and the
 * profile menu's "Install app" is hidden, once the app is installed on this
 * device (see install-state.ts for how that's detected on each platform).
 *  - Android / Chrome: a real Install button (the browser's own dialog).
 *  - iPhone / iPad: Safari has no install API, so it shows the two taps to do it.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const { installed, platform, deferred } = useInstallState();

  useEffect(() => {
    if (installed) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_INSTALL, onOpen);
    // Show once on phones, a moment after the dashboard settles (and after detection has run).
    const t = window.setTimeout(() => {
      if (isPhone() && !dismissedRecently()) setOpen(true);
    }, 2500);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(OPEN_INSTALL, onOpen);
    };
  }, [installed]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (deferred && (await promptInstall(deferred))) setOpen(false);
  };

  if (installed) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Install Blueprint"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="glass-solid fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[65] mx-auto max-w-md rounded-2xl border border-line-strong p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pwa-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-[22%]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink">Add Blueprint to your home screen</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">Open it like an app: full screen, one tap away.</p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Close" className="-mr-1 -mt-1 grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>

          {deferred ? (
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={dismiss} className={cx(btn.ghost, "h-11")}>Not now</button>
              <button type="button" onClick={install} className={cx(btn.accent, "h-11 px-5")}>Install</button>
            </div>
          ) : (
            <>
              <ol className="mt-4 space-y-2 text-[14px] text-ink">
                {platform === "ios" ? (
                  <>
                    <Step n={1}>
                      Tap <ShareIcon /> <span className="font-medium">Share</span> in Safari&apos;s toolbar
                    </Step>
                    <Step n={2}>
                      Choose <span className="font-medium">Add to Home Screen</span>, then <span className="font-medium">Add</span>
                    </Step>
                  </>
                ) : platform === "android" ? (
                  <>
                    <Step n={1}>
                      Open your browser menu <span className="font-mono">⋮</span>
                    </Step>
                    <Step n={2}>
                      Tap <span className="font-medium">Install app</span> or <span className="font-medium">Add to Home screen</span>
                    </Step>
                  </>
                ) : (
                  <Step n={1}>Use your browser&apos;s menu and choose Install or Add to Home Screen.</Step>
                )}
              </ol>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={dismiss} className={cx(btn.outline, "h-11")}>Got it</button>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[12px] text-accent">{n}</span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-label="Share icon" className="inline-block text-accent">
      <path d="M8 1.5v10M4.5 5 8 1.5 11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8H3.5A1.5 1.5 0 0 0 2 9.5v6A1.5 1.5 0 0 0 3.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12.5 8H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
