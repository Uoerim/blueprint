"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { KOFI_URL } from "@/components/kofi-button";
import { SupportDialog } from "@/components/support";
import { Dialog } from "@/components/ui/dialog";
import { Monogram, readable } from "@/components/ui/primitives";
import { UsagePage } from "../_components/account-menu";
import { useMe } from "../_components/app-shell";
import { ThemePicker, useTheme } from "../_components/theme-picker";

type Sheet = "appearance" | "usage" | "support" | null;

/** A native-style settings list: your photo and @username, then grouped rows. */
export function ProfileScreen() {
  const { username, displayName, accentColor, imageUrl, theme: serverTheme, staff } = useMe();
  const theme = useTheme(serverTheme);
  const { openUserProfile, signOut } = useClerk();
  const [sheet, setSheet] = useState<Sheet>(null);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
      <div className="flex flex-col items-center text-center">
        <Monogram name={username} color={accentColor} src={imageUrl} size={88} className="!rounded-full" />
        {displayName && <p className="mt-3 text-xl font-semibold tracking-tight">{displayName}</p>}
        <p className="mt-0.5 font-mono text-[14px]" style={{ color: readable(accentColor) }}>@{username}</p>
      </div>

      <Group>
        <Row icon={<IconUser />} label="Account" note="Name, photo, email, security" onClick={() => openUserProfile()} />
        <Row icon={<IconPalette />} label="Appearance" note={theme === "system" ? "System" : theme === "light" ? "Light" : "Dark"} onClick={() => setSheet("appearance")} />
        <Row icon={<IconGauge />} label="Usage" onClick={() => setSheet("usage")} />
      </Group>

      <Group>
        <Row icon={<IconHelp />} label="Contact support" onClick={() => setSheet("support")} />
        <Row icon={<IconCup />} label="Support on Ko-fi" href={KOFI_URL} external />
        <Row icon={<IconDoc />} label="Privacy Policy" href="/privacy" />
        <Row icon={<IconDoc />} label="Terms of Service" href="/terms" />
      </Group>

      {staff && (
        <Group>
          <Row icon={<IconShield />} label="Admin" href="/admin" />
        </Group>
      )}

      <Group>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="flex min-h-14 w-full items-center justify-center px-4 text-[15px] font-medium text-rose active:bg-tint/[0.04]"
        >
          Sign out
        </button>
      </Group>

      <Dialog open={sheet === "appearance"} onClose={() => setSheet(null)} title="Appearance" description="Saved on this device.">
        <ThemePicker initial={theme} />
      </Dialog>
      <Dialog open={sheet === "usage"} onClose={() => setSheet(null)} title="Usage">
        <UsagePage />
      </Dialog>
      <SupportDialog open={sheet === "support"} onClose={() => setSheet(null)} />
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="card mt-5 divide-y divide-line overflow-hidden rounded-3xl">{children}</div>;
}

function Row({
  icon,
  label,
  note,
  onClick,
  href,
  external,
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tint/[0.06] text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] text-ink">{label}</span>
        {note && <span className="block truncate text-[12px] text-ink-3">{note}</span>}
      </span>
      <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden className="shrink-0 text-ink-3">
        <path d="m1.5 1.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2 transition-colors active:bg-tint/[0.04] hover:bg-tint/[0.03]";
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

const ic = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const IconUser = () => (<svg {...ic}><circle cx="10" cy="7" r="3.25" /><path d="M3.75 17c.9-3 3.3-4.6 6.25-4.6S15.35 14 16.25 17" /></svg>);
const IconPalette = () => (<svg {...ic}><path d="M10 2.75a7.25 7.25 0 1 0 0 14.5c1 0 1.5-.7 1.5-1.4 0-.9-.8-1.3-.8-2.1 0-.8.65-1.4 1.45-1.4h1.6a3.5 3.5 0 0 0 3.5-3.5C17.25 5.6 14 2.75 10 2.75Z" /><circle cx="6.5" cy="9" r="1" fill="currentColor" /><circle cx="9.5" cy="6.2" r="1" fill="currentColor" /></svg>);
const IconGauge = () => (<svg {...ic}><path d="M3 14.5a7.25 7.25 0 1 1 14 0" /><path d="m10 12 3-3.8" /></svg>);
const IconHelp = () => (<svg {...ic}><circle cx="10" cy="10" r="7.25" /><path d="M7.9 7.8a2.15 2.15 0 0 1 4.2.6c0 1.45-2.1 1.8-2.1 3.1" /><circle cx="10" cy="14.1" r=".9" fill="currentColor" /></svg>);
const IconCup = () => (<svg {...ic}><path d="M3.5 6.5h10v5.5a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V6.5ZM13.5 7.5h.9a2 2 0 0 1 0 4h-.9" /></svg>);
const IconDoc = () => (<svg {...ic}><path d="M5.5 2.75h6l3 3v11.5h-9V2.75Z" /><path d="M8 10h4.5M8 13h4.5" /></svg>);
const IconShield = () => (<svg {...ic}><path d="M10 2.5 4 4.75V9c0 3.7 2.5 6.6 6 7.75 3.5-1.15 6-4.05 6-7.75V4.75L10 2.5Z" /></svg>);
