import { Show, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { FocusHud, InviteDemo, PipelineDemo } from "@/components/landing/bento";
import { LivePreview } from "@/components/landing/live-preview";
import { MaskedHeadline, Rise } from "@/components/landing/motion";
import { LandingNav } from "@/components/landing/nav";
import { ProjectDemo } from "@/components/landing/project-demo";
import { SupportButton } from "@/components/support";
import { btn, cx, Monogram, Pill, readable } from "@/components/ui/primitives";

const REPO = "https://github.com/Uoerim/blueprint";

export default function Home() {
  return (
    <>
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Tour />
        <Closing />
      </main>
      <Footer />
    </>
  );
}

function PrimaryCta({ label = "Get started, it's free" }: { label?: string }) {
  return (
    <>
      <Show when="signed-out">
        <SignUpButton forceRedirectUrl="/onboarding">
          <button type="button" className={cx(btn.primary, "h-11 px-5")}>{label}</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={cx(btn.primary, "h-11 px-5")}>Go to dashboard →</Link>
      </Show>
    </>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="bg-architect pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_70%_at_30%_10%,black,transparent)]" />
      <div aria-hidden className="mesh pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-16 sm:px-6 md:pt-24">
        <MaskedHeadline
          lines={["Where raw ideas become", "shipped reality."]}
          className="text-[clamp(1.85rem,7.2vw,6.25rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-ink"
        />
        <Rise delay={0.35} className="mt-7 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[48ch] text-[18px] leading-relaxed text-ink-2">
            Blueprint is a shared idea list and task board for small teams. Write ideas down, turn the good ones into projects, split them into tasks, and see who is working on what.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <PrimaryCta />
            <a href="#tour" className={cx(btn.outline, "h-11 px-5")}>See what it does</a>
          </div>
        </Rise>

        <Rise delay={0.5} className="mt-14 md:mt-16">
          <LivePreview />
          <p className="mt-3 text-[13px] text-ink-3">
            Try it: type an idea, spark one, promote it, then start or finish a task on the right.
          </p>
        </Rise>
      </div>
    </section>
  );
}

/* ── Product tour: one row per thing you can do ─────────────────────────── */

function Row({
  id,
  step,
  title,
  body,
  points,
  children,
  flip,
}: {
  id?: string;
  step: string;
  title: string;
  body: string;
  points: string[];
  children: ReactNode;
  flip?: boolean;
}) {
  return (
    <div id={id} className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
      <Rise className={cx("md:col-span-5", flip && "md:order-2 md:col-start-8")}>
        <p className="font-mono text-[13px] text-accent">{step}</p>
        <h3 className="mt-2 text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{title}</h3>
        <p className="mt-3 max-w-[46ch] text-[17px] leading-[1.6] text-ink-2">{body}</p>
        <ul className="mt-5 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[15px] text-ink">
              <svg className="mt-[5px] shrink-0 text-emerald" width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="m3 7.4 2.6 2.6L11 4.4" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {p}
            </li>
          ))}
        </ul>
      </Rise>
      <Rise delay={0.08} className={cx("md:col-span-7", flip && "md:order-1 md:col-start-1")}>
        {children}
      </Rise>
    </div>
  );
}

function VaultMock() {
  const ideas: [string, string, string, string, number][] = [
    ["Preset packs named after cities we've lived in", "grace", "#F43F5E", "random", 1],
    ["Arpeggiator that follows the phone's tilt", "ada", "#10B981", "feature", 3],
    ["Crash when the metronome hits 300 BPM", "linus_k", "#F59E0B", "bug", 2],
  ];
  const tagColor: Record<string, string> = { random: "#F59E0B", feature: "#6366F1", bug: "#F43F5E" };
  return (
    <div data-ui className="card space-y-2 rounded-2xl p-3 sm:p-4">
      <div className="field flex h-11 items-center rounded-xl px-3 text-[14px] text-ink-3">
        Write down an idea… add #feature, #bug or #random
      </div>
      {ideas.map(([t, who, c, tag, sparks]) => (
        <div key={t} className="rounded-xl bg-surface-2 p-3">
          <p className="text-[14px] text-ink">{t}</p>
          <div className="mt-2 flex items-center gap-2">
            <Monogram name={who} color={c} size={18} />
            <span className="font-mono text-[11px]" style={{ color: readable(c) }}>@{who}</span>
            <Pill color={tagColor[tag]}>#{tag}</Pill>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber/15 px-2 py-0.5 font-mono text-[12px] text-amber">
              <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" /></svg>
              {sparks}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShippedMock() {
  const rows: [string, string, string, string][] = [
    ["mo", "#06B6D4", "TestFlight build for the four of us", "8h ago"],
    ["grace", "#F43F5E", "Map tilt to tempo curve", "yesterday"],
    ["linus_k", "#F59E0B", "Read accelerometer at 60Hz", "2 days ago"],
  ];
  return (
    <div data-ui className="card rounded-2xl p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Shipped", "27"], ["This week", "6"], ["Projects done", "3"]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 py-3">
            <p className="text-[12px] text-ink-3">{k}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map(([who, c, t, when]) => (
          <li key={t} className="flex items-center gap-3 rounded-xl bg-emerald/[0.07] px-3 py-2.5">
            <Monogram name={who} color={c} size={22} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              <span className="font-mono text-[11px]" style={{ color: readable(c) }}>@{who}</span> shipped {t}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-3">{when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tour() {
  return (
    <section id="tour" className="mx-auto max-w-[1240px] space-y-28 px-4 py-24 sm:px-6 md:space-y-40 md:py-36">
      <Rise>
        <h2 className="max-w-[20ch] text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
          Everything your team does, from first idea to done.
        </h2>
      </Rise>

      <Row
        step="01 · Ideas"
        title="Write every idea down in seconds."
        body="Anyone on the team adds ideas to one shared list. Tag them, and spark the ones you like, so the best ideas rise to the top without a meeting."
        points={["One box, no form to fill in", "Tags: feature, bug, experiment, random", "Sparks show what the team believes in"]}
      >
        <VaultMock />
      </Row>

      <Row
        flip
        step="02 · Projects"
        title="Turn a good idea into a project."
        body="Promote an idea and split it into tasks, each with an owner and a priority. Or start a project from scratch whenever you need one."
        points={["Break an idea into up to twelve tasks at once", "Pick who owns each task and how urgent it is", "Every task remembers the project it belongs to"]}
      >
        <div className="card rounded-2xl p-4 sm:p-6">
          <PipelineDemo />
        </div>
      </Row>

      <Row
        id="projects"
        step="03 · Project pages"
        title="Every project gets its own page."
        body="Open a project to see only its tasks on a board, its progress, a description of what done looks like, and shared notes the whole team can edit."
        points={["Add tasks straight into the project", "Notes and a description on every project and task", "Progress bar and the people working on it"]}
      >
        <ProjectDemo />
        <p className="mt-3 text-[13px] text-ink-3">Click a task to move it along, or add your own.</p>
      </Row>

      <Row
        flip
        step="04 · Your work"
        title="See your tasks, and who is working on what."
        body="My tasks shows everything assigned to you across all projects. Press Start working and your name lights up so the team knows what you are on, right now."
        points={["My tasks, all tasks, or one teammate's tasks", "Live focus shows who is working on what", "Kanban or list, whichever you prefer"]}
      >
        <div className="card rounded-2xl p-4 sm:p-5">
          <FocusHud />
        </div>
      </Row>

      <Row
        step="05 · Your team"
        title="Invite friends by their @username."
        body="Everyone picks a unique username when they join. Search it, send an invite, and they accept with one click. Make as many teams as you like."
        points={["Unlimited teams and members", "Owners and admins manage roles", "Each team's ideas and tasks stay private to it"]}
      >
        <div className="card rounded-2xl p-4 sm:p-5">
          <InviteDemo />
        </div>
      </Row>

      <Row
        flip
        step="06 · Shipped"
        title="Keep a record of everything you finished."
        body="Finished tasks move to Shipped with the name of whoever did them, so the team can look back and see how far it has come."
        points={["A timeline of everything done", "Counts for this week and all time", "Reopen anything that came back"]}
      >
        <ShippedMock />
      </Row>
    </section>
  );
}

/* ── Closing CTA ────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
      <Rise className="card flex flex-col items-start gap-6 rounded-3xl p-8 sm:p-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[clamp(1.6rem,3vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]">Free, with no limits.</h2>
          <p className="mt-2 max-w-[44ch] text-[17px] text-ink-2">Unlimited teams, ideas, projects and tasks. Sign in with Google or GitHub and start in a minute.</p>
        </div>
        <PrimaryCta label="Start your team" />
      </Rise>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1240px] px-4 pb-8 pt-10 sm:px-6">
      <div className="flex flex-col gap-3 text-sm text-ink-3 sm:flex-row sm:items-baseline sm:justify-between">
        <span>© 2026 Blueprint</span>
        <span className="flex flex-wrap gap-6">
          <SupportButton variant="text" />
          <Link className="transition-colors hover:text-ink" href="/privacy">Privacy</Link>
          <Link className="transition-colors hover:text-ink" href="/terms">Terms</Link>
          <a className="transition-colors hover:text-ink" href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="transition-colors hover:text-ink" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer license">License</a>
        </span>
      </div>
    </footer>
  );
}
