import Link from "next/link";
import type { ReactNode } from "react";
import { btn, cx } from "@/components/ui/primitives";
import { ROLE_LABEL, type SiteRole } from "@/lib/site-roles";

export const PAGE_SIZE = 50;

/** `?page=` as a safe 1-based integer. */
export function pageOf(raw: string | string[] | undefined) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

/** `?q=` trimmed and capped, so it can go straight into a `contains` filter. */
export function queryOf(raw: string | string[] | undefined) {
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().replace(/^@/, "") ?? "";
  return q.slice(0, 64);
}

export function PageTitle({ title, note, children }: { title: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
        {note && <p className="mt-1 max-w-[70ch] text-[14px] text-ink-2">{note}</p>}
      </div>
      {children}
    </div>
  );
}

const TONE = { rose: "text-rose", amber: "text-amber", emerald: "text-emerald" } as const;

export function Stat({ label, value, tone }: { label: string; value: number; tone?: keyof typeof TONE }) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone && TONE[tone])}>{value.toLocaleString("en")}</p>
    </div>
  );
}

const ROLE_TONE: Record<SiteRole, string> = {
  USER: "bg-tint/[0.06] text-ink-2",
  SUPPORT: "bg-cyan/15 text-cyan",
  MODERATOR: "bg-violet/15 text-violet",
  ADMIN: "bg-amber/15 text-amber",
};

export function RolePill({ role }: { role: SiteRole }) {
  return <span className={cx("inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>;
}

export function StatusPill({ banned, deleted, onboarded }: { banned: boolean; deleted: boolean; onboarded: boolean }) {
  const [label, cls] = deleted
    ? ["Deleted", "bg-tint/[0.06] text-ink-3"]
    : banned
      ? ["Suspended", "bg-rose/12 text-rose"]
      : !onboarded
        ? ["Signing up", "bg-tint/[0.06] text-ink-3"]
        : ["Active", "bg-emerald/12 text-emerald"];
  return <span className={cx("inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium", cls)}>{label}</span>;
}

export function SearchBox({ action, q, placeholder, children }: { action: string; q: string; placeholder: string; children?: ReactNode }) {
  return (
    <form action={action} role="search" className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        maxLength={64}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field h-9 w-full min-w-0 rounded-lg px-3 text-sm text-ink placeholder:text-ink-3 sm:w-64"
      />
      {children}
      <button type="submit" className={cx(btn.outline, btn.sm)}>Search</button>
    </form>
  );
}

export function Pager({ base, page, total, params = {} }: { base: string; page: number; total: number; params?: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;
  const href = (p: number) => `${base}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[13px] text-ink-3">
      <span>
        Page {page} of {pages} · {total.toLocaleString("en")} total
      </span>
      <span className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className={cx(btn.outline, btn.xs)}>← Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className={cx(btn.outline, btn.xs)}>Next →</Link>}
      </span>
    </nav>
  );
}

/** Wide tables scroll sideways on phones instead of breaking the page. */
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="card mt-5 overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-3">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-ink-3">Nothing matches.</p>}
    </div>
  );
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date) {
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
