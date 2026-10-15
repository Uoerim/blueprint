import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { KofiButton } from "@/components/kofi-button";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { requireOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireOnboardedPage();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  const [teams, owned, ideas, projects, created, shipped, firstTeam] = await Promise.all([
    db.teamMember.count({ where: { userId: user.id } }),
    db.team.count({ where: { createdById: user.id } }),
    db.idea.count({ where: { createdById: user.id } }),
    db.idea.count({ where: { createdById: user.id, status: "PROMOTED" } }),
    db.task.count({ where: { createdById: user.id } }),
    db.task.count({ where: { assigneeId: user.id, status: "DONE" } }),
    db.teamMember.findFirst({ where: { userId: user.id }, orderBy: { joinedAt: "asc" }, select: { team: { select: { slug: true } } } }),
  ]);

  const usage: [string, number][] = [
    ["Teams you're in", teams],
    ["Teams you own", owned],
    ["Ideas captured", ideas],
    ["Projects started", projects],
    ["Tasks created", created],
    ["Tasks you shipped", shipped],
  ];

  return (
    <div className="mx-auto max-w-[920px] px-4 pb-24 pt-8 sm:px-6">
      {firstTeam && (
        <Link href={`/dashboard/${firstTeam.team.slug}`} className={cx(btn.ghost, btn.sm, "-ml-3")}>
          <span aria-hidden>←</span> Back to your team
        </Link>
      )}
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Settings</h1>
      <p className="mt-1 flex items-center gap-2 text-[15px] text-ink-2">
        <Monogram name={user.username!} color={user.accentColor} size={22} />
        <span className="font-mono text-[13px]" style={{ color: readable(user.accentColor) }}>@{user.username}</span>
      </p>

      <section aria-labelledby="theme-h" className="card mt-8 rounded-2xl p-5 sm:p-6">
        <h2 id="theme-h" className="text-lg font-semibold tracking-tight">Theme</h2>
        <p className="mt-1 text-[14px] text-ink-2">Saved on this device. Applies everywhere in Blueprint.</p>
        <div className="mt-5">
          <ThemePicker initial={theme} />
        </div>
      </section>

      <section aria-labelledby="usage-h" className="card mt-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="usage-h" className="text-lg font-semibold tracking-tight">Usage</h2>
          <span className="rounded-md bg-emerald/12 px-2 py-0.5 text-[12px] font-medium text-emerald">Free plan · Unlimited</span>
        </div>
        <p className="mt-1 text-[14px] text-ink-2">No caps on teams, ideas, projects or tasks. Here is what you&apos;ve made so far.</p>
        <dl className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {usage.map(([label, n]) => (
            <div key={label} className="rounded-xl bg-surface-2 p-4">
              <dt className="text-[13px] text-ink-3">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{n.toLocaleString("en")}</span>
                <span className="text-[15px] text-ink-3">/ <span aria-label="unlimited">∞</span></span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="support-h" className="card mt-4 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="support-h" className="text-lg font-semibold tracking-tight">Support Blueprint</h2>
          <p className="mt-1 max-w-[52ch] text-[14px] text-ink-2">
            Blueprint is free with no limits. If it helps your squad ship, a Ko-fi keeps the servers on.
          </p>
        </div>
        <KofiButton className="h-10 shrink-0 self-start sm:self-auto" />
      </section>
    </div>
  );
}
