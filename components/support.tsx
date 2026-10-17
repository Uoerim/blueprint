"use client";

import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { submitBugReport } from "@/app/actions/support";
import { LEGAL_EMAIL } from "@/components/legal-constants";
import { Dialog, inputCls } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";
import { useDashboardData } from "@/app/dashboard/_components/app-shell";
import { describePage, recentPages, rememberPage } from "@/lib/recent-pages";

/** Contact support: report a bug right here (signed in), or email us about anything else. */
export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Contact support" description="Report a bug or request a feature right here, or email us about anything else.">
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

type Kind = "BUG" | "FEATURE";
const KINDS: { id: Kind; label: string; placeholder: string; thanks: string }[] = [
  {
    id: "BUG",
    label: "Report a bug",
    placeholder: "What happened, and what did you expect? Steps to make it happen again help a lot.",
    thanks: "Thanks, your report reached the team.",
  },
  {
    id: "FEATURE",
    label: "Request a feature",
    placeholder: "What would you like Blueprint to do, and what would it help you with?",
    thanks: "Thanks, your idea reached the team.",
  },
];

/** Remembers the pages visited in this tab, so a report can say which one it's about. */
export function PageMemory() {
  const path = usePathname();
  useEffect(() => rememberPage(path), [path]);
  return null;
}

const NO_PAGE = "";

const PROFILE = /^\/dashboard\/me(\/|$)/;

/**
 * The pages a report can be about, only ever ones this person can open: their
 * own teams (and those teams' settings), their home and profile, the demo team,
 * "Start a team" only while they have none, and the admin panel only for staff.
 * "Recent": the page they're on and the ones visited just before it (on phones
 * support lives on the Profile tab, so the page before it is usually the one
 * that matters), checked against the same list, so nothing from someone else's
 * session in this tab, or from a team they've left, ever shows up.
 */
function pageChoices(teams: { slug: string }[], staff: boolean) {
  const mine = [
    "/dashboard",
    ...teams.flatMap((t) => [`/dashboard/${t.slug}`, `/dashboard/${t.slug}/settings`]),
    "/dashboard/me",
    ...(teams.length ? [] : ["/dashboard/new"]),
    "/dashboard/tour",
    ...(staff ? ["/admin"] : []),
  ];
  const canOpen = (p: string) => mine.includes(p) || (staff && p.startsWith("/admin/"));
  const here = window.location.pathname;
  const recent = [...new Set([here, ...recentPages()])].filter(canOpen).slice(0, 5);
  const all = mine.filter((p) => !recent.includes(p));
  // Start on the page you were on, or the one before Profile.
  const initial = recent.find((p) => !PROFILE.test(p)) ?? recent[0] ?? NO_PAGE;
  return { recent, all, initial, here };
}

/** Bug reports and feature requests: both go straight to the staff inbox in the admin panel. */
function BugReportForm() {
  const { isLoaded, isSignedIn } = useAuth();
  const [kind, setKind] = useState<Kind>("BUG");
  const meta = KINDS.find((k) => k.id === kind)!;
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  // Read once when the form opens (it's only mounted while the window is open).
  const { teams, me } = useDashboardData();
  const teamNames = new Map(teams.map((t) => [t.slug, t.name]));
  // Read once when the form opens (it's only mounted while the window is open).
  const [choices] = useState(() =>
    typeof window === "undefined"
      ? { recent: [], all: [], initial: NO_PAGE, here: "" }
      : // Outside the dashboard (the public pages) there's nothing of theirs to list but the page itself.
        me
        ? pageChoices(teams, me.staff)
        : { recent: [window.location.pathname], all: [], initial: window.location.pathname, here: window.location.pathname },
  );
  const [page, setPage] = useState(choices.initial);
  const ready = body.trim().length >= MIN && !pending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    start(async () => {
      const res = await submitBugReport({
        kind,
        body,
        page: page || undefined,
        installed: window.matchMedia("(display-mode: standalone)").matches,
      });
      if (!res.ok) return setError(res.error);
      setSent(true);
      setBody("");
    });
  };

  return (
    <section aria-labelledby="bug-h">
      <h3 id="bug-h" className="sr-only">Send feedback</h3>
      <div role="radiogroup" aria-label="What would you like to send?" className="relative grid grid-cols-2 rounded-xl bg-surface-2 p-1 shadow-highlight">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => {
              setKind(k.id);
              setSent(false);
              setError(null);
            }}
            className={cx("relative z-10 h-9 rounded-lg text-[13px] font-medium transition-colors", kind === k.id ? "text-ink" : "text-ink-3 hover:text-ink-2")}
          >
            {kind === k.id && (
              <motion.span
                layoutId="feedback-kind"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-highlight"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            {k.label}
          </button>
        ))}
      </div>
      {!isLoaded ? (
        <div className="mt-3 h-28 animate-pulse rounded-xl bg-surface-2" />
      ) : !isSignedIn ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          <Link href="/sign-in" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">Sign in</Link>{" "}
          to report a bug or request a feature from inside Blueprint, or email us below.
        </p>
      ) : sent ? (
        <div role="status" className="mt-3 flex items-start gap-3 rounded-xl bg-emerald/10 p-3.5">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="mt-0.5 shrink-0 text-emerald">
            <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="m6.75 10.25 2.25 2.25 4.25-4.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 flex-1 text-[14px] text-ink">
            {meta.thanks}
            <span className="block text-[13px] text-ink-3">We read every one. If we need more detail, we&apos;ll email you.</span>
          </span>
          <button type="button" onClick={() => setSent(false)} className={cx(btn.ghost, btn.sm, "shrink-0")}>
            Report another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3">
          <label htmlFor="bug-body" className="sr-only">{kind === "BUG" ? "What went wrong?" : "What would you like?"}</label>
          <textarea
            id="bug-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder={meta.placeholder}
            className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
          />
          <div className="mt-1.5 flex justify-end text-[12px] text-ink-3">
            <span className="font-mono tabular-nums">
              {body.length}/{MAX}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="bug-page" className="shrink-0 text-[13px] text-ink-2">
              {kind === "BUG" ? "Where it happened" : "Which page it's about"}
            </label>
            <div className="relative min-w-0 flex-1">
              <select
                id="bug-page"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className={cx(inputCls, "h-10 w-full appearance-none pr-9 text-[14px]")}
              >
                {choices.recent.length > 0 && (
                  <optgroup label="Recent">
                    {choices.recent.map((p) => (
                      <option key={p} value={p}>
                        {describePage(p, teamNames)}
                        {p === choices.here ? " (this page)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {choices.all.length > 0 && (
                  <optgroup label="All pages">
                    {choices.all.map((p) => (
                      <option key={p} value={p}>
                        {describePage(p, teamNames)}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={NO_PAGE}>Not about a specific page</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
                <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">We send the page you pick and your device type with it, nothing else.</p>
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-rose">
              {error}
            </p>
          )}
          <button type="submit" disabled={!ready} className={cx(btn.primary, "mt-3 w-full disabled:opacity-40")}>
            {pending ? "Sending…" : kind === "BUG" ? "Send report" : "Send request"}
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
