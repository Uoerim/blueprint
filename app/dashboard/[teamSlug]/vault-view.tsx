"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { archiveIdea, createIdea, deleteIdea, promoteIdea, toggleSpark, updateIdea } from "@/app/actions/ideas";
import { ClaudeMark } from "@/components/claude-mark";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, Pill, PRIORITY_COLORS, readable } from "@/components/ui/primitives";
import { LIMITS, PRIORITY_LABEL } from "@/lib/constants";
import { newId } from "@/lib/live";
import { useTourDemo } from "@/lib/tour-demo";
import { timeAgo } from "@/lib/time";
import type { IdeaDTO, Priority } from "@/lib/types";
import { BoardView } from "./board-view";
import { ImportDialog } from "./import-dialog";
import { useWorkspace } from "./workspace";

const spring = { type: "spring", stiffness: 480, damping: 36 } as const;
const dots = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
    <circle cx="3" cy="7" r="1.2" fill="currentColor" />
    <circle cx="7" cy="7" r="1.2" fill="currentColor" />
    <circle cx="11" cy="7" r="1.2" fill="currentColor" />
  </svg>
);

export function TagPill({ name }: { name: string }) {
  const { tags } = useWorkspace();
  const tag = tags.find((t) => t.name === name);
  return <Pill color={tag?.color}>#{name}</Pill>;
}

/** Toggle team tags on a task (up to 5). */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { tags } = useWorkspace();
  if (!tags.length) return <p className="text-[12px] text-ink-3">This team has no tags yet. Owners can add them in team settings.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = value.includes(t.name);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            disabled={!on && value.length >= 5}
            onClick={() => onChange(on ? value.filter((x) => x !== t.name) : [...value, t.name])}
            className="h-7 rounded-md px-2 font-mono text-[11px] transition-[background-color,transform] active:scale-95 disabled:opacity-40"
            style={on ? { color: `color-mix(in oklab, ${t.color} 62%, var(--ink))`, backgroundColor: `${t.color}24`, boxShadow: `inset 0 0 0 1px ${t.color}55` } : { color: "var(--ink-3)", backgroundColor: "color-mix(in oklab, var(--tint) 4%, transparent)" }}
          >
            #{t.name}
          </button>
        );
      })}
    </div>
  );
}

/** Promote straight away and open the new project page to plan its tasks there. */
function usePromote() {
  const { team, run, patchIdea, openProject } = useWorkspace();
  return (idea: IdeaDTO) =>
    run(() => promoteIdea({ teamId: team.id, ideaId: idea.id }), {
      optimistic: () => {
        patchIdea(idea.id, { status: "PROMOTED" });
        openProject(idea.id);
      },
      success: "Moved to Execution. Add its tasks here.",
    });
}

export function VaultView({ ideaId }: { ideaId: string | null }) {
  const demoIdea = useTourDemo("idea");
  const { ideas, can, openIdea, openProject } = useWorkspace();
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [importing, setImporting] = useState(false);
  const canImport = can("ideas.create") && can("tasks.create");
  const open = ideaId ? ideas.find((i) => i.id === ideaId && i.status === "VAULT") : undefined;

  if (open) return <IdeaPage idea={open} />;

  const vault = ideas
    .filter((i) => i.status === "VAULT")
    .sort((a, b) =>
      sort === "hot"
        ? b.sparksCount - a.sparksCount || b.createdAt.localeCompare(a.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  const promoted = ideas.filter((i) => i.status === "PROMOTED");

  return (
    <div>
      {ideaId && (
        <p className="mb-3 rounded-xl bg-amber/10 px-4 py-2.5 text-[13px] text-amber">
          That idea isn&apos;t in the vault any more. It may have been promoted, archived or deleted.{" "}
          <button type="button" onClick={() => openIdea(null)} className="underline underline-offset-2">Back to the vault</button>
        </p>
      )}
      {can("ideas.create") ? (
        <CaptureBar onImport={canImport ? () => setImporting(true) : undefined} />
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-3 shadow-highlight">
          Your role can spark ideas but not add new ones. Ask the team owner if you need to.
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-2">Raw ideas <span className="font-mono text-[11px] text-ink-3">{vault.length}</span></h2>
        <div className="flex rounded-lg bg-surface p-0.5 shadow-highlight" role="radiogroup" aria-label="Sort ideas">
          {(["hot", "new"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              onClick={() => setSort(s)}
              className={cx("h-7 rounded-md px-2.5 text-xs transition-colors", sort === s ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {s === "hot" ? "Most sparked" : "Newest"}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {demoIdea && <DemoIdeaCard key="tour-demo-idea" />}
          {vault.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </AnimatePresence>
      </ul>
      {!vault.length && !demoIdea && (
        <div className="card mt-3 rounded-2xl px-6 py-14 text-center">
          <p className="text-[15px] text-ink">The vault is empty.</p>
          <p className="mt-1 text-sm text-ink-3">Type the first thing on your mind into the box above.</p>
          {canImport && (
            <button type="button" onClick={() => setImporting(true)} className={cx(btn.ghost, btn.sm, "mt-4 gap-1.5")}>
              <SparkleIcon />
              Or plan one with AI
            </button>
          )}
        </div>
      )}
      {canImport && <ImportDialog open={importing} onClose={() => setImporting(false)} />}

      {promoted.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-medium text-ink-2">In execution <span className="font-mono text-[11px] text-ink-3">{promoted.length}</span></h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-highlight">
            {promoted.map((i) => {
              const pct = i.taskCount ? Math.round((i.doneCount / i.taskCount) * 100) : 0;
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => openProject(i.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-tint/[0.03]">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{i.title}</span>
                    <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-tint/[0.06] sm:block">
                      <motion.span className="block h-full rounded-full bg-emerald" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-3">{i.doneCount}/{i.taskCount} done</span>
                    <span className="text-[13px] text-ink-3" aria-hidden>→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function SparkleIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}

function CaptureBar({ onImport }: { onImport?: () => void }) {
  const { team, viewer, run, addIdea } = useWorkspace();
  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.replace(/\s+/g, " ").trim();
    if (!title) return;
    const now = new Date().toISOString();
    const ideaId = newId();
    setDraft("");
    run(() => createIdea({ id: ideaId, teamId: team.id, title }), {
      pendingId: ideaId,
      optimistic: () =>
        addIdea({
          id: ideaId,
          title,
          description: null,
          status: "VAULT",
          createdVia: null,
          sparksCount: 0,
          sparkedByMe: false,
          authorId: viewer.id,
          createdAt: now,
          taskCount: 0,
          doneCount: 0,
        }),
    });
  };

  return (
    <form onSubmit={submit} data-tour="capture" className="card rounded-2xl p-2 transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--accent),0_0_0_4px_rgba(99,102,241,0.18)]">
      <div className="flex items-center gap-2 px-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-ink-3">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          aria-label="Capture a raw idea"
          placeholder="Dump a raw idea…"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button type="submit" disabled={!draft.trim()} className={cx(btn.primary, btn.sm)}>Drop it</button>
      </div>
      {onImport && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-2 pb-0.5 pt-2">
          <p className="min-w-0 text-[12px] text-ink-3">Got a bigger plan? Let an AI break it into tasks.</p>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-accent transition-[background-color,transform] hover:bg-accent/10 active:scale-95"
          >
            <SparkleIcon />
            Import with AI
          </button>
        </div>
      )}
    </form>
  );
}

function SparkButton({ idea, disabled }: { idea: IdeaDTO; disabled?: boolean }) {
  const { team, run, patchIdea } = useWorkspace();
  const spark = () =>
    run(() => toggleSpark({ teamId: team.id, itemId: idea.id }), {
      optimistic: () =>
        patchIdea(idea.id, { sparkedByMe: !idea.sparkedByMe, sparksCount: idea.sparksCount + (idea.sparkedByMe ? -1 : 1) }),
    });
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      disabled={disabled}
      onClick={spark}
      aria-pressed={idea.sparkedByMe}
      aria-label={`Spark, ${idea.sparksCount} sparks`}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs transition-colors",
        idea.sparkedByMe ? "bg-amber/15 text-amber" : "text-ink-3 hover:bg-tint/[0.06] hover:text-ink",
      )}
    >
      <motion.svg key={String(idea.sparkedByMe)} initial={{ rotate: -40, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={spring} width="13" height="13" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
      </motion.svg>
      {idea.sparksCount}
    </motion.button>
  );
}

/** Archive / delete for one idea, shared by the card and the idea page. */
function IdeaMenu({ idea, onGone, triggerClassName }: { idea: IdeaDTO; onGone?: () => void; triggerClassName?: string }) {
  const { team, run, removeIdea } = useWorkspace();
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Popover label="Idea actions" align="end" triggerClassName={triggerClassName ?? "size-7 justify-center text-ink-3 hover:text-ink"} trigger={dots}>
        {(close) => (
          <>
            <MenuItem
              onSelect={() => {
                close();
                onGone?.();
                run(() => archiveIdea({ teamId: team.id, itemId: idea.id }), {
                  optimistic: () => removeIdea(idea.id),
                  success: "Idea archived. Restore it from team settings.",
                });
              }}
            >
              Archive idea
            </MenuItem>
            <MenuItem
              onSelect={() => {
                close();
                setDeleting(true);
              }}
            >
              <span className="text-rose">Delete idea</span>
            </MenuItem>
          </>
        )}
      </Popover>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete idea?"
        description={
          idea.taskCount
            ? <>&ldquo;{idea.title}&rdquo; has {idea.taskCount} task{idea.taskCount === 1 ? "" : "s"}, so only the team owner can delete it. Archive it instead to hide it.</>
            : <>&ldquo;{idea.title}&rdquo; and its sparks will be deleted for everyone. To hide it but keep it, archive it instead.</>
        }
        confirmLabel="Delete idea"
        level={{ kind: "ack" }}
        onConfirm={() => {
          onGone?.();
          run(() => deleteIdea({ teamId: team.id, itemId: idea.id }), {
            optimistic: () => removeIdea(idea.id),
            success: "Idea deleted.",
          });
        }}
      />
    </>
  );
}

/** A sample idea the team tour shows on screen when there's nothing to promote yet. Never saved. */
function DemoIdeaCard() {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={spring}
      aria-hidden
      className="card flex flex-col rounded-2xl p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--amber)_45%,transparent)]"
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink">Turn practice sessions into a weekly recap</p>
        <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber">Example</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">A sample idea for the tour. It isn&apos;t saved anywhere.</p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <span className="font-mono text-[11px] text-ink-3">just now</span>
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-ink-3">✦ 2</span>
        <span data-tour="promote" className={cx(btn.outline, btn.sm)}>
          Promote →
        </span>
      </div>
    </motion.li>
  );
}

function IdeaCard({ idea }: { idea: IdeaDTO }) {
  const { member, viewer, can, openIdea, isPending } = useWorkspace();
  const promote = usePromote();
  const author = member(idea.authorId);
  const temp = isPending(idea.id);
  const canManage = idea.authorId === viewer.id || can("ideas.manage");

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: temp ? 0.7 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={spring}
      className="card group relative flex cursor-pointer flex-col rounded-2xl p-4 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        {/* The title's hit area covers the whole card (the controls below sit above it). */}
        <button
          type="button"
          disabled={temp}
          onClick={() => openIdea(idea.id)}
          className="min-w-0 flex-1 text-left text-[15px] font-medium leading-snug text-ink transition-colors after:absolute after:inset-0 after:rounded-2xl group-hover:text-accent"
        >
          {idea.title}
        </button>
        {canManage && !temp && (
          <span className="relative z-10">
            <IdeaMenu idea={idea} triggerClassName="size-7 justify-center text-ink-3 opacity-60 group-hover:opacity-100 hover:text-ink" />
          </span>
        )}
      </div>
      {idea.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-2">{idea.description}</p>}
      {(idea.taskCount > 0 || idea.createdVia === "claude") && (
        <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-3">
          {idea.createdVia === "claude" && <ClaudeMark kind="made" className="font-sans" />}
          {idea.taskCount > 0 && (
            <span>
              {idea.doneCount}/{idea.taskCount} tasks
            </span>
          )}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        {author && <Monogram name={author.username} color={author.accentColor} src={author.imageUrl} size={20} />}
        <span className="min-w-0 truncate font-mono text-[11px]" style={{ color: readable(author?.accentColor) }}>
          @{author?.username ?? "former member"}
        </span>
        <span className="mono-meta shrink-0 !text-[11px]" suppressHydrationWarning>{timeAgo(idea.createdAt)}</span>
        <span className="flex-1" />
        <span className="relative z-10 flex items-center gap-2">
          <SparkButton idea={idea} disabled={temp} />
          {can("projects.create") && (
            <button type="button" data-tour="promote" disabled={temp} onClick={() => promote(idea)} className={cx(btn.outline, btn.sm)}>
              Promote →
            </button>
          )}
        </span>
      </div>
    </motion.li>
  );
}

/* ── One raw idea ───────────────────────────────────────────────────────── */

function IdeaPage({ idea }: { idea: IdeaDTO }) {
  const { member, viewer, can, openIdea } = useWorkspace();
  const promote = usePromote();
  const [editing, setEditing] = useState(false);
  const author = member(idea.authorId);
  const canManage = idea.authorId === viewer.id || can("ideas.manage");

  return (
    <div>
      <button type="button" onClick={() => openIdea(null)} className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> Idea vault
      </button>

      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span className="text-amber" aria-hidden>✦</span> Raw idea, still in the vault
            {idea.createdVia === "claude" && <ClaudeMark kind="made" className="ml-1" />}
          </p>
          <h2 className="mt-1 text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">{idea.title}</h2>
          <p className="mt-2 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">
            {idea.description || <span className="text-ink-3">No description yet.</span>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {author && (
              <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
                by <span className="font-mono" style={{ color: readable(author.accentColor) }}>@{author.username}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SparkButton idea={idea} />
          {canManage && <button type="button" onClick={() => setEditing(true)} className={cx(btn.outline, btn.sm)}>Edit</button>}
          {can("projects.create") && (
            <button type="button" onClick={() => promote(idea)} className={cx(btn.primary, btn.sm)}>
              Promote to execution →
            </button>
          )}
          {canManage && <IdeaMenu idea={idea} onGone={() => openIdea(null)} />}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-ink-2">Tasks</h3>
        <p className="mt-0.5 text-[13px] text-ink-3">Plan it while it&apos;s still an idea. Its tasks and subtasks move to Execution with it when you promote it.</p>
        <div className="mt-3">
          <BoardView projectId={idea.id} />
        </div>
      </div>

      <IdeaDialog idea={editing ? idea : null} onClose={() => setEditing(false)} />
    </div>
  );
}

/** Edit an idea's title and description. */
export function IdeaDialog({ idea, onClose }: { idea: IdeaDTO | null; onClose: () => void }) {
  return (
    <Dialog open={!!idea} onClose={onClose} title="Edit idea">
      {idea && <IdeaForm key={idea.id} idea={idea} onClose={onClose} />}
    </Dialog>
  );
}

function IdeaForm({ idea, onClose }: { idea: IdeaDTO; onClose: () => void }) {
  const { team, run, patchIdea } = useWorkspace();
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const d = description.trim();
    onClose();
    run(() => updateIdea({ teamId: team.id, itemId: idea.id, title: t, description: d }), {
      optimistic: () => patchIdea(idea.id, { title: t, description: d || null }),
      success: "Saved.",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      <Field label="Title" htmlFor="idea-title">
        <input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} required className={cx(inputCls, "h-10")} />
      </Field>
      <Field label="Description" htmlFor="idea-desc">
        <textarea id="idea-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={LIMITS.ideaBody} rows={4} className={cx(inputCls, "resize-y py-2.5 leading-relaxed")} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>Cancel</button>
        <button type="submit" disabled={!title.trim()} className={cx(btn.primary, btn.sm)}>Save</button>
      </div>
    </form>
  );
}

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <Popover
      label="Priority"
      triggerClassName="h-8 px-1.5"
      trigger={<Pill color={PRIORITY_COLORS[value]}>{PRIORITY_LABEL[value]}</Pill>}
    >
      {(close) => (
        <>
          {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
            <MenuItem key={p} active={value === p} onSelect={() => { onChange(p); close(); }}>
              <span className="size-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
              {PRIORITY_LABEL[p]}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}
