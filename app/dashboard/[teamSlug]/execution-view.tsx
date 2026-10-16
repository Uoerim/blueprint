"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { archiveIdea, createProject, deleteIdea, returnToIdeas, updateIdea } from "@/app/actions/ideas";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/constants";
import type { IdeaDTO, TaskDTO } from "@/lib/types";
import { BoardView } from "./board-view";
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
  const { ideas, tasks, openProject, member, can } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const projects = ideas.filter((i) => i.status === "PROMOTED");
  const loose = tasks.filter((t) => !t.idea && t.status !== "DONE").length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-ink-2">
          {projects.length ? `${projects.length} project${projects.length > 1 ? "s" : ""} in execution` : "No projects yet"}
          {loose > 0 && <span className="text-ink-3"> · {loose} open task{loose > 1 ? "s" : ""} with no project or idea</span>}
        </p>
        {can("projects.create") && (
          <button type="button" onClick={() => setCreating(true)} className={cx(btn.primary, btn.sm)}>New project</button>
        )}
      </div>

      {projects.length ? (
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {projects.map((p) => {
              const s = projectStats(tasks, p.id);
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const temp = p.id.startsWith("tmp-");
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
            <button type="button" onClick={() => setCreating(true)} className={cx(btn.outline, btn.sm, "mt-5")}>New project</button>
          )}
        </div>
      )}

      <ProjectDialog open={creating} onClose={() => setCreating(false)} />
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
          {canEdit && <button type="button" onClick={() => setEditing(true)} className={cx(btn.outline, btn.sm)}>Edit project</button>}
          {canArchive && project.status === "PROMOTED" && (
            <button type="button" onClick={() => setConfirm("return")} className={cx(btn.ghost, btn.sm)}>Back to ideas</button>
          )}
          {canArchive && <button type="button" onClick={() => setConfirm("archive")} className={cx(btn.ghost, btn.sm)}>Archive</button>}
          {canDelete && (
            <button type="button" onClick={() => setConfirm("delete")} className={cx(btn.ghost, btn.sm, "text-rose hover:text-rose")}>Delete</button>
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

      <ProjectDialog open={editing} onClose={() => setEditing(false)} project={project} />
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

function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: IdeaDTO }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={project ? undefined : "A project holds its own description, tasks and subtasks."}
    >
      {open && <ProjectForm project={project} onClose={onClose} />}
    </Dialog>
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
    run(() => createProject({ teamId: team.id, title: t, description: d || undefined }), {
      optimistic: () =>
        addIdea({
          id: `tmp-${now}`,
          title: t,
          description: d || null,
          tags: [],
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
    <div className="flex rounded-lg bg-surface p-0.5 shadow-highlight sm:w-fit" role="tablist" aria-label="Execution views">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
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
