"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { btn, cx } from "@/components/ui/primitives";
import type { IncomingInvite } from "@/lib/types";
import { CreateTeamDialog } from "../_components/create-team-dialog";
import { InviteList } from "../_components/invites-bell";

type Focus = "ideas" | "tasks";

const COPY: Record<Focus, { title: string; body: string }> = {
  ideas: {
    title: "Ideas live in a team",
    body: "Start a team to open your idea vault: drop raw ideas, spark the ones worth building and promote them into projects. A team of one works too.",
  },
  tasks: {
    title: "Tasks live in a team",
    body: "Start a team to turn ideas into projects, split them into tasks and see who's working on what, live. A team of one works too.",
  },
};

/** The Ideas and Tasks tabs before you're in a team: what will live here, and how to get in. */
export function NoTeamScreen({ focus, username, invites }: { focus: Focus; username: string; invites: IncomingInvite[] }) {
  const [creating, setCreating] = useState(false);
  const { title, body } = COPY[focus];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-10 pt-6 sm:pt-12 app:pt-3">
      {focus === "ideas" ? <IdeasPreview /> : <TasksPreview />}

      <h1 className="mt-7 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>

      <button type="button" onClick={() => setCreating(true)} className={cx(btn.primary, "mt-6 h-12 w-full text-[15px]")}>
        Create a team
      </button>
      <CreateTeamDialog open={creating} onClose={() => setCreating(false)} />

      {invites.length > 0 ? (
        <section aria-labelledby="waiting-h" className="mt-8">
          <h2 id="waiting-h" className="text-sm font-medium text-ink-2">
            Waiting for you <span className="font-mono text-[11px] text-ink-3">{invites.length}</span>
          </h2>
          <div className="card mt-2 rounded-2xl p-2">
            <InviteList invites={invites} />
          </div>
        </section>
      ) : (
        <ShareUsername username={username} />
      )}
    </div>
  );
}

/** For joining someone else's team: they invite you by @username, so make it one tap to share. */
function ShareUsername({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="card mt-8 flex items-center gap-3 rounded-2xl p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">Joining a friend&apos;s team?</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-3">Send them your username so they can invite you. Invites show up here.</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy your username, ${username}`}
        className={cx(btn.outline, "h-10 shrink-0 px-3 font-mono text-[13px]", copied && "text-emerald")}
      >
        {/* Both labels share one cell, so the button keeps its width when the text changes. */}
        <span className="grid">
          <span className={cx("col-start-1 row-start-1 transition-opacity", copied && "opacity-0")}>@{username}</span>
          <span aria-hidden className={cx("col-start-1 row-start-1 text-center transition-opacity", !copied && "opacity-0")}>
            Copied
          </span>
        </span>
      </button>
      <span role="status" className="sr-only">
        {copied ? "Username copied" : ""}
      </span>
    </div>
  );
}

/* ── Previews: a quiet picture of what the tab will hold once you're in a team. ── */

function useRise() {
  const still = useReducedMotion();
  return (i: number) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.08 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
        };
}

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="card relative overflow-hidden rounded-3xl p-4">
      <div className="bg-architect pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_70%_at_50%_0%,black,transparent)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

const IDEAS = [
  { w: "w-3/4", tag: "feature", tone: "text-accent bg-accent/12", sparks: 5, lead: true },
  { w: "w-1/2", tag: "experiment", tone: "text-emerald bg-emerald/12", sparks: 3 },
  { w: "w-2/3", tag: "bug", tone: "text-rose bg-rose/12", sparks: 1 },
];

function IdeasPreview() {
  const rise = useRise();
  return (
    <PreviewFrame>
      <div className="space-y-2.5">
        {IDEAS.map((idea, i) => (
          <motion.div key={idea.tag} {...rise(i)} className="rounded-2xl border border-line bg-surface-2/80 p-3">
            <div className={cx("h-2.5 rounded-full bg-tint/15", idea.w)} />
            <div className="mt-3 flex items-center gap-2">
              <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-[10px]", idea.tone)}>#{idea.tag}</span>
              <span className="font-mono text-[11px] text-ink-3">✦ {idea.sparks}</span>
              {idea.lead && (
                <span className="ml-auto rounded-lg bg-ink px-2 py-1 text-[11px] font-medium text-bg">Promote →</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </PreviewFrame>
  );
}

const COLUMNS = [
  { label: "Backlog", cards: ["w-4/5", "w-3/5"] },
  { label: "In progress", cards: ["w-2/3"], live: true },
  { label: "Done", cards: ["w-3/4", "w-1/2"], done: true },
];

function TasksPreview() {
  const rise = useRise();
  return (
    <PreviewFrame>
      <div className="grid grid-cols-3 gap-2">
        {COLUMNS.map((col, c) => (
          <div key={col.label} className="min-w-0">
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-3">{col.label}</p>
            <div className="mt-2 space-y-2">
              {col.cards.map((w, i) => (
                <motion.div
                  key={w + i}
                  {...rise(c * 2 + i)}
                  className={cx(
                    "relative rounded-xl border bg-surface-2/80 p-2.5",
                    col.live ? "border-rose/40 shadow-[0_0_24px_-10px_var(--rose)]" : "border-line",
                  )}
                >
                  {col.live && <span className="absolute right-2 top-2 size-1.5 animate-pulse rounded-full bg-rose" />}
                  <div className={cx("h-2 rounded-full", col.done ? "bg-emerald/30" : "bg-tint/15", w)} />
                  <div className="mt-2.5 flex items-center gap-1">
                    <span className="size-3.5 rounded-full bg-tint/10" />
                    {col.done && <span className="ml-auto font-mono text-[9px] text-emerald">✓</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}
