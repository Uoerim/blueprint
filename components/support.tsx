"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { submitBugReport } from "@/app/actions/support";
import { LEGAL_EMAIL } from "@/components/legal-constants";
import { Dialog, inputCls } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";

/** Contact support: report a bug right here (signed in), or email us about anything else. */
export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Contact support" description="Report a bug right here, or email us about anything else.">
      {/* Mounted only while open, so the form starts fresh every time. */}
      {open && <SupportBody />}
    </Dialog>
  );
}

function SupportBody() {
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
    <div className="pt-2">
      <BugReportForm />

      <section aria-labelledby="email-h" className="mt-6 border-t border-line pt-5">
        <h3 id="email-h" className="text-[14px] font-medium text-ink">Email us</h3>
        <p className="mt-0.5 text-[13px] text-ink-3">For data requests, account help or ideas. We usually reply within a couple of days.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-4 shadow-highlight">
          <span className="min-w-0 flex-1 truncate font-mono text-[15px] text-ink" aria-label="Support email">{LEGAL_EMAIL}</span>
          <button type="button" onClick={copy} className={cx(btn.outline, btn.sm, "shrink-0")} aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a href={`mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent("Blueprint support")}`} className={cx(btn.outline, "mt-2 w-full")}>
          Open in your mail app
        </a>
      </section>

      <p className="mt-5 flex gap-5 border-t border-line pt-4 text-[13px] text-ink-3">
        <Link href="/privacy" className="transition-colors hover:text-ink">Privacy Policy</Link>
        <Link href="/terms" className="transition-colors hover:text-ink">Terms of Service</Link>
      </p>
    </div>
  );
}

const MAX = 2000;
const MIN = 10;

/** "Report a bug": goes straight to the staff inbox in the admin panel. */
function BugReportForm() {
  const { isLoaded, isSignedIn } = useAuth();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const ready = body.trim().length >= MIN && !pending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    start(async () => {
      const res = await submitBugReport({
        body,
        page: window.location.pathname,
        installed: window.matchMedia("(display-mode: standalone)").matches,
      });
      if (!res.ok) return setError(res.error);
      setSent(true);
      setBody("");
    });
  };

  return (
    <section aria-labelledby="bug-h">
      <h3 id="bug-h" className="text-[14px] font-medium text-ink">Report a bug</h3>
      {!isLoaded ? (
        <div className="mt-3 h-28 animate-pulse rounded-xl bg-surface-2" />
      ) : !isSignedIn ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          <Link href="/sign-in" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">Sign in</Link>{" "}
          to report a bug from inside Blueprint, or email us below.
        </p>
      ) : sent ? (
        <div role="status" className="mt-3 flex items-start gap-3 rounded-xl bg-emerald/10 p-3.5">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="mt-0.5 shrink-0 text-emerald">
            <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="m6.75 10.25 2.25 2.25 4.25-4.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 flex-1 text-[14px] text-ink">
            Thanks, your report reached the team.
            <span className="block text-[13px] text-ink-3">We read every one. If we need more detail, we&apos;ll email you.</span>
          </span>
          <button type="button" onClick={() => setSent(false)} className={cx(btn.ghost, btn.sm, "shrink-0")}>
            Report another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2">
          <label htmlFor="bug-body" className="sr-only">What went wrong?</label>
          <textarea
            id="bug-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder="What happened, and what did you expect? Steps to make it happen again help a lot."
            className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
          />
          <div className="mt-1.5 flex items-start justify-between gap-3 text-[12px] text-ink-3">
            <span>We include the page you&apos;re on and your device type, nothing else.</span>
            <span className="shrink-0 font-mono tabular-nums">
              {body.length}/{MAX}
            </span>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-rose">
              {error}
            </p>
          )}
          <button type="submit" disabled={!ready} className={cx(btn.primary, "mt-3 w-full disabled:opacity-40")}>
            {pending ? "Sending…" : "Send report"}
          </button>
        </form>
      )}
    </section>
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
