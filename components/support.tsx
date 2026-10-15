"use client";

import Link from "next/link";
import { useState } from "react";
import { LEGAL_EMAIL } from "@/components/legal-constants";
import { Dialog } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";

/** Modal with the support address: copy it, or open the mail app. */
export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LEGAL_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Contact support" description="Found a bug, need your data deleted, or have an idea? Email us.">
      <div className="pt-2">
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-4 shadow-highlight">
          <span className="min-w-0 flex-1 truncate font-mono text-[15px] text-ink" aria-label="Support email">{LEGAL_EMAIL}</span>
          <button type="button" onClick={copy} className={cx(btn.outline, btn.sm, "shrink-0")} aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a href={`mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent("Blueprint support")}`} className={cx(btn.primary, "mt-3 w-full")}>
          Open in your mail app
        </a>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
          We usually reply within a couple of days. Include your @handle and the team name if it&apos;s about a specific team.
        </p>
        <p className="mt-4 flex gap-5 border-t border-line pt-4 text-[13px] text-ink-3">
          <Link href="/privacy" className="transition-colors hover:text-ink">Privacy Policy</Link>
          <Link href="/terms" className="transition-colors hover:text-ink">Terms of Service</Link>
        </p>
      </div>
    </Dialog>
  );
}

export function SupportButton({ variant = "icon", className }: { variant?: "icon" | "text"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={variant === "icon" ? "Contact support" : undefined}
        title={variant === "icon" ? "Support" : undefined}
        className={cx(
          variant === "icon"
            ? "grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-tint/[0.06] hover:text-ink"
            : "transition-colors hover:text-ink",
          className,
        )}
      >
        {variant === "icon" ? <HelpIcon /> : "Support"}
      </button>
      <SupportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function HelpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.9 7.8a2.15 2.15 0 0 1 4.2.6c0 1.45-2.1 1.8-2.1 3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14.1" r="0.9" fill="currentColor" />
    </svg>
  );
}
