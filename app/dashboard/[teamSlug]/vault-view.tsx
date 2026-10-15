"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { archiveIdea, createIdea, promoteIdea, toggleSpark } from "@/app/actions/ideas";
import { Dialog, inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Kbd, Monogram, Pill, PRIORITY_COLORS, TAG_COLORS, readable } from "@/components/ui/primitives";
import { IDEA_TAGS, PRIORITY_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/time";
import type { IdeaDTO, Priority } from "@/lib/types";
import { useWorkspace } from "./workspace";

const spring = { type: "spring", stiffness: 480, damping: 36 } as const;

function parseCapture(raw: string, picked: string[]) {
  const inline = [...raw.matchAll(/#([a-z0-9-]{1,24})/gi)].map((m) => m[1]!.toLowerCase());
  const title = raw.replace(/(^|\s)#[a-z0-9-]+/gi, " ").replace(/\s+/g, " ").trim();
  return { title, tags: [...new Set([...picked, ...inline])].slice(0, 5) };
}

export function VaultView({ onPromoted }: { onPromoted: () => void }) {
  const { ideas } = useWorkspace();
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [promoting, setPromoting] = useState<IdeaDTO | null>(null);

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
      <CaptureBar />

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

      <motion.ul layout className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {vault.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onPromote={() => setPromoting(idea)} />
          ))}
        </AnimatePresence>
      </motion.ul>
      {!vault.length && (
        <div className="card mt-3 rounded-2xl px-6 py-14 text-center">
          <p className="text-[15px] text-ink">The vault is empty.</p>
          <p className="mt-1 text-sm text-ink-3">Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> and dump the first thing on your mind.</p>
        </div>
      )}

      {promoted.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-medium text-ink-2">In execution <span className="font-mono text-[11px] text-ink-3">{promoted.length}</span></h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-highlight">
            {promoted.map((i) => {
              const pct = i.taskCount ? Math.round((i.doneCount / i.taskCount) * 100) : 0;
              return (
                <li key={i.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{i.title}</span>
                  <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                    <motion.span className="block h-full rounded-full bg-emerald" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-3">{i.doneCount}/{i.taskCount} done</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <PromoteDrawer idea={promoting} onClose={() => setPromoting(null)} onDone={onPromoted} />
    </div>
  );
}

function CaptureBar() {
  const { team, viewer, run, addIdea, captureRef } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, tags } = parseCapture(draft, picked);
    if (!title) return;
    const now = new Date().toISOString();
    setDraft("");
    setPicked([]);
    run(() => createIdea({ teamId: team.id, title, tags }), {
      optimistic: () =>
        addIdea({
          id: `tmp-${now}`,
          title,
          description: null,
          tags,
          status: "VAULT",
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
    <form onSubmit={submit} className="card rounded-2xl p-2">
      <div className="flex items-center gap-2 px-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-ink-3">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={captureRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          aria-label="Capture a raw idea"
          placeholder="Dump a raw idea… add #feature, #bug, #experiment or #random"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <span className="hidden items-center gap-1 sm:flex"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        <button type="submit" disabled={!draft.trim()} className={cx(btn.primary, btn.sm)}>Drop it</button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-2 pb-1 pt-1.5">
        {IDEA_TAGS.map((t) => {
          const on = picked.includes(t);
          const color = TAG_COLORS[t]!;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t) : [...p, t]))}
              className="h-7 rounded-md px-2 font-mono text-[11px] transition-[background-color,transform] active:scale-95"
              style={on ? { color, backgroundColor: `${color}20`, boxShadow: `inset 0 0 0 1px ${color}55` } : { color: "var(--ink-3)", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              #{t}
            </button>
          );
        })}
      </div>
    </form>
  );
}

function IdeaCard({ idea, onPromote }: { idea: IdeaDTO; onPromote: () => void }) {
  const { member, viewer, myRole, team, run, patchIdea, removeIdea } = useWorkspace();
  const author = member(idea.authorId);
  const temp = idea.id.startsWith("tmp-");
  const canArchive = idea.authorId === viewer.id || myRole !== "MEMBER";

  const spark = () =>
    run(() => toggleSpark({ teamId: team.id, itemId: idea.id }), {
      optimistic: () =>
        patchIdea(idea.id, { sparkedByMe: !idea.sparkedByMe, sparksCount: idea.sparksCount + (idea.sparkedByMe ? -1 : 1) }),
    });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: temp ? 0.7 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={spring}
      className="card group flex flex-col rounded-2xl p-4 transition-colors hover:bg-[#151519]"
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink">{idea.title}</p>
        {canArchive && !temp && (
          <Popover
            label="Idea actions"
            align="end"
            triggerClassName="size-7 justify-center text-ink-3 opacity-60 group-hover:opacity-100 hover:text-ink"
            trigger={<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>}
          >
            {(close) => (
              <MenuItem
                onSelect={() => {
                  close();
                  run(() => archiveIdea({ teamId: team.id, itemId: idea.id }), {
                    optimistic: () => removeIdea(idea.id),
                    success: "Idea archived.",
                  });
                }}
              >
                Archive idea
              </MenuItem>
            )}
          </Popover>
        )}
      </div>
      {idea.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-2">{idea.description}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {idea.tags.map((t) => (
          <Pill key={t} color={TAG_COLORS[t]}>#{t}</Pill>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4">
        {author && <Monogram name={author.username} color={author.accentColor} size={20} />}
        <span className="min-w-0 truncate font-mono text-[11px]" style={{ color: readable(author?.accentColor) }}>
          @{author?.username ?? "former member"}
        </span>
        <span className="mono-meta shrink-0 !text-[11px]" suppressHydrationWarning>{timeAgo(idea.createdAt)}</span>
        <span className="flex-1" />
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          disabled={temp}
          onClick={spark}
          aria-pressed={idea.sparkedByMe}
          aria-label={`Spark, ${idea.sparksCount} sparks`}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs transition-colors",
            idea.sparkedByMe ? "bg-amber/15 text-amber" : "text-ink-3 hover:bg-white/[0.06] hover:text-ink",
          )}
        >
          <motion.svg key={String(idea.sparkedByMe)} initial={{ rotate: -40, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={spring} width="13" height="13" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
          </motion.svg>
          {idea.sparksCount}
        </motion.button>
        <button type="button" disabled={temp} onClick={onPromote} className={cx(btn.outline, btn.sm)}>
          Promote to execution →
        </button>
      </div>
    </motion.li>
  );
}

/* ── Promote drawer ─────────────────────────────────────────────────────── */

type Draft = { key: number; title: string; assigneeId: string | null; priority: Priority };
let keySeq = 0;

function PromoteDrawer({ idea, onClose, onDone }: { idea: IdeaDTO | null; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Draft[]>([]);
  const [lastIdea, setLastIdea] = useState<string | null>(null);

  // Reset the rows whenever a different idea opens the drawer.
  if (idea && idea.id !== lastIdea) {
    setLastIdea(idea.id);
    setRows([{ key: ++keySeq, title: idea.title.slice(0, 140), assigneeId: null, priority: "MEDIUM" }]);
  }

  return (
    <Dialog
      open={!!idea}
      onClose={onClose}
      side="right"
      title="Promote to execution"
      description="Break the idea into concrete tasks. Each one gets an owner and a priority."
    >
      {idea && <PromoteForm idea={idea} rows={rows} setRows={setRows} onClose={onClose} onDone={onDone} />}
    </Dialog>
  );
}

function PromoteForm({
  idea,
  rows,
  setRows,
  onClose,
  onDone,
}: {
  idea: IdeaDTO;
  rows: Draft[];
  setRows: React.Dispatch<React.SetStateAction<Draft[]>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { team, members, member, run, patchIdea } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const update = (key: number, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const valid = rows.filter((r) => r.title.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid.length) return;
    setBusy(true);
    run(
      () =>
        promoteIdea({
          teamId: team.id,
          ideaId: idea.id,
          tasks: valid.map((r) => ({ title: r.title.trim(), assigneeId: r.assigneeId, priority: r.priority })),
        }),
      {
        optimistic: () => patchIdea(idea.id, { status: "PROMOTED", taskCount: valid.length }),
        success: `Promoted into ${valid.length} task${valid.length > 1 ? "s" : ""}.`,
        onOk: () => {
          onClose();
          onDone();
        },
      },
    );
    window.setTimeout(() => setBusy(false), 600);
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="rounded-xl bg-surface-2 p-4 shadow-highlight">
        <p className="text-[15px] font-medium text-ink">{idea.title}</p>
        {idea.description && <p className="mt-1 text-sm text-ink-2">{idea.description}</p>}
        <p className="mono-meta mt-2">{idea.sparksCount} sparks</p>
      </div>

      <ul className="mt-5 space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => {
            const a = member(r.assigneeId);
            return (
              <motion.li
                key={r.key}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={spring}
                className="rounded-xl bg-surface p-2 shadow-highlight"
              >
                <input
                  value={r.title}
                  autoFocus={i === rows.length - 1}
                  maxLength={140}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  aria-label={`Task ${i + 1} title`}
                  placeholder="What needs doing?"
                  className={cx(inputCls, "h-10 !shadow-none bg-transparent")}
                />
                <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
                  <Popover
                    label="Assignee"
                    triggerClassName="h-8 gap-2 px-2 text-xs"
                    className="w-56"
                    trigger={
                      a ? (
                        <><Monogram name={a.username} color={a.accentColor} size={20} /><span className="font-mono" style={{ color: readable(a.accentColor) }}>@{a.username}</span></>
                      ) : (
                        <><span className="size-5 rounded-[28%] border border-dashed border-ink-3/60" /><span className="text-ink-3">Unassigned</span></>
                      )
                    }
                  >
                    {(close) => (
                      <>
                        <MenuItem active={!r.assigneeId} onSelect={() => { update(r.key, { assigneeId: null }); close(); }}>
                          <span className="size-5 rounded-[28%] border border-dashed border-ink-3/60" /> Unassigned
                        </MenuItem>
                        {members.map((m) => (
                          <MenuItem key={m.userId} active={r.assigneeId === m.userId} onSelect={() => { update(r.key, { assigneeId: m.userId }); close(); }}>
                            <Monogram name={m.username} color={m.accentColor} size={20} />
                            <span className="font-mono text-xs" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
                          </MenuItem>
                        ))}
                      </>
                    )}
                  </Popover>
                  <PriorityPicker value={r.priority} onChange={(p) => update(r.key, { priority: p })} />
                  <span className="flex-1" />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className={cx(btn.ghost, btn.xs)}>
                      Remove
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {rows.length < 12 && (
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: ++keySeq, title: "", assigneeId: null, priority: "MEDIUM" }])}
          className={cx(btn.ghost, btn.sm, "mt-2 self-start")}
        >
          + Add task
        </button>
      )}

      <div className="mt-auto flex justify-end gap-2 pt-6">
        <button type="button" onClick={onClose} className={btn.ghost}>Cancel</button>
        <button type="submit" disabled={busy || !valid.length} className={btn.accent}>
          Promote {valid.length} task{valid.length === 1 ? "" : "s"} →
        </button>
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
