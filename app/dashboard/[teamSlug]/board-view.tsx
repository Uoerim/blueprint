"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { assignTask, createTask, setTaskPriority, setTaskStatus, startFocus, updateTask } from "@/app/actions/tasks";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { TASK_COLUMNS } from "@/lib/constants";
import type { TaskDTO, TaskStatus } from "@/lib/types";
import { PriorityPicker } from "./vault-view";
import { useWorkspace } from "./workspace";

const spring = { type: "spring", stiffness: 520, damping: 40 } as const;
type Filter = { kind: "all" } | { kind: "mine" } | { kind: "unassigned" } | { kind: "member"; id: string };
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** The task board. With projectId it shows only that project's tasks and adds new ones to it. */
export function BoardView({ projectId, initialFilter = "all" }: { projectId?: string; initialFilter?: "all" | "mine" } = {}) {
  const { tasks: allTasks, members, viewer } = useWorkspace();
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [filter, setFilter] = useState<Filter>({ kind: initialFilter });
  const [editing, setEditing] = useState<string | null>(null);
  const scoped = !!projectId;
  const tasks = projectId ? allTasks.filter((t) => t.idea?.id === projectId) : allTasks;

  const visible = tasks
    .filter((t) => {
      if (filter.kind === "mine") return t.assigneeId === viewer.id;
      if (filter.kind === "unassigned") return !t.assigneeId;
      if (filter.kind === "member") return t.assigneeId === filter.id;
      return true;
    })
    .sort((a, b) => Number(b.isFocused) - Number(a.isFocused) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const pill = (active: boolean) =>
    cx("h-8 shrink-0 rounded-lg px-3 text-[13px] transition-colors active:scale-95", active ? "bg-ink text-bg" : "bg-surface text-ink-2 shadow-highlight hover:text-ink");

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filter tasks">
          <button type="button" className={pill(filter.kind === "all")} onClick={() => setFilter({ kind: "all" })}>All tasks</button>
          <button type="button" className={pill(filter.kind === "mine")} onClick={() => setFilter({ kind: "mine" })}>My tasks</button>
          <button type="button" className={pill(filter.kind === "unassigned")} onClick={() => setFilter({ kind: "unassigned" })}>Unassigned</button>
          {members.map((m) => {
            const on = filter.kind === "member" && filter.id === m.userId;
            return (
              <button
                key={m.userId}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(on ? { kind: "all" } : { kind: "member", id: m.userId })}
                className="h-8 shrink-0 rounded-lg px-2.5 font-mono text-xs transition-[background-color,transform] active:scale-95"
                style={{ color: m.accentColor, backgroundColor: on ? `${m.accentColor}26` : `${m.accentColor}0d`, boxShadow: on ? `inset 0 0 0 1px ${m.accentColor}80` : undefined }}
              >
                @{m.username}
              </button>
            );
          })}
        </div>
        <div className="flex rounded-lg bg-surface p-0.5 shadow-highlight" role="radiogroup" aria-label="Layout">
          {(["board", "list"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={layout === l}
              onClick={() => setLayout(l)}
              className={cx("h-7 rounded-md px-3 text-xs transition-colors", layout === l ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {l === "board" ? "Kanban" : "List"}
            </button>
          ))}
        </div>
      </div>

      <NewTask projectId={projectId} />

      <LayoutGroup>
        {layout === "board" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TASK_COLUMNS.map((col) => {
              const all = visible.filter((t) => t.status === col.status);
              // Done can grow forever; the board shows the latest, Shipped shows all.
              const items = col.status === "DONE"
                ? [...all].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 12)
                : all;
              return (
                <section key={col.status} aria-label={col.label} className="flex min-h-40 flex-col rounded-2xl bg-surface/60 p-2">
                  <header className="flex items-center gap-2 px-2 pb-2 pt-1">
                    <StatusGlyph status={col.status} />
                    <h3 className="text-[13px] font-medium text-ink">{col.label}</h3>
                    <span className="font-mono text-[11px] text-ink-3">{all.length}</span>
                  </header>
                  <ul className="flex flex-col gap-2">
                    <AnimatePresence initial={false} mode="popLayout">
                      {items.map((t) => <TaskCard key={t.id} task={t} scoped={scoped} onEdit={() => setEditing(t.id)} />)}
                    </AnimatePresence>
                  </ul>
                  {!items.length && <p className="px-2 py-4 text-xs text-ink-3">Nothing here.</p>}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {TASK_COLUMNS.map((col) => {
              const items = visible.filter((t) => t.status === col.status);
              if (!items.length) return null;
              return (
                <section key={col.status} aria-label={col.label}>
                  <header className="flex items-center gap-2 px-1 pb-2">
                    <StatusGlyph status={col.status} />
                    <h3 className="text-[13px] font-medium">{col.label}</h3>
                    <span className="font-mono text-[11px] text-ink-3">{items.length}</span>
                  </header>
                  <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-highlight">
                    <AnimatePresence initial={false}>
                      {items.map((t) => <TaskRow key={t.id} task={t} scoped={scoped} onEdit={() => setEditing(t.id)} />)}
                    </AnimatePresence>
                  </ul>
                </section>
              );
            })}
            {!visible.length && <p className="py-10 text-center text-sm text-ink-3">No tasks match this filter.</p>}
          </div>
        )}
      </LayoutGroup>

      <TaskDialog task={allTasks.find((t) => t.id === editing) ?? null} onClose={() => setEditing(null)} />
    </div>
  );
}

function NewTask({ projectId }: { projectId?: string }) {
  const { team, run, addTask, ideas } = useWorkspace();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState("");
  const projects = ideas.filter((i) => i.status === "PROMOTED" && !i.id.startsWith("tmp-"));
  const target = projectId ?? (picked || null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    const now = new Date().toISOString();
    const proj = target ? projects.find((p) => p.id === target) : undefined;
    run(() => createTask({ teamId: team.id, title: t, projectId: target }), {
      optimistic: () =>
        addTask({
          id: `tmp-${now}`,
          title: t,
          notes: null,
          status: "TODO",
          priority: "MEDIUM",
          isFocused: false,
          assigneeId: null,
          idea: proj ? { id: proj.id, title: proj.title } : null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
    });
  };
  return (
    <form onSubmit={submit} className="mt-4 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={140}
        aria-label="New task title"
        placeholder={projectId ? "+ Add a task to this project" : "+ New task straight into the backlog"}
        className={cx(inputCls, "h-10 bg-surface")}
      />
      {!projectId && projects.length > 0 && (
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          aria-label="Project for the new task"
          className={cx(inputCls, "hidden h-10 w-auto max-w-48 shrink-0 bg-surface sm:block")}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      )}
      <button type="submit" disabled={!title.trim()} className={cx(btn.outline, "shrink-0")}>Add</button>
    </form>
  );
}

export function StatusGlyph({ status }: { status: TaskStatus }) {
  const color = { TODO: "#8A8A94", READY: "#06B6D4", IN_PROGRESS: "#F59E0B", DONE: "#10B981" }[status];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={status === "TODO" ? "2 2" : undefined} />
      {status === "IN_PROGRESS" && <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill={color} />}
      {status === "DONE" && <circle cx="7" cy="7" r="5.5" fill={color} />}
      {status === "DONE" && <path d="m4.5 7.2 1.7 1.7 3.4-3.6" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/* ── Shared task controls ───────────────────────────────────────────────── */

function useTaskControls(task: TaskDTO) {
  const { team, viewer, run, patchTask, member } = useWorkspace();
  const [striking, setStriking] = useState(false);
  const temp = task.id.startsWith("tmp-");
  const mine = task.assigneeId === viewer.id;
  const assignee = member(task.assigneeId);

  const setStatus = (status: TaskStatus) =>
    run(() => setTaskStatus({ teamId: team.id, itemId: task.id, status }), {
      optimistic: () =>
        patchTask(task.id, {
          status,
          isFocused: status === "IN_PROGRESS" ? task.isFocused : false,
          completedAt: status === "DONE" ? new Date().toISOString() : null,
        }),
    });

  const markDone = () => {
    setStriking(true);
    window.setTimeout(() => {
      setStriking(false);
      setStatus("DONE");
    }, 520);
  };

  const focus = () =>
    run(() => startFocus({ teamId: team.id, itemId: task.id }), {
      optimistic: () => patchTask(task.id, { status: "IN_PROGRESS", isFocused: true, assigneeId: viewer.id, updatedAt: new Date().toISOString() }),
      success: "You're in focus. Go.",
    });

  const assign = (assigneeId: string | null) =>
    run(() => assignTask({ teamId: team.id, itemId: task.id, assigneeId }), {
      optimistic: () => patchTask(task.id, { assigneeId, isFocused: false }),
    });

  const priority = (p: TaskDTO["priority"]) =>
    run(() => setTaskPriority({ teamId: team.id, itemId: task.id, priority: p }), {
      optimistic: () => patchTask(task.id, { priority: p }),
    });

  return { temp, mine, assignee, striking, setStatus, markDone, focus, assign, priority };
}

function AssigneePicker({ task, onPick, compact }: { task: TaskDTO; onPick: (id: string | null) => void; compact?: boolean }) {
  const { members, member } = useWorkspace();
  const a = member(task.assigneeId);
  return (
    <Popover
      label="Assignee"
      triggerClassName={cx("h-7 gap-1.5 px-1.5 text-xs", compact && "px-1")}
      className="w-56"
      trigger={
        a ? (
          <>
            <Monogram name={a.username} color={a.accentColor} size={20} />
            {!compact && <span className="font-mono text-[11px]" style={{ color: readable(a.accentColor) }}>@{a.username}</span>}
          </>
        ) : (
          <>
            <span className="size-5 rounded-[28%] border border-dashed border-ink-3/60" />
            {!compact && <span className="text-[11px] text-ink-3">Assign</span>}
          </>
        )
      }
    >
      {(close) => (
        <>
          <MenuItem active={!task.assigneeId} onSelect={() => { onPick(null); close(); }}>
            <span className="size-5 rounded-[28%] border border-dashed border-ink-3/60" /> Unassigned
          </MenuItem>
          {members.map((m) => (
            <MenuItem key={m.userId} active={task.assigneeId === m.userId} onSelect={() => { onPick(m.userId); close(); }}>
              <Monogram name={m.username} color={m.accentColor} size={20} />
              <span className="font-mono text-xs" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function MoveMenu({ task, onMove }: { task: TaskDTO; onMove: (s: TaskStatus) => void }) {
  return (
    <Popover
      label="Move task"
      align="end"
      triggerClassName="size-7 justify-center text-ink-3 hover:text-ink"
      trigger={<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>}
    >
      {(close) => (
        <>
          <p className="px-2.5 pb-1 pt-1 text-xs text-ink-3">Move to</p>
          {TASK_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
            <MenuItem key={c.status} onSelect={() => { onMove(c.status); close(); }}>
              <StatusGlyph status={c.status} /> {c.label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function Strike({ on, children, className }: { on: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("relative inline", className)}>
      {children}
      {on && (
        <svg className="pointer-events-none absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 overflow-visible" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden>
          <motion.path d="M0 2.4 Q 30 1 60 2 T 100 1.6" stroke="#10B981" strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }} />
        </svg>
      )}
    </span>
  );
}

/* ── Kanban card ────────────────────────────────────────────────────────── */

function TaskCard({ task, scoped, onEdit }: { task: TaskDTO; scoped: boolean; onEdit: () => void }) {
  const c = useTaskControls(task);
  const done = task.status === "DONE";
  const glow = task.isFocused && c.assignee ? c.assignee.accentColor : null;

  return (
    <motion.li
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: c.temp ? 0.65 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={spring}
      className="group rounded-xl bg-surface p-3 shadow-highlight transition-colors hover:bg-surface-2"
      style={glow ? { boxShadow: `inset 0 0 0 1px ${glow}66, 0 0 24px -12px ${glow}` } : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={c.temp}
          className={cx("min-w-0 flex-1 text-left text-[14px] leading-snug transition-colors hover:text-accent", done ? "text-ink-3" : "text-ink")}
        >
          <Strike on={c.striking || done}>{task.title}</Strike>
          {task.notes && <NotesGlyph />}
        </button>
        {!c.temp && <MoveMenu task={task} onMove={c.setStatus} />}
      </div>
      {task.idea && !scoped && <ProjectChip idea={task.idea} className="mt-1.5" />}
      <div className="mt-3 flex items-center gap-1">
        <AssigneePicker task={task} onPick={c.assign} compact />
        <PriorityPicker value={task.priority} onChange={c.priority} />
        <span className="flex-1" />
        {!done && !c.temp && !(task.isFocused && c.mine) && (
          <button type="button" onClick={c.focus} className={cx(btn.ghost, btn.xs)}>Start working</button>
        )}
        {!done && !c.temp && (
          <button type="button" onClick={c.markDone} disabled={c.striking} className={cx(btn.outline, btn.xs)}>Mark done</button>
        )}
        {done && (
          <button type="button" onClick={() => c.setStatus("READY")} className={cx(btn.ghost, btn.xs)}>Reopen</button>
        )}
      </div>
    </motion.li>
  );
}

/* ── Compact list row ───────────────────────────────────────────────────── */

function TaskRow({ task, scoped, onEdit }: { task: TaskDTO; scoped: boolean; onEdit: () => void }) {
  const c = useTaskControls(task);
  const done = task.status === "DONE";
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: c.temp ? 0.65 : 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-tint/[0.02]"
    >
      <button
        type="button"
        aria-label={done ? "Reopen" : "Mark done"}
        onClick={done ? () => c.setStatus("READY") : c.markDone}
        className="grid size-6 place-items-center rounded-md transition-transform hover:bg-tint/[0.06] active:scale-90"
      >
        <StatusGlyph status={task.status} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={c.temp}
        className={cx("min-w-0 flex-1 truncate text-left text-[14px] transition-colors hover:text-accent", done ? "text-ink-3" : "text-ink")}
      >
        <Strike on={c.striking || done}>{task.title}</Strike>
        {task.notes && <NotesGlyph />}
      </button>
      {task.idea && !scoped && <ProjectChip idea={task.idea} className="hidden max-w-48 lg:flex" />}
      {task.isFocused && c.assignee && (
        <span className="hidden font-mono text-[11px] sm:inline" style={{ color: readable(c.assignee.accentColor) }}>in focus</span>
      )}
      <PriorityPicker value={task.priority} onChange={c.priority} />
      <AssigneePicker task={task} onPick={c.assign} />
      {!done && !c.temp && !(task.isFocused && c.mine) && (
        <button type="button" onClick={c.focus} className={cx(btn.ghost, btn.xs, "hidden sm:inline-flex")}>Start working</button>
      )}
    </motion.li>
  );
}

/* ── Project chip, notes marker, task detail ────────────────────────────── */

function ProjectChip({ idea, className }: { idea: { id: string; title: string }; className?: string }) {
  const { openProject, ideas } = useWorkspace();
  const live = ideas.some((i) => i.id === idea.id && i.status === "PROMOTED");
  const label = (
    <>
      <span className="text-violet" aria-hidden>◆</span>
      <span className="truncate">{idea.title}</span>
    </>
  );
  if (!live) return <p className={cx("flex items-center gap-1 text-[11px] text-ink-3", className)}>{label}</p>;
  return (
    <button
      type="button"
      onClick={() => openProject(idea.id)}
      className={cx("flex max-w-full items-center gap-1 text-left text-[11px] text-ink-3 transition-colors hover:text-ink", className)}
    >
      {label}
    </button>
  );
}

function NotesGlyph() {
  return (
    <svg className="ml-1.5 inline-block align-[-1px] text-ink-3" width="11" height="11" viewBox="0 0 12 12" role="img" aria-label="Has notes">
      <path d="M2.5 3h7M2.5 6h7M2.5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function TaskDialog({ task, onClose }: { task: TaskDTO | null; onClose: () => void }) {
  return (
    <Dialog open={!!task} onClose={onClose} title="Task" description="Rename it, write notes, or move it to another project.">
      {task && <TaskForm key={task.id} task={task} onClose={onClose} />}
    </Dialog>
  );
}

function TaskForm({ task, onClose }: { task: TaskDTO; onClose: () => void }) {
  const { team, ideas, run, patchTask, member } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [projectId, setProjectId] = useState(task.idea?.id ?? "");
  const projects = ideas.filter((i) => i.status === "PROMOTED" && !i.id.startsWith("tmp-"));
  const assignee = member(task.assigneeId);
  const column = TASK_COLUMNS.find((c) => c.status === task.status)?.label;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const n = notes.trim();
    const patch: { title?: string; notes?: string; projectId?: string | null } = {};
    if (t !== task.title) patch.title = t;
    if (n !== (task.notes ?? "")) patch.notes = n;
    if ((projectId || null) !== (task.idea?.id ?? null)) patch.projectId = projectId || null;
    onClose();
    if (!Object.keys(patch).length) return;
    const proj = projects.find((p) => p.id === projectId);
    run(() => updateTask({ teamId: team.id, itemId: task.id, ...patch }), {
      optimistic: () =>
        patchTask(task.id, { title: t, notes: n || null, idea: proj ? { id: proj.id, title: proj.title } : null }),
      success: "Task saved.",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><StatusGlyph status={task.status} /> {column}</span>
        {assignee ? (
          <span className="font-mono" style={{ color: readable(assignee.accentColor) }}>@{assignee.username}</span>
        ) : (
          <span>Unassigned</span>
        )}
      </p>
      <Field label="Title" htmlFor="task-title">
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={cx(inputCls, "h-10")} />
      </Field>
      <Field label="Notes" htmlFor="task-notes" hint="Links, acceptance criteria, anything the next person needs.">
        <textarea
          id="task-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={6}
          placeholder="What does done look like?"
          className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
        />
      </Field>
      <Field label="Project" htmlFor="task-project">
        <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(inputCls, "h-10")}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>Cancel</button>
        <button type="submit" disabled={!title.trim()} className={cx(btn.primary, btn.sm)}>Save task</button>
      </div>
    </form>
  );
}
