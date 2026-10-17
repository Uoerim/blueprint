"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { animate, AnimatePresence, LayoutGroup, motion, useMotionValue, type Variants } from "framer-motion";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createSubtask,
  createTask,
  deleteSubtask,
  deleteTask,
  setSubtaskAssignees,
  setTaskAssignees,
  setTaskPriority,
  setTaskStatus,
  startFocus,
  toggleSubtask,
  updateSubtask,
  updateTask,
} from "@/app/actions/tasks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { MenuItem, Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, PRIORITY_COLORS, readable } from "@/components/ui/primitives";
import { LIMITS, PRIORITY_LABEL, TASK_COLUMNS } from "@/lib/constants";
import { newId } from "@/lib/live";
import {
  canDeleteTask,
  canEditTask,
  canMoveTask,
  canToggleSubtask,
  type TaskAccessFacts,
} from "@/lib/team-permissions";
import type { MemberDTO, SubtaskDTO, TaskDTO, TaskStatus, Visibility } from "@/lib/types";
import { PriorityPicker, TagPicker, TagPill } from "./vault-view";
import { useWorkspace } from "./workspace";

const spring = { type: "spring", stiffness: 520, damping: 40 } as const;
type Filter = { kind: "all" } | { kind: "mine" } | { kind: "unassigned" } | { kind: "member"; id: string };
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Which task is open, and whether it's being looked at or edited. */
type Open = { id: string; mode: "view" | "edit" };

/** The task board. With projectId it shows only that project's tasks and adds new ones to it. */
export function BoardView({ projectId, initialFilter = "all" }: { projectId?: string; initialFilter?: "all" | "mine" } = {}) {
  const { tasks: allTasks, members, viewer, can, team, run, removeTask } = useWorkspace();
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [filter, setFilter] = useState<Filter>({ kind: initialFilter });
  const [open, setOpen] = useState<Open | null>(null);
  const [deleting, setDeleting] = useState<TaskDTO | null>(null);
  const scoped = !!projectId;
  const tasks = projectId ? allTasks.filter((t) => t.idea?.id === projectId) : allTasks;

  const visible = tasks
    .filter((t) => {
      if (filter.kind === "mine") return t.assigneeIds.includes(viewer.id) || t.subtasks.some((s) => s.assigneeIds.includes(viewer.id));
      if (filter.kind === "unassigned") return !t.assigneeIds.length;
      if (filter.kind === "member") return t.assigneeIds.includes(filter.id);
      return true;
    })
    .sort((a, b) => Number(b.focus.length > 0) - Number(a.focus.length > 0) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const view = (id: string) => setOpen({ id, mode: "view" });
  const edit = (id: string) => setOpen({ id, mode: "edit" });
  const askDelete = (t: TaskDTO) => {
    setOpen(null);
    setDeleting(t);
  };
  const actions = { onView: view, onEdit: edit, onDelete: askDelete };

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
                style={{ color: readable(m.accentColor), backgroundColor: on ? `${m.accentColor}26` : `${m.accentColor}0d`, boxShadow: on ? `inset 0 0 0 1px ${m.accentColor}80` : undefined }}
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

      {/* A new task opens in the editor straight away, for its details and subtasks. */}
      {can("tasks.create") && <NewTask projectId={projectId} onCreated={edit} />}

      <LayoutGroup>
        {layout === "board" ? (
          <Board tasks={visible} scoped={scoped} {...actions} />
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
                      {items.map((t) => <TaskRow key={t.id} task={t} scoped={scoped} {...actions} />)}
                    </AnimatePresence>
                  </ul>
                </section>
              );
            })}
            {!visible.length && <p className="py-10 text-center text-sm text-ink-3">No tasks match this filter.</p>}
          </div>
        )}
      </LayoutGroup>

      <TaskDialog
        task={open ? (allTasks.find((t) => t.id === open.id) ?? null) : null}
        mode={open?.mode ?? "view"}
        onMode={(mode) => setOpen((o) => (o ? { ...o, mode } : o))}
        onClose={() => setOpen(null)}
        onDelete={askDelete}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete task?"
        description={<>&ldquo;{deleting?.title}&rdquo;, its notes and its subtasks will be deleted for everyone on the team.</>}
        confirmLabel="Delete task"
        level={{ kind: "ack" }}
        onConfirm={() => {
          const t = deleting;
          if (!t) return;
          run(() => deleteTask({ teamId: team.id, itemId: t.id }), {
            optimistic: () => removeTask(t.id),
            success: "Task deleted.",
          });
        }}
      />
    </div>
  );
}

type CardActions = { onView: (id: string) => void; onEdit: (id: string) => void; onDelete: (t: TaskDTO) => void };

/** Where a dropped card was let go, so it can settle from there into its new place. */
type Landing = { left: number; top: number } | null;

// A pointer that's over a column wins; otherwise the column the card overlaps most.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/**
 * Kanban with drag and drop: press and drag a card (long-press on touch) onto
 * another column to move it. People who can't move a task simply can't pick
 * it up; the server checks the move either way. The "Move to" menu does the
 * same from the keyboard.
 */
function Board({ tasks, scoped, ...actions }: { tasks: TaskDTO[]; scoped: boolean } & CardActions) {
  const setStatus = useSetStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  const { viewer } = useWorkspace();
  // The move is shown in the same frame as the drop (the saved state arrives a
  // moment later), so the card never flashes back to the column it came from.
  // It applies until the workspace's task list changes, which is the move itself landing.
  const [dropped, setDropped] = useState<{ id: string; status: TaskStatus; base: TaskDTO[]; landing: Landing } | null>(null);
  const shown = dropped && dropped.base === tasks ? tasks.map((t) => (t.id === dropped.id ? { ...t, ...statusPatch(t, dropped.status, viewer.id) } : t)) : tasks;
  const active = activeId ? shown.find((t) => t.id === activeId) : undefined;

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const task = shown.find((t) => t.id === e.active.id);
    const to = e.over?.id as TaskStatus | undefined;
    if (!task || !to || to === task.status) return;
    const at = e.active.rect.current.translated;
    setDropped({ id: task.id, status: to, base: tasks, landing: at && { left: at.left, top: at.top } });
    setTimeout(() => setDropped((d) => (d?.id === task.id ? null : d)), 1000);
    setStatus(task, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements: {
          onDragStart: () => "Picked up a task.",
          onDragOver: ({ over }) => (over ? `Over ${TASK_COLUMNS.find((c) => c.status === over.id)?.label ?? "a column"}.` : "Not over a column."),
          onDragEnd: ({ over }) => (over ? `Moved to ${TASK_COLUMNS.find((c) => c.status === over.id)?.label ?? "a column"}.` : "Put back."),
          onDragCancel: () => "Move cancelled.",
        },
      }}
    >
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((col) => {
          const all = shown.filter((t) => t.status === col.status);
          // Done can grow forever; the board shows the latest, Shipped shows all.
          const items = col.status === "DONE" ? [...all].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 12) : all;
          return (
            <BoardColumn key={col.status} status={col.status} label={col.label} count={all.length} dragging={!!active}>
              <AnimatePresence initial={false} mode="popLayout" custom={dropped?.id ?? null}>
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} scoped={scoped} landing={dropped?.id === t.id && dropped.status === t.status ? dropped.landing : undefined} {...actions} />
                ))}
              </AnimatePresence>
              {!items.length && <p className="px-2 py-4 text-xs text-ink-3">{active ? "Drop it here." : "Nothing here."}</p>}
            </BoardColumn>
          );
        })}
      </div>
      {/* The card you're holding: a tilted, lifted copy that follows the pointer. */}
      <DragOverlay dropAnimation={null}>{active ? <CardGhost task={active} /> : null}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn({ status, label, count, dragging, children }: { status: TaskStatus; label: string; count: number; dragging: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cx(
        "flex min-h-40 flex-col rounded-2xl p-2 transition-[background-color,box-shadow] duration-200",
        isOver ? "bg-accent/10 shadow-[inset_0_0_0_1.5px_var(--accent)]" : dragging ? "bg-surface/80 shadow-[inset_0_0_0_1px_var(--line-strong)]" : "bg-surface/60",
      )}
    >
      <header className="flex items-center gap-2 px-2 pb-2 pt-1">
        <StatusGlyph status={status} />
        <h3 className="text-[13px] font-medium text-ink">{label}</h3>
        <span className="font-mono text-[11px] text-ink-3">{count}</span>
      </header>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function CardGhost({ task }: { task: TaskDTO }) {
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 1.04, rotate: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="cursor-grabbing rounded-xl bg-surface-2 p-3 shadow-[0_24px_50px_-18px_rgba(0,0,0,0.8),inset_0_0_0_1px_var(--accent)]"
    >
      <p className="text-[14px] leading-snug text-ink">{task.title}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <AvatarStack ids={task.assigneeIds} />
        <PriorityBadge value={task.priority} />
      </div>
    </motion.div>
  );
}

/* ── Quick add (people who can create tasks) ────────────────────────────── */

function NewTask({ projectId, onCreated }: { projectId?: string; onCreated: (id: string) => void }) {
  const { team, run, addTask, ideas, viewer, isPending } = useWorkspace();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("TEAM");
  const projects = ideas.filter((i) => i.status !== "ARCHIVED" && !isPending(i.id));
  const target = projectId ?? (picked || null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    const ids = assignees;
    const now = new Date().toISOString();
    const proj = target ? projects.find((p) => p.id === target) : undefined;
    const taskId = newId();
    run(() => createTask({ id: taskId, teamId: team.id, title: t, projectId: target, assigneeIds: ids, visibility }), {
      pendingId: taskId,
      optimistic: () =>
        addTask({
          id: taskId,
          title: t,
          description: null,
          notes: null,
          status: "TODO",
          priority: "MEDIUM",
          visibility,
          tags: [],
          createdById: viewer.id,
          assigneeIds: ids,
          focus: [],
          subtasks: [],
          idea: proj ? { id: proj.id, title: proj.title } : null,
          completedAt: null,
          completedById: null,
          createdAt: now,
          updatedAt: now,
        }),
      success: visibility === "ASSIGNEES" ? "Private task added." : undefined,
      onOk: () => onCreated(taskId),
    });
  };

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        aria-label="New task title"
        placeholder={projectId ? "+ Add a task to this project" : "+ New task straight into the backlog"}
        className={cx(inputCls, "h-10 min-w-0 flex-1 basis-full bg-surface sm:basis-auto")}
      />
      <AssigneesPicker value={assignees} onChange={setAssignees} label="Assign people to the new task" />
      <VisibilityToggle value={visibility} onChange={setVisibility} />
      {!projectId && projects.length > 0 && (
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          aria-label="Project for the new task"
          className={cx(inputCls, "hidden h-10 w-auto max-w-48 shrink-0 bg-surface md:block")}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.status === "VAULT" ? `Idea: ${p.title}` : p.title}</option>
          ))}
        </select>
      )}
      <button type="submit" disabled={!title.trim()} className={cx(btn.outline, "shrink-0")}>Add</button>
    </form>
  );
}

function VisibilityToggle({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const priv = value === "ASSIGNEES";
  return (
    <button
      type="button"
      onClick={() => onChange(priv ? "TEAM" : "ASSIGNEES")}
      aria-pressed={priv}
      title={priv ? "Only assignees (and owners) can see it" : "Everyone on the team can see it"}
      className={cx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] shadow-highlight transition-colors",
        priv ? "bg-amber/12 text-amber" : "bg-surface text-ink-2 hover:text-ink",
      )}
    >
      {priv ? <LockGlyph /> : <EyeGlyph />}
      {priv ? "Assignees only" : "Everyone"}
    </button>
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

/** What the viewer may do with a task. Mirrors the server rules exactly; the server still enforces them. */
export function useTaskAccess(task: TaskDTO) {
  const { viewer, perms, isPending } = useWorkspace();
  const facts: TaskAccessFacts = {
    me: viewer.id,
    perms,
    createdById: task.createdById,
    assigneeIds: task.assigneeIds,
    visibility: task.visibility,
    subtaskAssigneeIds: task.subtasks.flatMap((s) => s.assigneeIds),
  };
  const temp = isPending(task.id);
  const edit = !temp && canEditTask(facts);
  return {
    facts,
    temp,
    edit,
    move: !temp && canMoveTask(facts),
    remove: !temp && canDeleteTask(facts),
    assigned: task.assigneeIds.includes(viewer.id),
    focusable: !temp && (task.assigneeIds.includes(viewer.id) || edit),
  };
}

/** What moving a task to a column changes, as the server will save it. */
function statusPatch(task: TaskDTO, status: TaskStatus, viewerId: string): Partial<TaskDTO> {
  return {
    status,
    focus: status === "IN_PROGRESS" ? task.focus : [],
    completedAt: status === "DONE" ? (task.status === "DONE" ? task.completedAt : new Date().toISOString()) : null,
    completedById: status === "DONE" ? (task.status === "DONE" ? task.completedById : viewerId) : null,
  };
}

/** Moves any task to a column, optimistically. Used by the cards and by drag and drop. */
function useSetStatus() {
  const { team, viewer, run, patchTask } = useWorkspace();
  return (task: TaskDTO, status: TaskStatus) =>
    run(() => setTaskStatus({ teamId: team.id, itemId: task.id, status }), {
      optimistic: () => patchTask(task.id, statusPatch(task, status, viewer.id)),
    });
}

function useTaskControls(task: TaskDTO) {
  const { team, viewer, run, patchTask, tasks } = useWorkspace();
  const access = useTaskAccess(task);
  const change = useSetStatus();
  const [striking, setStriking] = useState(false);
  const inFocus = task.focus.some((f) => f.userId === viewer.id);
  const setStatus = (status: TaskStatus) => change(task, status);

  const markDone = () => {
    setStriking(true);
    window.setTimeout(() => {
      setStriking(false);
      setStatus("DONE");
    }, 520);
  };

  const focus = () =>
    run(() => startFocus({ teamId: team.id, itemId: task.id }), {
      optimistic: () => {
        // One focus per person: clear mine elsewhere, then join this task.
        for (const t of tasks) {
          if (t.id !== task.id && t.focus.some((f) => f.userId === viewer.id)) {
            patchTask(t.id, { focus: t.focus.filter((f) => f.userId !== viewer.id) });
          }
        }
        patchTask(task.id, {
          status: "IN_PROGRESS",
          assigneeIds: task.assigneeIds.includes(viewer.id) ? task.assigneeIds : [...task.assigneeIds, viewer.id],
          focus: [...task.focus.filter((f) => f.userId !== viewer.id), { userId: viewer.id, since: new Date().toISOString() }],
        });
      },
      success: "You're in focus. Go.",
    });

  const assign = (ids: string[]) =>
    run(() => setTaskAssignees({ teamId: team.id, itemId: task.id, userIds: ids }), {
      optimistic: () => patchTask(task.id, { assigneeIds: ids, focus: task.focus.filter((f) => ids.includes(f.userId)) }),
    });

  const priority = (p: TaskDTO["priority"]) =>
    run(() => setTaskPriority({ teamId: team.id, itemId: task.id, priority: p }), {
      optimistic: () => patchTask(task.id, { priority: p }),
    });

  return { ...access, inFocus, striking, setStatus, markDone, focus, assign, priority };
}

/* ── People ─────────────────────────────────────────────────────────────── */

export function AvatarStack({ ids, size = 20, max = 3 }: { ids: string[]; size?: number; max?: number }) {
  const { member } = useWorkspace();
  const people = ids.map((id) => member(id)).filter((m): m is MemberDTO => !!m);
  if (!people.length) return <span className="text-[11px] text-ink-3">Unassigned</span>;
  return (
    <span className="flex items-center -space-x-1" title={people.map((p) => `@${p.username}`).join(", ")}>
      {people.slice(0, max).map((p) => (
        <Monogram key={p.userId} name={p.username} color={p.accentColor} src={p.imageUrl} size={size} className="ring-2 ring-surface" />
      ))}
      {people.length > max && (
        <span className="grid place-items-center rounded-[28%] bg-surface-3 text-[10px] text-ink-2 ring-2 ring-surface" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

/** Multi-select of team members. Each click toggles one person. */
export function AssigneesPicker({
  value,
  onChange,
  label = "Assignees",
  compact,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  compact?: boolean;
}) {
  const { members } = useWorkspace();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Popover
      label={label}
      triggerClassName={cx("gap-1.5 text-xs", compact ? "h-7 px-1" : "h-10 rounded-lg bg-surface px-2.5 shadow-highlight")}
      className="w-60"
      trigger={
        value.length ? (
          <AvatarStack ids={value} size={compact ? 20 : 22} />
        ) : (
          <>
            <span className="size-5 rounded-[28%] border border-dashed border-ink-3/60" />
            {!compact && <span className="text-[12px] text-ink-3">Assign</span>}
          </>
        )
      }
    >
      {() => (
        <>
          <p className="px-2.5 pb-1 pt-1 text-xs text-ink-3">Assign people</p>
          {members.map((m) => {
            const on = value.includes(m.userId);
            return (
              <MenuItem key={m.userId} active={on} onSelect={() => toggle(m.userId)}>
                <span
                  className={cx("grid size-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-white" : "border-line-strong")}
                  aria-hidden
                >
                  {on && <svg width="10" height="10" viewBox="0 0 10 10"><path d="m2 5.2 2 2 4-4.4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <Monogram name={m.username} color={m.accentColor} src={m.imageUrl} size={20} />
                <span className="font-mono text-xs" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
              </MenuItem>
            );
          })}
          {value.length > 0 && (
            <MenuItem onSelect={() => onChange([])}>
              <span className="text-ink-3">Clear everyone</span>
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  );
}

/** The ⋯ menu on a task: edit it, move it, or delete it (each only when allowed). */
function TaskMenu({
  task,
  can,
  onEdit,
  onMove,
  onDelete,
}: {
  task: TaskDTO;
  can: { edit: boolean; move: boolean; remove: boolean };
  onEdit: () => void;
  onMove: (s: TaskStatus) => void;
  onDelete: () => void;
}) {
  if (!can.edit && !can.move && !can.remove) return null;
  return (
    <Popover
      label="Task actions"
      align="end"
      triggerClassName="size-7 justify-center text-ink-3 hover:text-ink"
      trigger={<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>}
    >
      {(close) => (
        <>
          {can.edit && (
            <MenuItem onSelect={() => { close(); onEdit(); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              Edit task
            </MenuItem>
          )}
          {can.move && (
            <>
              <p className="px-2.5 pb-1 pt-2 text-xs text-ink-3">Move to</p>
              {TASK_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                <MenuItem key={c.status} onSelect={() => { onMove(c.status); close(); }}>
                  <StatusGlyph status={c.status} /> {c.label}
                </MenuItem>
              ))}
            </>
          )}
          {can.remove && (
            <MenuItem onSelect={() => { close(); onDelete(); }}>
              <span className="text-rose">Delete task</span>
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  );
}

function PriorityBadge({ value }: { value: TaskDTO["priority"] }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 px-1.5 text-[11px] text-ink-3" title={`${PRIORITY_LABEL[value]} priority`}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[value] }} aria-hidden />
      {PRIORITY_LABEL[value]}
    </span>
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

/** Small markers after a title: private, has details, subtask progress. */
function TaskMeta({ task }: { task: TaskDTO }) {
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <span className="ml-1.5 inline-flex items-center gap-1.5 align-[-1px] text-ink-3">
      {task.visibility === "ASSIGNEES" && <LockGlyph title="Visible to assignees only" />}
      {(task.description || task.notes) && <NotesGlyph />}
      {task.subtasks.length > 0 && (
        <span className={cx("inline-flex items-center gap-0.5 font-mono text-[10.5px]", done === task.subtasks.length && "text-emerald")}>
          <CheckGlyph /> {done}/{task.subtasks.length}
        </span>
      )}
    </span>
  );
}

/* ── Kanban card ────────────────────────────────────────────────────────── */

/**
 * A card on the board. Tapping it opens a read-only view of the task; editing
 * lives in the ⋯ menu. Cards you can move can be dragged to another column.
 */
function TaskCard({ task, scoped, landing, onView, onEdit, onDelete }: { task: TaskDTO; scoped: boolean; landing?: Landing } & CardActions) {
  const { member } = useWorkspace();
  const c = useTaskControls(task);
  const done = task.status === "DONE";
  const glowMember = member(task.focus[0]?.userId);
  const glow = glowMember?.accentColor ?? null;
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, disabled: !c.move });
  // The card left behind by a drag vanishes at once (it's already settling into
  // its new column); a card leaving for any other reason fades out.
  const variants = useMemo<Variants>(
    () => ({
      exit: (droppedId: string | null) =>
        droppedId === task.id ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
    }),
    [task.id],
  );

  // A card that was just dropped starts where it was let go, still tilted like
  // the copy you were holding, and settles into its place in the column.
  const el = useRef<HTMLLIElement | null>(null);
  const [landed] = useState(landing ?? null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  useLayoutEffect(() => {
    if (!landed || !el.current) return;
    const box = el.current.getBoundingClientRect();
    x.set(landed.left - box.left);
    y.set(landed.top - box.top);
    rotate.set(-2);
    const settle = { type: "spring", stiffness: 520, damping: 38 } as const;
    const runs = [animate(x, 0, settle), animate(y, 0, settle), animate(rotate, 0, settle)];
    return () => runs.forEach((r) => r.stop());
  }, [landed, x, y, rotate]);

  return (
    <motion.li
      ref={(node) => {
        el.current = node;
        setNodeRef(node);
      }}
      {...listeners}
      layout
      // A dropped card settles on its own; sharing the id would slide it from the old column.
      layoutId={landing ? undefined : task.id}
      variants={variants}
      initial={landed ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: isDragging ? 0.35 : c.temp ? 0.65 : 1, scale: 1 }}
      exit="exit"
      transition={spring}
      className={cx(
        "group relative touch-manipulation select-none rounded-xl bg-surface p-3 shadow-highlight transition-colors hover:bg-surface-2",
        c.move && "cursor-grab active:cursor-grabbing",
      )}
      style={{ x, y, rotate, zIndex: landed ? 20 : undefined, ...(glow && { boxShadow: `inset 0 0 0 1px ${glow}66, 0 0 24px -12px ${glow}` }) }}
    >
      <div className="flex items-start gap-2">
        {/* Opens the task; its hit area covers the whole card (controls sit above it). */}
        <button
          type="button"
          onClick={() => onView(task.id)}
          disabled={c.temp}
          className={cx("min-w-0 flex-1 text-left text-[14px] leading-snug transition-colors after:absolute after:inset-0 after:rounded-xl group-hover:text-accent", done ? "text-ink-3" : "text-ink")}
        >
          <Strike on={c.striking || done}>{task.title}</Strike>
          <TaskMeta task={task} />
        </button>
        <span className="relative z-10">
          <TaskMenu task={task} can={{ edit: c.edit, move: c.move, remove: c.remove }} onEdit={() => onEdit(task.id)} onMove={c.setStatus} onDelete={() => onDelete(task)} />
        </span>
      </div>
      {(task.tags.length > 0 || (task.idea && !scoped)) && (
        <div className="relative z-10 mt-1.5 flex flex-wrap items-center gap-1.5">
          {task.idea && !scoped && <ProjectChip idea={task.idea} className="max-w-full" />}
          {task.tags.map((t) => (
            <TagPill key={t} name={t} />
          ))}
        </div>
      )}
      <div className="relative z-10 mt-3 flex items-center gap-1">
        {c.edit ? <AssigneesPicker value={task.assigneeIds} onChange={c.assign} compact /> : <span className="px-1"><AvatarStack ids={task.assigneeIds} /></span>}
        {c.edit ? <PriorityPicker value={task.priority} onChange={c.priority} /> : <PriorityBadge value={task.priority} />}
        <span className="flex-1" />
        {!done && c.focusable && !c.inFocus && (
          <button type="button" onClick={c.focus} className={cx(btn.ghost, btn.xs)}>Start working</button>
        )}
        {!done && c.move && (
          <button type="button" onClick={c.markDone} disabled={c.striking} className={cx(btn.outline, btn.xs)}>Mark done</button>
        )}
        {done && c.move && (
          <button type="button" onClick={() => c.setStatus("READY")} className={cx(btn.ghost, btn.xs)}>Reopen</button>
        )}
      </div>
    </motion.li>
  );
}

/* ── Compact list row ───────────────────────────────────────────────────── */

function TaskRow({ task, scoped, onView, onEdit, onDelete }: { task: TaskDTO; scoped: boolean } & CardActions) {
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
      {c.move ? (
        <button
          type="button"
          aria-label={done ? "Reopen" : "Mark done"}
          onClick={done ? () => c.setStatus("READY") : c.markDone}
          className="grid size-6 place-items-center rounded-md transition-transform hover:bg-tint/[0.06] active:scale-90"
        >
          <StatusGlyph status={task.status} />
        </button>
      ) : (
        <span className="grid size-6 place-items-center"><StatusGlyph status={task.status} /></span>
      )}
      <button
        type="button"
        onClick={() => onView(task.id)}
        disabled={c.temp}
        className={cx("min-w-0 flex-1 truncate text-left text-[14px] transition-colors hover:text-accent", done ? "text-ink-3" : "text-ink")}
      >
        <Strike on={c.striking || done}>{task.title}</Strike>
        <TaskMeta task={task} />
      </button>
      {task.idea && !scoped && <ProjectChip idea={task.idea} className="hidden max-w-48 lg:flex" />}
      {task.focus.length > 0 && <span className="hidden font-mono text-[11px] text-amber sm:inline">in focus</span>}
      {c.edit ? <PriorityPicker value={task.priority} onChange={c.priority} /> : <PriorityBadge value={task.priority} />}
      {c.edit ? <AssigneesPicker value={task.assigneeIds} onChange={c.assign} compact /> : <AvatarStack ids={task.assigneeIds} />}
      {!done && c.focusable && !c.inFocus && (
        <button type="button" onClick={c.focus} className={cx(btn.ghost, btn.xs, "hidden sm:inline-flex")}>Start working</button>
      )}
      <TaskMenu task={task} can={{ edit: c.edit, move: c.move, remove: c.remove }} onEdit={() => onEdit(task.id)} onMove={c.setStatus} onDelete={() => onDelete(task)} />
    </motion.li>
  );
}

/* ── Project chip and glyphs ────────────────────────────────────────────── */

function ProjectChip({ idea, className }: { idea: { id: string; title: string }; className?: string }) {
  const { openProject, openIdea, ideas } = useWorkspace();
  const status = ideas.find((i) => i.id === idea.id)?.status;
  const label = (
    <>
      {status === "VAULT" ? <span className="text-amber" aria-hidden>✦</span> : <span className="text-violet" aria-hidden>◆</span>}
      <span className="truncate">{idea.title}</span>
    </>
  );
  if (status !== "PROMOTED" && status !== "VAULT") return <p className={cx("flex items-center gap-1 text-[11px] text-ink-3", className)}>{label}</p>;
  return (
    <button
      type="button"
      title={status === "VAULT" ? "Raw idea" : "Project"}
      onClick={() => (status === "VAULT" ? openIdea(idea.id) : openProject(idea.id))}
      className={cx("flex max-w-full items-center gap-1 text-left text-[11px] text-ink-3 transition-colors hover:text-ink", className)}
    >
      {label}
    </button>
  );
}

function NotesGlyph() {
  return (
    <svg className="inline-block" width="11" height="11" viewBox="0 0 12 12" role="img" aria-label="Has details">
      <path d="M2.5 3h7M2.5 6h7M2.5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LockGlyph({ title }: { title?: string }) {
  return (
    <svg className="inline-block text-amber" width="11" height="11" viewBox="0 0 12 12" role="img" aria-label={title ?? "Private"}>
      {title && <title>{title}</title>}
      <rect x="2.5" y="5.25" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M4 5.25V4a2 2 0 1 1 4 0v1.25" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
      <path d="M1.5 7S3.5 3 7 3s5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="m3.8 6.2 1.5 1.5 3-3.2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Task dialog: view, or edit ─────────────────────────────────────────── */

/**
 * One task. "view" shows everything read-only (subtasks can still be ticked
 * by the people allowed to); "edit" holds the form. The two slide into each
 * other inside the same dialog.
 */
export function TaskDialog({
  task,
  mode,
  onMode,
  onClose,
  onDelete,
}: {
  task: TaskDTO | null;
  mode: "view" | "edit";
  onMode: (m: "view" | "edit") => void;
  onClose: () => void;
  onDelete: (t: TaskDTO) => void;
}) {
  const access = useTaskAccessOrNull(task);
  const editing = mode === "edit" && !!access?.edit;
  return (
    <Dialog
      open={!!task}
      onClose={onClose}
      title={editing ? "Edit task" : "Task"}
      size="lg"
      description={task?.visibility === "ASSIGNEES" ? "Private: only assignees, its creator and team owners can see it." : undefined}
    >
      {task && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={editing ? "edit" : "view"}
            initial={{ opacity: 0, x: editing ? 18 : -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: editing ? -18 : 18 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {editing ? (
              <div className="space-y-5">
                <TaskEditForm key={task.id} task={task} onDone={() => onMode("view")} onDelete={access?.remove ? () => onDelete(task) : undefined} />
                <Subtasks task={task} facts={access!.facts} canEdit />
              </div>
            ) : (
              <TaskView task={task} onEdit={() => onMode("edit")} onDelete={() => onDelete(task)} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </Dialog>
  );
}

/** useTaskAccess for a task that may not be there (hooks can't be called conditionally). */
function useTaskAccessOrNull(task: TaskDTO | null) {
  const { viewer, perms, isPending } = useWorkspace();
  if (!task) return null;
  const facts: TaskAccessFacts = {
    me: viewer.id,
    perms,
    createdById: task.createdById,
    assigneeIds: task.assigneeIds,
    visibility: task.visibility,
    subtaskAssigneeIds: task.subtasks.flatMap((s) => s.assigneeIds),
  };
  const temp = isPending(task.id);
  return { facts, edit: !temp && canEditTask(facts), remove: !temp && canDeleteTask(facts) };
}

/** Everything about a task, read-only. Editing is one tap away for people who may edit. */
function TaskView({ task, onEdit, onDelete }: { task: TaskDTO; onEdit: () => void; onDelete: () => void }) {
  const access = useTaskAccess(task);
  const c = useTaskControls(task);
  const column = TASK_COLUMNS.find((col) => col.status === task.status)?.label;
  const done = task.status === "DONE";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><StatusGlyph status={task.status} /> {column}</span>
        <span className="flex-1" />
        {!done && c.focusable && !c.inFocus && (
          <button type="button" onClick={c.focus} className={cx(btn.ghost, btn.xs)}>Start working</button>
        )}
        {!done && access.move && (
          <button type="button" onClick={c.markDone} disabled={c.striking} className={cx(btn.outline, btn.xs)}>Mark done</button>
        )}
        {done && access.move && (
          <button type="button" onClick={() => c.setStatus("READY")} className={cx(btn.ghost, btn.xs)}>Reopen</button>
        )}
        {access.edit && (
          <button type="button" onClick={onEdit} className={cx(btn.primary, btn.xs)}>
            Edit
          </button>
        )}
      </div>

      <h3 className="text-xl font-semibold leading-snug tracking-tight">
        <Strike on={c.striking || done}>{task.title}</Strike>
      </h3>

      <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
        <Fact label="Project">{task.idea ? <ProjectChip idea={task.idea} className="text-[13px]" /> : <span className="text-ink-3">None</span>}</Fact>
        <Fact label="Priority"><PriorityBadge value={task.priority} /></Fact>
        <Fact label="Assignees"><AvatarStack ids={task.assigneeIds} size={22} max={6} /></Fact>
        <Fact label="Visible to">{task.visibility === "ASSIGNEES" ? <span className="inline-flex items-center gap-1 text-amber"><LockGlyph /> Assignees</span> : <span className="text-ink-2">Whole team</span>}</Fact>
      </dl>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((t) => (
            <TagPill key={t} name={t} />
          ))}
        </div>
      )}

      <Section label="Description">{task.description}</Section>
      <Section label="Notes">{task.notes}</Section>

      <Subtasks task={task} facts={access.facts} canEdit={false} />

      {!access.edit && <p className="text-[12px] text-ink-3">You can work on and finish tasks assigned to you. Ask a team owner to change the details.</p>}
      {access.remove && (
        <button type="button" onClick={onDelete} className={cx(btn.ghost, btn.sm, "-ml-3 text-rose hover:text-rose")}>Delete task</button>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-1 flex min-h-7 items-center">{children}</dd>
    </div>
  );
}

function Section({ label, children }: { label: string; children: string | null }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink-3">{label}</p>
      <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{children || <span className="text-ink-3">None</span>}</p>
    </div>
  );
}

function TaskEditForm({ task, onDone, onDelete }: { task: TaskDTO; onDone: () => void; onDelete?: () => void }) {
  const { team, ideas, run, patchTask, isPending } = useWorkspace();
  const c = useTaskControls(task);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [projectId, setProjectId] = useState(task.idea?.id ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [visibility, setVisibility] = useState<Visibility>(task.visibility);
  const [tags, setTags] = useState<string[]>(task.tags);
  const projects = ideas.filter((i) => i.status !== "ARCHIVED" && !isPending(i.id));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const d = description.trim();
    const n = notes.trim();
    const patch: Parameters<typeof updateTask>[0] & Record<string, unknown> = {};
    if (t !== task.title) patch.title = t;
    if (d !== (task.description ?? "")) patch.description = d;
    if (n !== (task.notes ?? "")) patch.notes = n;
    if ((projectId || null) !== (task.idea?.id ?? null)) patch.projectId = projectId || null;
    if (priority !== task.priority) patch.priority = priority;
    if (visibility !== task.visibility) patch.visibility = visibility;
    if (tags.join(",") !== task.tags.join(",")) patch.tags = tags;
    onDone();
    if (!Object.keys(patch).length) return;
    const proj = projects.find((p) => p.id === projectId);
    run(() => updateTask({ teamId: team.id, itemId: task.id, ...patch }), {
      optimistic: () =>
        patchTask(task.id, {
          title: t,
          description: d || null,
          notes: n || null,
          priority,
          visibility,
          tags,
          idea: proj ? { id: proj.id, title: proj.title } : null,
        }),
      success: "Task saved.",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" htmlFor="task-title">
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} required className={cx(inputCls, "h-10")} />
      </Field>
      <Field label="Description" htmlFor="task-desc" hint="What needs doing and what done looks like.">
        <textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.description}
          rows={3}
          className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
        />
      </Field>
      <Field label="Notes" htmlFor="task-notes" hint="Links, decisions, anything the next person needs.">
        <textarea
          id="task-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={LIMITS.notes}
          rows={3}
          className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label="Assignees" htmlFor="task-assignees" hint="Changes apply straight away.">
          <div id="task-assignees">
            <AssigneesPicker value={task.assigneeIds} onChange={c.assign} />
          </div>
        </Field>
        <Field label="Who can see it" htmlFor="task-visibility">
          <div id="task-visibility">
            <VisibilityToggle value={visibility} onChange={setVisibility} />
          </div>
        </Field>
        <Field label="Project" htmlFor="task-project">
          <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(inputCls, "h-10")}>
            <option value="">No project or idea</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.status === "VAULT" ? `Idea: ${p.title}` : p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskDTO["priority"])} className={cx(inputCls, "h-10")}>
            {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Tags" htmlFor="task-tags">
        <div id="task-tags">
          <TagPicker value={tags} onChange={setTags} />
        </div>
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        {onDelete && (
          <button type="button" onClick={onDelete} className={cx(btn.ghost, btn.sm, "mr-auto -ml-3 text-rose hover:text-rose")}>
            Delete task
          </button>
        )}
        <button type="button" onClick={onDone} className={cx(btn.ghost, btn.sm)}>Cancel</button>
        <button type="submit" disabled={!title.trim()} className={cx(btn.primary, btn.sm)}>Save task</button>
      </div>
    </form>
  );
}

/* ── Subtasks ───────────────────────────────────────────────────────────── */

function Subtasks({ task, facts, canEdit }: { task: TaskDTO; facts: TaskAccessFacts; canEdit: boolean }) {
  const { team, run, patchTask, isPending } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [draftPeople, setDraftPeople] = useState<string[]>([]);
  const done = task.subtasks.filter((s) => s.done).length;
  const patchSub = (id: string, p: Partial<SubtaskDTO>) =>
    patchTask(task.id, { subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    const people = draftPeople;
    setDraftPeople([]);
    const subId = newId();
    run(() => createSubtask({ id: subId, teamId: team.id, taskId: task.id, title: t, assigneeIds: people }), {
      pendingId: subId,
      optimistic: () =>
        patchTask(task.id, {
          subtasks: [...task.subtasks, { id: subId, title: t, description: null, done: false, assigneeIds: people, completedAt: null }],
        }),
    });
  };

  if (!canEdit && !task.subtasks.length) return null;

  return (
    <section aria-label="Subtasks" className="border-t border-line pt-4">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium">Subtasks</h4>
        {task.subtasks.length > 0 && <span className="font-mono text-[12px] tabular-nums text-ink-3">{done}/{task.subtasks.length} done</span>}
      </div>
      {task.subtasks.length > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-tint/[0.06]">
          <div className="h-full rounded-full bg-emerald transition-[width] duration-500" style={{ width: `${(done / task.subtasks.length) * 100}%` }} />
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {task.subtasks.map((s) => (
          <SubtaskRow
            key={s.id}
            sub={s}
            canEdit={canEdit}
            temp={isPending(s.id)}
            canToggle={!isPending(s.id) && canToggleSubtask(facts, s.assigneeIds)}
            onToggle={() =>
              run(() => toggleSubtask({ teamId: team.id, itemId: s.id, done: !s.done }), {
                optimistic: () => patchSub(s.id, { done: !s.done, completedAt: s.done ? null : new Date().toISOString() }),
              })
            }
            onUpdate={(patch) =>
              run(() => updateSubtask({ teamId: team.id, itemId: s.id, ...patch }), {
                optimistic: () => patchSub(s.id, { ...patch, ...(patch.description !== undefined && { description: patch.description || null }) }),
              })
            }
            onAssign={(ids) =>
              run(() => setSubtaskAssignees({ teamId: team.id, itemId: s.id, userIds: ids }), { optimistic: () => patchSub(s.id, { assigneeIds: ids }) })
            }
            onDelete={() =>
              run(() => deleteSubtask({ teamId: team.id, itemId: s.id }), {
                optimistic: () => patchTask(task.id, { subtasks: task.subtasks.filter((x) => x.id !== s.id) }),
              })
            }
          />
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={LIMITS.title}
            aria-label="New subtask"
            placeholder="+ Add a subtask"
            className={cx(inputCls, "h-9 min-w-0 flex-1")}
          />
          <AssigneesPicker value={draftPeople} onChange={setDraftPeople} label="Assign the new subtask" compact />
          <button type="submit" disabled={!draft.trim()} className={cx(btn.outline, btn.sm, "shrink-0")}>Add</button>
        </form>
      )}
    </section>
  );
}

function SubtaskRow({
  sub,
  temp,
  canEdit,
  canToggle,
  onToggle,
  onUpdate,
  onAssign,
  onDelete,
}: {
  sub: SubtaskDTO;
  temp: boolean;
  canEdit: boolean;
  canToggle: boolean;
  onToggle: () => void;
  onUpdate: (patch: { title?: string; description?: string }) => void;
  onAssign: (ids: string[]) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(sub.title);
  const [description, setDescription] = useState(sub.description ?? "");
  const [open, setOpen] = useState(false);
  const commitTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(sub.title);
    if (t !== sub.title) onUpdate({ title: t });
  };
  const commitDescription = () => {
    const d = description.trim();
    if (d !== (sub.description ?? "")) onUpdate({ description: d });
  };
  const hasDetails = !!sub.description;

  return (
    <li className="group rounded-lg px-1.5 py-1 transition-colors hover:bg-tint/[0.03]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={sub.done}
          aria-label={sub.done ? `Mark "${sub.title}" not done` : `Mark "${sub.title}" done`}
          disabled={!canToggle}
          onClick={onToggle}
          className={cx(
            "grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed",
            sub.done ? "border-emerald bg-emerald text-bg" : "border-line-strong hover:border-ink-3",
            !canToggle && "opacity-50",
          )}
        >
          {sub.done && <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="m2 5.2 2 2 4-4.4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        {canEdit && !temp ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
            maxLength={LIMITS.title}
            aria-label="Subtask title"
            className={cx("h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[14px] outline-none focus:bg-surface-2", sub.done ? "text-ink-3 line-through" : "text-ink")}
          />
        ) : (
          <span className={cx("min-w-0 flex-1 px-1.5 text-[14px]", sub.done ? "text-ink-3 line-through" : "text-ink")}>{sub.title}</span>
        )}
        {!temp && (canEdit || hasDetails) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide description" : canEdit ? "Description" : "Show description"}
            title="Description"
            className={cx("grid size-7 place-items-center rounded-md transition-colors hover:text-ink", hasDetails ? "text-ink-2" : "text-ink-3 opacity-60 group-hover:opacity-100")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 3h7M2.5 6h7M2.5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        )}
        {canEdit && !temp ? <AssigneesPicker value={sub.assigneeIds} onChange={onAssign} label="Subtask assignees" compact /> : sub.assigneeIds.length > 0 && <AvatarStack ids={sub.assigneeIds} size={18} />}
        {canEdit && !temp && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete subtask "${sub.title}"`}
            className="grid size-7 place-items-center rounded-md text-ink-3 opacity-60 transition-[opacity,color] hover:text-rose group-hover:opacity-100"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      {open && (
        <div className="pb-1 pl-[30px] pr-1 pt-0.5">
          {canEdit ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              maxLength={LIMITS.description}
              rows={2}
              autoFocus={!hasDetails}
              aria-label={`Description for "${sub.title}"`}
              placeholder="Details for this step. Saved when you click away."
              className={cx(inputCls, "resize-y py-2 text-[13px] leading-relaxed")}
            />
          ) : (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{sub.description}</p>
          )}
        </div>
      )}
      {!open && hasDetails && <p className="truncate pb-0.5 pl-[30px] text-[12px] text-ink-3">{sub.description}</p>}
    </li>
  );
}
