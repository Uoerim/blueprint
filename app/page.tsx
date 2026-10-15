import { Show, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { FocusHud, InviteDemo, PipelineDemo, SecurityTerminal } from "@/components/landing/bento";
import { LivePreview } from "@/components/landing/live-preview";
import { MaskedHeadline, Rise } from "@/components/landing/motion";
import { LandingNav } from "@/components/landing/nav";
import { btn, cx, Kbd, Monogram, Pill, readable } from "@/components/ui/primitives";

const REPO = "https://github.com/Uoerim/blueprint";

export default function Home() {
  return (
    <>
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Philosophy />
        <HowItWorks />
        <Features />
        <Security />
        <OpenSource />
      </main>
      <Footer />
    </>
  );
}

function PrimaryCta({ label = "Get started →" }: { label?: string }) {
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
      <div className="relative mx-auto max-w-[1240px] px-4 pb-24 pt-16 sm:px-6 md:pt-24">
        <Rise>
          <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/[0.04] px-3.5 font-mono text-[13px] tracking-wide text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">
            <span className="size-1.5 rounded-full bg-emerald" aria-hidden />
            v1.0 // MULTI-TEAM EXECUTION ENGINE
          </span>
        </Rise>
        <MaskedHeadline
          lines={["Where raw ideas become", "shipped reality."]}
          className="mt-6 text-[clamp(1.85rem,7.2vw,6.25rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-ink"
        />
        <Rise delay={0.35} className="mt-7 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
            A private vault and execution board for friends and small squads. Dump ideas in three seconds, promote the good ones into tasks, and see who&apos;s grinding on what right now.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <PrimaryCta />
            <a href="#how-it-works" className={cx(btn.outline, "h-11 px-5")}>See how it works</a>
          </div>
        </Rise>

        <Rise delay={0.5} className="mt-14 md:mt-16">
          <LivePreview />
          <p className="mt-3 text-[13px] text-ink-3">
            This is the real thing, running in your browser. Promote an idea, start focus, mark it done. Your teammates in the demo keep working while you watch.
          </p>
        </Rise>
      </div>
    </section>
  );
}

/* ── Philosophy ─────────────────────────────────────────────────────────── */

function Philosophy() {
  return (
    <section id="philosophy" className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6 md:py-40">
      <div className="grid gap-10 md:grid-cols-12">
        <Rise className="md:col-span-5">
          <h2 className="text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
            Momentum dies in setup screens.
          </h2>
        </Rise>
        <div className="space-y-5 text-[17px] leading-[1.6] text-ink-2 md:col-span-6 md:col-start-7">
          <Rise as="p" className="font-medium text-ink">
            Enterprise project managers were built for org charts. Four friends with a side project need none of it: no sprints, no story points, no seat licences, no workflow editor.
          </Rise>
          <Rise as="p" delay={0.06}>
            What a squad actually needs is a place to throw ideas the moment they land, a way to agree which ones are worth doing, and a quiet signal that someone is on it.
          </Rise>
          <Rise as="p" delay={0.12}>
            Blueprint is those three things, done well. Every idea starts raw. Teammates spark the ones they believe in. The good ones get promoted into small tasks with names on them. And when something ships, it stays on the record, so the squad can see how far it&apos;s come.
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ── How it works ───────────────────────────────────────────────────────── */

const STEPS = [
  {
    lead: "To begin,",
    body: "anyone in the squad dumps an idea into the vault. Press ⌘K, type it, add a hashtag or two. Under three seconds, no form.",
    evidence: (
      <div data-ui className="flex items-center gap-2 rounded-xl bg-surface p-2 pl-3 shadow-highlight">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">Preset packs named after cities we&apos;ve lived in <span className="text-amber">#random</span></span>
        <Kbd>⌘</Kbd><Kbd>K</Kbd>
      </div>
    ),
  },
  {
    lead: "Within a day,",
    body: "the squad has sparked what it believes in. Sparks are cheap co-signs, not votes, so the vault sorts itself without a meeting.",
    evidence: (
      <div data-ui className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-highlight">
        <div className="flex -space-x-1.5">
          <Monogram name="ada" color="#10B981" size={24} />
          <Monogram name="grace" color="#F43F5E" size={24} />
          <Monogram name="mo" color="#06B6D4" size={24} />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">Arpeggiator that follows the phone&apos;s tilt</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-amber/15 px-2 py-1 font-mono text-[13px] text-amber"><svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" /></svg>3</span>
      </div>
    ),
  },
  {
    lead: "When it's ready,",
    body: "promote it. A drawer slides in, you break the idea into concrete tasks, and each one gets an @owner and a priority.",
    evidence: (
      <div data-ui className="space-y-1.5 rounded-xl bg-surface p-3 shadow-highlight">
        {[
          ["Read accelerometer at 60Hz", "linus_k", "#F59E0B", "High"],
          ["Map tilt to tempo curve", "grace", "#F43F5E", "Med"],
        ].map(([t, h, c, p]) => (
          <div key={t} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{t}</span>
            <span className="font-mono text-[11px]" style={{ color: readable(c) }}>@{h}</span>
            <Pill color={p === "High" ? "#F43F5E" : "#F59E0B"}>{p}</Pill>
          </div>
        ))}
      </div>
    ),
  },
  {
    lead: "From then on,",
    body: "you press Start Working and your name lights up in the Live Focus dock. Mark it done and it moves to the shipped archive, with your handle on it.",
    evidence: (
      <div data-ui className="flex items-center gap-3 rounded-xl bg-emerald/10 p-3">
        <Monogram name="mo" color="#06B6D4" size={24} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          <span className="font-mono text-[11px] text-cyan">@mo</span> shipped TestFlight build for the four of us
        </span>
        <span className="font-mono text-[11px] text-ink-3">8h ago</span>
      </div>
    ),
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface/40 py-28 md:py-40">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="md:ml-[25%] md:max-w-[600px]">
          <Rise>
            <h2 className="text-[clamp(1.6rem,2.6vw,2.25rem)] font-semibold tracking-[-0.03em]">From shower thought to shipped.</h2>
          </Rise>
          <ol className="mt-12 space-y-16">
            {STEPS.map((s, i) => (
              <Rise as="li" key={s.lead} delay={i * 0.04}>
                <p className="text-[17px] leading-[1.6] text-ink-2">
                  <strong className="font-semibold text-ink">{s.lead}</strong> {s.body}
                </p>
                <div className="mt-5">{s.evidence}</div>
              </Rise>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── Features (bento) ───────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6 md:py-40">
      <Rise>
        <h2 className="max-w-[18ch] text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
          Four things, built to feel instant.
        </h2>
      </Rise>
      <div className="mt-12 grid gap-3 md:grid-cols-6">
        <Rise className="card rounded-2xl p-5 md:col-span-3 md:p-6">
          <h3 className="text-lg font-semibold tracking-tight">Instant @username squad invites</h3>
          <p className="mt-1.5 max-w-[44ch] text-[15px] leading-relaxed text-ink-2">
            Everyone claims a unique handle on day one. Type @ and a few letters, send the invite, they accept with one click.
          </p>
          <div className="mt-5"><InviteDemo /></div>
        </Rise>
        <Rise delay={0.06} className="card rounded-2xl p-5 md:col-span-3 md:p-6">
          <h3 className="text-lg font-semibold tracking-tight">Live team focus</h3>
          <p className="mt-1.5 max-w-[44ch] text-[15px] leading-relaxed text-ink-2">
            Who is grinding on what, right now, glowing in their own colour. No status meetings, no &ldquo;what are you on?&rdquo; messages.
          </p>
          <div className="mt-5"><FocusHud /></div>
        </Rise>
        <Rise className="card rounded-2xl p-5 md:col-span-4 md:p-6">
          <h3 className="text-lg font-semibold tracking-tight">Idea-to-task pipeline</h3>
          <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
            One sparked idea becomes a handful of owned, prioritised tasks, and every task remembers the idea it came from.
          </p>
          <div className="mt-6"><PipelineDemo /></div>
        </Rise>
        <Rise delay={0.06} className="card rounded-2xl p-5 md:col-span-2 md:p-6">
          <h3 className="text-lg font-semibold tracking-tight">Fortress security</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
            Rate limits, team isolation and strict validation on every request.
          </p>
          <div className="mt-5"><SecurityTerminal /></div>
        </Rise>
      </div>
    </section>
  );
}

/* ── Security ───────────────────────────────────────────────────────────── */

const TIERS = [
  ["Global, per IP", "100", "Every request, checked in the proxy before auth"],
  ["Search & handle checks", "30", "Anti-enumeration: nobody scrapes the user directory"],
  ["Writes", "20", "Teams, invites, ideas, tasks — per IP and per user"],
  ["Auth & onboarding", "10", "Claiming a handle, per IP"],
];

const GUARANTEES = [
  ["Zero-trust membership", "Every team-scoped action re-proves you belong to that team in Postgres. URL slugs and client ids are never trusted."],
  ["Anti-IDOR by construction", "Every update and delete is scoped with { id, teamId } of the verified team, so a guessed id from another squad matches nothing."],
  ["Strict validation", "Zod .strict() schemas on every input, control characters and HTML stripped, Prisma parameterised queries only."],
  ["Hardened headers", "Per-request nonce CSP with strict-dynamic, HSTS preload, frame-ancestors none, nosniff and a locked-down permissions policy."],
];

function Security() {
  return (
    <section id="security" className="bg-surface/40 py-28 md:py-40">
      <div className="mx-auto grid max-w-[1240px] gap-14 px-4 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <Rise>
            <h2 className="text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">Private by default. Hard to abuse.</h2>
          </Rise>
          <Rise delay={0.06} as="p" className="mt-5 max-w-[42ch] text-[17px] leading-[1.6] text-ink-2">
            Your squad&apos;s half-formed ideas are the most private thing you own. Sliding-window limits run on every request, sixty-second windows, with standard Retry-After and X-RateLimit headers.
          </Rise>
        </div>
        <div className="md:col-span-7">
          <Rise>
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">Rate limit tiers per 60 seconds</caption>
              <thead>
                <tr className="border-b border-line-strong text-[13px] text-ink-3">
                  <th className="pb-3 font-medium">Tier</th>
                  <th className="pb-3 font-medium">Per minute</th>
                  <th className="hidden pb-3 font-medium sm:table-cell">Why</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map(([tier, n, why]) => (
                  <tr key={tier} className="border-b border-line">
                    <td className="py-3.5 pr-4 text-ink">{tier}</td>
                    <td className="py-3.5 pr-4 font-mono tabular-nums text-ink">{n}</td>
                    <td className="hidden py-3.5 text-ink-2 sm:table-cell">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rise>
          <dl className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {GUARANTEES.map(([t, d], i) => (
              <Rise key={t} delay={i * 0.05}>
                <dt className="font-semibold text-ink">{t}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{d}</dd>
              </Rise>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── Open source / CTA ──────────────────────────────────────────────────── */

function OpenSource() {
  return (
    <section id="open-source" className="mx-auto max-w-[1240px] px-4 pb-24 pt-[24svh] sm:px-6">
      <Rise className="md:ml-[25%]">
        <p className="max-w-[34ch] text-[22px] leading-snug text-ink">
          Clone it, self-host it, run it with your friends for free. Just don&apos;t sell it.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PrimaryCta label="Start your squad →" />
          <a href={REPO} target="_blank" rel="noopener noreferrer" className={cx(btn.outline, "h-11 px-5")}>
            <GitHubIcon /> View source
          </a>
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer license"
            className="inline-flex h-8 items-center rounded-md bg-white/[0.05] px-2.5 font-mono text-[13px] tracking-wide text-ink-2 transition-colors hover:text-ink"
          >
            CC BY-NC-SA 4.0
          </a>
        </div>
      </Rise>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1240px] px-4 pb-8 pt-[14svh] sm:px-6">
      <div className="grid gap-2 text-sm text-ink-3 md:grid-cols-[1fr_auto_1fr] md:items-baseline">
        <span>Blueprint, built for squads.</span>
        <span className="flex flex-wrap gap-6">
          <a className="text-ink transition-colors hover:text-accent" href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="text-ink transition-colors hover:text-accent" href="#security">Security</a>
          <a className="text-ink transition-colors hover:text-accent" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer license">License</a>
        </span>
        <span className="md:text-right">© 2026 · Non-commercial open source</span>
      </div>
    </footer>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
