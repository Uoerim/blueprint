"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getUsage, type Usage } from "@/app/actions/account";
import { KOFI_URL } from "@/components/kofi-button";
import { useReplayTours } from "@/components/tour/replay";
import { HelpIcon, SupportDialog } from "@/components/support";
import type { Theme } from "@/lib/theme";
import { OPEN_INSTALL } from "./install-prompt";
import { promptInstall, useInstallState } from "./install-state";
import { ThemePicker } from "./theme-picker";

/**
 * Clerk's user menu, extended with Blueprint's own account pages so every
 * personal setting lives in one window: Account, Security, Appearance, Usage.
 */
export function AccountMenu({ theme }: { theme: Theme }) {
  const [support, setSupport] = useState(false);
  const install = useInstallState();
  const replay = useReplayTours();
  return (
    <>
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action label="Appearance" labelIcon={<PaletteIcon />} open="appearance" />
          <UserButton.Action label="Usage" labelIcon={<GaugeIcon />} open="usage" />
          <UserButton.Action label="Contact support" labelIcon={<HelpIcon size={16} />} onClick={() => setSupport(true)} />
          <UserButton.Action label="Take the tour" labelIcon={<CompassIcon />} onClick={() => void replay()} />
          {/* Hidden on any device where the app is already installed (or when you're inside it). */}
          {!install.installed && (
            <UserButton.Action
              label="Install app"
              labelIcon={<PhoneIcon />}
              onClick={() => (install.deferred ? void promptInstall(install.deferred) : window.dispatchEvent(new Event(OPEN_INSTALL)))}
            />
          )}
        </UserButton.MenuItems>
        <UserButton.UserProfilePage label="Appearance" url="appearance" labelIcon={<PaletteIcon />}>
          <Page title="Appearance" note="Saved on this device. Applies everywhere in Blueprint.">
            <ThemePicker initial={theme} />
          </Page>
        </UserButton.UserProfilePage>
        <UserButton.UserProfilePage label="Usage" url="usage" labelIcon={<GaugeIcon />}>
          <UsagePage />
        </UserButton.UserProfilePage>
      </UserButton>
      <SupportDialog open={support} onClose={() => setSupport(false)} />
    </>
  );
}

function Page({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="text-ink">
      <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-[13px] text-ink-2">{note}</p>
      <div className="mt-5 border-t border-line pt-5">{children}</div>
    </div>
  );
}

const LABELS: [keyof Usage, string][] = [
  ["teams", "Teams you're in"],
  ["owned", "Teams you own"],
  ["ideas", "Ideas captured"],
  ["projects", "Projects started"],
  ["created", "Tasks created"],
  ["shipped", "Tasks you shipped"],
];

export function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getUsage().then((res) => {
      if (!live) return;
      if (res.ok) setUsage(res.data);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Page title="Usage" note="No caps on teams, ideas, projects or tasks. Here is what you've made so far.">
      <span className="inline-block rounded-md bg-emerald/12 px-2 py-0.5 text-[12px] font-medium text-emerald">Free plan · Unlimited</span>
      {error ? (
        <p className="mt-4 text-[13px] text-rose">{error}</p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {LABELS.map(([key, label]) => (
            <div key={key} className="rounded-xl bg-surface-2 p-3.5">
              <dt className="text-[12px] text-ink-3">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                {usage ? (
                  <span className="text-xl font-semibold tabular-nums tracking-tight">{usage[key].toLocaleString("en")}</span>
                ) : (
                  <span className="my-1 h-5 w-8 animate-pulse rounded bg-surface-3" aria-label="Loading" />
                )}
                <span className="text-[14px] text-ink-3">/ <span aria-label="unlimited">∞</span></span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-6 flex flex-col gap-3 rounded-xl bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-2">Blueprint is free. If it helps your team ship, a tip keeps the servers on.</p>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#FF5E5B] px-3.5 text-[13px] font-semibold text-[#1a1a1a] transition-[filter] hover:brightness-95"
        >
          Support on Ko-fi
        </a>
      </div>
    </Page>
  );
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.3-.6 1.3-1.2 0-.8-.7-1.1-.7-1.8 0-.7.55-1.2 1.25-1.2h1.4a3 3 0 0 0 3-3C14.25 4.2 11.45 1.75 8 1.75Z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5" cy="7" r="1" fill="currentColor" />
      <circle cx="7.5" cy="4.6" r="1" fill="currentColor" />
      <circle cx="10.6" cy="5.4" r="1" fill="currentColor" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.2 11.5a6.25 6.25 0 1 1 11.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m8 9.5 2.6-3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="9.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4" y="1.5" width="8" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 12.25h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.6 7.4-1.5 3.7-3.7 1.5 1.5-3.7 3.7-1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
