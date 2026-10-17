"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { archiveIdea, createProject, deleteIdea, returnToIdeas, updateIdea } from "@/app/actions/ideas";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/constants";
import { newId } from "@/lib/live";
import type { IdeaDTO, TaskDTO } from "@/lib/types";
import { BoardView } from "./board-view";
import { ImportDialog } from "./import-dialog";
import { useWorkspace } from "./workspace";

export type Tab = "projects" | "all" | "mine";
const TABS: { id: Tab; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "mine", label: "My tasks" },
  { id: "all", label: "All tasks" },
];

/** Execution: a list of projects, a page per project, plus cross-project task boards. */
export function ExecutionView({ projectId }: { projectId: string | null }) {
  const { ideas } = useWorkspace();
  const project = projectId ? ideas.find((i) => i.id === projectId && i.status === "PROMOTED") : undefined;
  if (projectId && project) return <ProjectPage key={project.id} project={project} />;
  return <ExecutionHome missing={!!projectId && !project} />;
}

function ExecutionHome({ missing }: { missing: boolean }) {
  const { execTab: tab, setExecTab: setTab, setView } = useWorkspace();
  const openShipped = () => setView("shipped");
  return (
    <div>
      {missing && (
        <p className="mb-4 rounded-xl bg-amber/10 px-4 py-3 text-[14px] text-amber">That project no longer exists or was archived.</p>
      )}
      <div className="app:hidden">
        <Segments tabs={TABS} active={tab} onPick={(t) => setTab(t as Tab)} />
      </div>
      <div className="hidden app:block">
        <ExecutionAppSegments active={tab} onPick={(t) => (t === "shipped" ? openShipped() : setTab(t))} />
      </div>
      <div className="mt-5">
        {tab === "projects" && <ProjectList />}
        {tab === "mine" && <BoardView key="mine" initialFilter="mine" />}
        {tab === "all" && <BoardView key="all" />}
      </div>
    </div>
  );
}

/* ── Project list ───────────────────────────────────────────────────────── */

function projectStats(tasks: TaskDTO[], id: string) {
  const own = tasks.filter((t) => t.idea?.id === id);
  const done = own.filter((t) => t.status === "DONE").length;
  const people = [...new Set(own.flatMap((t) => t.assigneeIds))];
  const focused = own.some((t) => t.status === "IN_PROGRESS" && t.focus.length > 0);
  return { total: own.length, done, open: own.length - done, people, focused };
}

function ProjectList() {
  const { ideas, tasks, openProject, member, can, isPending } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const projects = ideas.filter((i) => i.status === "PROMOTED");
  const loose = tasks.filter((t) => !t.idea && t.status !== "DONE").length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-ink-2">
          {projects.length ? `${projects.length} project${projects.length > 1 ? "s" : ""} in execution` : "No projects yet"}
          {loose > 0 && <span className="text-ink-3"> · {loose} open task{loose > 1 ? "s" : ""} with no project or idea</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {can("projects.create") && can("tasks.create") && (
            <button type="button" onClick={() => setImporting(true)} className={cx(btn.outline, btn.sm, "gap-1.5")} title="Plan a project with any AI assistant and import it as JSON">
              <SparkleIcon />
              <span>
                Import<span className="hidden sm:inline"> with AI</span>
              </span>
            </button>
          )}
          {can("projects.create") && (
            <button type="button" onClick={() => setCreating(true)} className={cx(btn.primary, btn.sm)}>New project</button>
          )}
        </div>
      </div>

      {projects.length ? (
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {projects.map((p) => {
              const s = projectStats(tasks, p.id);
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const temp = isPending(p.id);
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: temp ? 0.6 : 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                >
                  <button
                    type="button"
                    disabled={temp}
                    onClick={() => openProject(p.id)}
                    className="card group flex h-full w-full flex-col rounded-2xl p-4 text-left transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.99]"
                  >
                    <span className="flex items-start gap-2">
                      <span className="mt-1 text-violet" aria-hidden>◆</span>
                      <span className="min-w-0 flex-1 text-[16px] font-medium leading-snug text-ink">{p.title}</span>
                      {s.focused && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald" title="Someone is in focus" />}
                    </span>
                    <span className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-ink-2">
                      {p.description || <span className="text-ink-3">No description yet.</span>}
                    </span>
                    <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
                      <motion.span
                        className="block h-full rounded-full bg-emerald"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </span>
                    <span className="mt-3 flex items-center gap-3">
                      <span className="font-mono text-[12px] tabular-nums text-ink-3">
                        {s.done}/{s.total} done · {s.open} open
                      </span>
                      <span className="ml-auto flex -space-x-1.5">
                        {s.people.slice(0, 4).map((id) => {
                          const m = member(id);
                          return m ? <Monogram key={id} name={m.username} color={m.accentColor} src={m.imageUrl} size={22} className="ring-2 ring-surface" /> : null;
                        })}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="card mt-4 rounded-2xl px-6 py-14 text-center">
          <p className="text-[15px] text-ink">No projects yet.</p>
          <p className="mt-1 text-sm text-ink-3">Each project gets its own description, board, tasks and subtasks.</p>
          {can("projects.create") && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setCreating(true)} className={cx(btn.outline, btn.sm)}>New project</button>
              {can("tasks.create") && (
                <button type="button" onClick={() => setImporting(true)} className={cx(btn.ghost, btn.sm, "gap-1.5")}>
                  <SparkleIcon />
                  Plan it with AI
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onImport={
          can("tasks.create")
            ? () => {
                setCreating(false);
                setImporting(true);
              }
            : undefined
        }
      />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

/* ── One project ────────────────────────────────────────────────────────── */

function ProjectPage({ project }: { project: IdeaDTO }) {
  const { tasks, member, openProject, openIdea, team, viewer, can, run, removeIdea, removeTask, patchIdea, patchTask } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | "return" | null>(null);
  const s = projectStats(tasks, project.id);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const own = project.authorId === viewer.id;
  const canEdit = own || can("projects.edit");
  const canArchive = own || can("projects.archive");
  const canDelete = can("projects.delete");
  const author = member(project.authorId);

  const archive = () => {
    openProject(null);
    run(() => archiveIdea({ teamId: team.id, itemId: project.id }), {
      optimistic: () => removeIdea(project.id),
      success: "Project archived. Restore it from team settings.",
    });
  };

  // Back to the vault as a fresh idea: tasks stay, every bit of progress is reset.
  const backToIdeas = () => {
    const projectTasks = tasks.filter((t) => t.idea?.id === project.id);
    run(() => returnToIdeas({ teamId: team.id, itemId: project.id }), {
      optimistic: () => {
        patchIdea(project.id, { status: "VAULT", doneCount: 0 });
        projectTasks.forEach((t) =>
          patchTask(t.id, {
            status: "TODO",
            completedAt: null,
            completedById: null,
            focus: [],
            subtasks: t.subtasks.map((st) => ({ ...st, done: false, completedAt: null })),
          }),
        );
        openIdea(project.id);
      },
      success: "Back in the idea vault, with its tasks reset.",
    });
  };

  // Deleting a project always takes its tasks (and their subtasks) with it.
  const destroy = () => {
    const ids = tasks.filter((t) => t.idea?.id === project.id).map((t) => t.id);
    openProject(null);
    run(() => deleteIdea({ teamId: team.id, itemId: project.id, confirm: project.title }), {
      optimistic: () => {
        removeIdea(project.id);
        ids.forEach(removeTask);
      },
      success: ids.length ? "Project and its tasks deleted." : "Project deleted.",
    });
  };

  return (
    <div>
      <button type="button" onClick={() => openProject(null)} className={cx(btn.ghost, btn.sm, "-ml-3")}>
        <span aria-hidden>←</span> All projects
      </button>

      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">{project.title}</h2>
          <p className="mt-2 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">
            {project.description || <span className="text-ink-3">No description yet. Add one so everyone knows what done looks like.</span>}
          </p>
          {author && (
            <p className="mt-2 text-[13px] text-ink-3">
              Started by <span className="font-mono" style={{ color: readable(author.accentColor) }}>@{author.username}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(canEdit || canArchive || canDelete) && (
            <button type="button" onClick={() => setEditing(true)} className={cx(btn.outline, btn.sm, "gap-1.5")}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16.2 12.2a1.3 1.3 0 0 0 .26 1.43l.05.05a1.58 1.58 0 1 1-2.23 2.23l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.58 1.58 0 1 1-3.16 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.58 1.58 0 1 1-2.23-2.23l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79h-.14a1.58 1.58 0 1 1 0-3.16h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.58 1.58 0 1 1 2.23-2.23l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.58 1.58 0 1 1 3.16 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.58 1.58 0 1 1 2.23 2.23l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.58 1.58 0 1 1 0 3.16h-.07a1.3 1.3 0 0 0-1.19.79Z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Project settings
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section aria-label="Progress" className="card rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Progress</h3>
            <span className="font-mono text-[12px] tabular-nums text-ink-3">{pct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-tint/[0.06]">
            <motion.div className="h-full rounded-full bg-emerald" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Open", s.open],
              ["Done", s.done],
              ["People", s.people.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 py-2.5">
                <dt className="text-[12px] text-ink-3">{k}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <ProjectPeople projectId={project.id} people={s.people} />
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-ink-2">Tasks</h3>
        <div className="mt-3">
          <BoardView projectId={project.id} />
        </div>
      </div>

      <ProjectDialog
        open={editing}
        onClose={() => setEditing(false)}
        project={project}
        canEdit={canEdit}
        actions={
          canArchive || canDelete ? (
            <ProjectActions
              onBack={canArchive && project.status === "PROMOTED" ? () => (setEditing(false), setConfirm("return")) : undefined}
              onArchive={canArchive ? () => (setEditing(false), setConfirm("archive")) : undefined}
              onDelete={canDelete ? () => (setEditing(false), setConfirm("delete")) : undefined}
            />
          ) : null
        }
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        title="Archive project?"
        description={<>&ldquo;{project.title}&rdquo; leaves Execution. Its tasks stay on the board without a project, and you can restore it any time from team settings.</>}
        confirmLabel="Archive project"
        tone="neutral"
        level={{ kind: "plain" }}
        onConfirm={archive}
      />
      <ConfirmDialog
        open={confirm === "return"}
        onClose={() => setConfirm(null)}
        title="Move back to ideas?"
        description={
          <>
            &ldquo;{project.title}&rdquo; goes back to the idea vault as if it had just been captured.
            {s.total > 0 ? (
              <>
                {" "}Its {s.total} task{s.total === 1 ? " stays" : "s stay"}, but all progress is reset: every task goes back to
                Backlog, subtasks are unticked and live focus stops.
              </>
            ) : (
              <> It has no tasks yet, so nothing is lost.</>
            )}
          </>
        }
        confirmLabel="Move back to ideas"
        level={s.total > 0 ? { kind: "ack" } : { kind: "plain" }}
        onConfirm={backToIdeas}
      >
        {s.total > 0 && (
          <div role="note" className="flex items-start gap-3 rounded-xl bg-amber/10 p-3 text-[14px] text-ink">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0 text-amber">
              <path d="M8 1.75 15 14.25H1L8 1.75Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 6.25v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.9" r=".8" fill="currentColor" />
            </svg>
            <span className="min-w-0 flex-1">
              Want to keep everything as it is?
              <span className="block text-[13px] text-ink-3">
                Archive it instead: it leaves Execution with all its progress, and you can restore it later from team settings.
              </span>
            </span>
            <button type="button" onClick={() => setConfirm("archive")} className={cx(btn.outline, btn.sm, "shrink-0")}>
              Archive instead
            </button>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete project?"
        description={
          <>
            &ldquo;{project.title}&rdquo;, its description
            {s.total > 0 ? <> and its {s.total} task{s.total === 1 ? "" : "s"}, with their subtasks,</> : null} will be deleted for
            everyone on the team. Only the team owner can do this. Want to keep it for later? Archive it instead.
          </>
        }
        confirmLabel="Delete project"
        level={{ kind: "type", phrase: project.title, what: "project name" }}
        onConfirm={destroy}
      />
    </div>
  );
}

/** Who is on the project: open tasks per person and who is working right now. */
function ProjectPeople({ projectId, people }: { projectId: string; people: string[] }) {
  const { tasks, member } = useWorkspace();
  const own = tasks.filter((t) => t.idea?.id === projectId);
  return (
    <section aria-label="People on this project" className="card rounded-2xl p-4">
      <h3 className="text-sm font-medium">People</h3>
      {people.length ? (
        <ul className="mt-3 space-y-1">
          {people.map((id) => {
            const m = member(id);
            if (!m) return null;
            const mine = own.filter((t) => t.assigneeIds.includes(id));
            const open = mine.filter((t) => t.status !== "DONE").length;
            const working = own.find((t) => t.status === "IN_PROGRESS" && t.focus.some((f) => f.userId === id));
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <Monogram name={m.username} color={m.accentColor} src={m.imageUrl} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px]" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {working ? <>Working on <span className="text-ink-2">{working.title}</span></> : `${open} open of ${mine.length}`}
                  </span>
                </span>
                {working && <span className="size-2 shrink-0 rounded-full bg-emerald" aria-label="In focus" />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-3">Nobody is assigned to this project&apos;s tasks yet.</p>
      )}
    </section>
  );
}

/* ── Create / edit project ──────────────────────────────────────────────── */

function ProjectDialog({
  open,
  onClose,
  project,
  canEdit = true,
  actions,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  project?: IdeaDTO;
  canEdit?: boolean;
  /** Project settings only: back to ideas, archive, delete. */
  actions?: React.ReactNode;
  /** New project only: switch to "Import with AI". */
  onImport?: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Project settings" : "New project"}
      description={project ? "Its name and description, and what to do with it." : "A project holds its own description, tasks and subtasks."}
    >
      {open && (
        <div className="space-y-6">
          {canEdit && <ProjectForm project={project} onClose={onClose} />}
          {actions}
          {!project && onImport && (
            <button
              type="button"
              onClick={onImport}
              className="group flex w-full items-center gap-3 rounded-xl bg-accent/[0.07] p-3 text-left shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_25%,transparent)] transition-colors hover:bg-accent/[0.12]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                <SparkleIcon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">Plan it with AI instead</span>
                <span className="block text-[12px] leading-snug text-ink-3">Copy a ready prompt, paste the JSON your assistant writes, get the project with its tasks.</span>
              </span>
              <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The bottom of Project settings: the bigger moves, each with its own confirmation. */
function ProjectActions({ onBack, onArchive, onDelete }: { onBack?: () => void; onArchive?: () => void; onDelete?: () => void }) {
  const row = (title: string, note: string, label: string, onClick: () => void, danger?: boolean) => (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className={cx("text-[14px] font-medium", danger ? "text-rose" : "text-ink")}>{title}</p>
        <p className="text-[12px] leading-snug text-ink-3">{note}</p>
      </div>
      <button type="button" onClick={onClick} className={cx(btn.outline, btn.sm, "shrink-0", danger && "text-rose hover:text-rose")}>
        {label}
      </button>
    </div>
  );
  return (
    <section aria-label="Project actions" className="divide-y divide-line border-t border-line pt-4">
      {onBack && row("Back to ideas", "Return it to the vault as a fresh idea. Its tasks stay, progress resets.", "Move", onBack)}
      {onArchive && row("Archive", "Set it aside with everything kept. Restore it any time from team settings.", "Archive", onArchive)}
      {onDelete && row("Delete project", "Permanently deletes it and its tasks. Only the team owner can do this.", "Delete", onDelete, true)}
    </section>
  );
}

function ProjectForm({ project, onClose }: { project?: IdeaDTO; onClose: () => void }) {
  const { team, viewer, run, addIdea, patchIdea, openProject } = useWorkspace();
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (!t) return;
    onClose();
    if (project) {
      run(() => updateIdea({ teamId: team.id, itemId: project.id, title: t, description: d }), {
        optimistic: () => patchIdea(project.id, { title: t, description: d || null }),
        success: "Project saved.",
      });
      return;
    }
    const now = new Date().toISOString();
    const projectId = newId();
    run(() => createProject({ id: projectId, teamId: team.id, title: t, description: d || undefined }), {
      pendingId: projectId,
      optimistic: () =>
        addIdea({
          id: projectId,
          title: t,
          description: d || null,
          status: "PROMOTED",
          sparksCount: 0,
          sparkedByMe: false,
          authorId: viewer.id,
          createdAt: now,
          taskCount: 0,
          doneCount: 0,
        }),
      success: "Project created.",
      onOk: (data) => openProject(data.id),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor="project-title">
        <input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.title}
          required
          placeholder="Tilt-controlled arpeggiator"
          className={cx(inputCls, "h-10")}
        />
      </Field>
      <Field label="Description" htmlFor="project-description" hint="What it is and what done looks like.">
        <textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.description}
          rows={4}
          className={cx(inputCls, "resize-y py-2.5 leading-relaxed")}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>Cancel</button>
        <button type="submit" disabled={!title.trim()} className={cx(btn.primary, btn.sm)}>
          {project ? "Save project" : "Create project"}
        </button>
      </div>
    </form>
  );
}

/** A segmented control (the website's Execution tabs). */
function Segments({ tabs, active, onPick }: { tabs: readonly { id: string; label: string }[]; active: string; onPick: (id: string) => void }) {
  return (
    <div data-tour="exec-views" className="flex rounded-lg bg-surface p-0.5 shadow-highlight sm:w-fit" role="tablist" aria-label="Execution views">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-tour={t.id === "shipped" ? "shipped" : undefined}
          aria-selected={active === t.id}
          onClick={() => onPick(t.id)}
          className={cx(
            "h-8 flex-1 rounded-md px-4 text-[13px] transition-colors sm:flex-none app:h-10 app:px-2",
            active === t.id ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const APP_SEGMENTS = [...TABS.map((t) => ({ id: t.id, label: t.id === "mine" ? "Mine" : t.id === "all" ? "All" : t.label })), { id: "shipped", label: "Shipped" }] as const;

/** The installed app's Tasks segments: Projects · Mine · All · Shipped. */
export function ExecutionAppSegments({ active, onPick }: { active: string; onPick: (id: Tab | "shipped") => void }) {
  return (
    <div className="hidden app:block">
      <Segments tabs={APP_SEGMENTS} active={active} onPick={(id) => onPick(id as Tab | "shipped")} />
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
