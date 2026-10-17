"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { stopFocus } from "@/app/actions/tasks";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/action-types";
import { markLocalChange } from "@/lib/live";
import type { TeamPermission } from "@/lib/team-permissions";
import type { IdeaDTO, MemberDTO, OutgoingInvite, TagDTO, TaskDTO, Viewer } from "@/lib/types";
import { AppTeamBar } from "../_components/app-team-bar";
import { rememberTeam } from "../_components/app-shell";
import { ExecutionAppSegments, ExecutionView, type Tab as ExecTab } from "./execution-view";
import { TeamTour } from "./team-tour";
import { InviteDialog } from "./invite-dialog";
import { ShippedView } from "./shipped-view";
import { VaultView } from "./vault-view";

type TaskOp = { type: "patch"; id: string; patch: Partial<TaskDTO> } | { type: "add"; task: TaskDTO } | { type: "remove"; id: string };
type IdeaOp = { type: "patch"; id: string; patch: Partial<IdeaDTO> } | { type: "add"; idea: IdeaDTO } | { type: "remove"; id: string };

type Ctx = {
  team: { id: string; name: string; slug: string; description: string | null };
  viewer: Viewer;
  myRole: MemberDTO["role"];
  /** Effective team permissions. The UI only hides controls; the server enforces. */
  can: (p: TeamPermission) => boolean;
  perms: readonly TeamPermission[];
  members: MemberDTO[];
  member: (id: string | null | undefined) => MemberDTO | undefined;
  tasks: TaskDTO[];
  ideas: IdeaDTO[];
  run: <T>(
    fn: () => Promise<ActionResult<T>>,
    opts?: { optimistic?: () => void; success?: string; onOk?: (data: T) => void; /** Shown as saving until the server confirms. */ pendingId?: string },
  ) => void;
  /** True while something just created here is still being saved. */
  isPending: (id: string) => boolean;
  patchTask: (id: string, patch: Partial<TaskDTO>) => void;
  addTask: (task: TaskDTO) => void;
  removeTask: (id: string) => void;
  patchIdea: (id: string, patch: Partial<IdeaDTO>) => void;
  addIdea: (idea: IdeaDTO) => void;
  removeIdea: (id: string) => void;
  /** Open one project's page inside Execution (null = back to the list). */
  openProject: (id: string | null) => void;
  /** Open one raw idea's page inside the vault (null = back to the vault). */
  openIdea: (id: string | null) => void;
  tags: TagDTO[];
  /** Which Execution segment is open (kept here so the app's Shipped segment can return to it). */
  execTab: ExecTab;
  setExecTab: (t: ExecTab) => void;
  setView: (v: View) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);
export function useWorkspace() {
  const ctx = use(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside Workspace");
  return ctx;
}

type View = "vault" | "board" | "shipped";
const VIEWS: { id: View; label: string }[] = [
  { id: "vault", label: "Idea vault" },
  { id: "board", label: "Execution" },
  { id: "shipped", label: "Shipped" },
];
const isView = (v: string | undefined): v is View => v === "vault" || v === "board" || v === "shipped";

/** Mirror the open view, project or idea in the address bar so a page can be shared or reloaded. */
function syncUrl(view: View, open: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  url.searchParams.delete("project");
  url.searchParams.delete("idea");
  if (view !== "vault") url.searchParams.set("view", view);
  if (view === "board" && open) url.searchParams.set("project", open);
  if (view === "vault" && open) url.searchParams.set("idea", open);
  window.history.replaceState(null, "", url);
}

export function Workspace(props: {
  team: Ctx["team"];
  viewer: Viewer;
  myRole: MemberDTO["role"];
  perms: TeamPermission[];
  members: MemberDTO[];
  ideas: IdeaDTO[];
  tasks: TaskDTO[];
  invites: OutgoingInvite[];
  tags: TagDTO[];
  initialView?: string;
  initialProject?: string;
  initialIdea?: string;
  initialInvite?: boolean;
  /** First visit to a team: walk them through it. */
  showTour?: boolean;
  /** The on-screen demo team after the welcome tour: nothing is ever sent to the server. */
  demo?: boolean;
}) {
  const router = useRouter();
  const [view, setViewState] = useState<View>(
    props.initialProject ? "board" : isView(props.initialView) ? props.initialView : "vault",
  );
  const [project, setProject] = useState<string | null>(props.initialProject ?? null);
  const [idea, setIdea] = useState<string | null>(props.initialProject ? null : (props.initialIdea ?? null));
  const setView = (v: View) => {
    setViewState(v);
    setProject(null);
    setIdea(null);
    syncUrl(v, null);
  };
  const openProject = (id: string | null) => {
    setViewState("board");
    setProject(id);
    setIdea(null);
    syncUrl("board", id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openIdea = (id: string | null) => {
    setViewState("vault");
    setIdea(id);
    setProject(null);
    syncUrl("vault", id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // The installed app's tab bar links to ?view=vault / ?view=board; follow it when it changes.
  // Our own syncUrl() keeps the address in step with state, so only a real navigation
  // (a tab-bar tap, back/forward) makes the two disagree; then the address wins.
  const params = useSearchParams();
  const urlView = params.get("view") ?? undefined;
  const urlKey = `${isView(urlView) && urlView !== "vault" ? urlView : ""}|${params.get("project") ?? ""}|${params.get("idea") ?? ""}`;
  const stateKey = `${view === "vault" ? "" : view}|${view === "board" ? (project ?? "") : ""}|${view === "vault" ? (idea ?? "") : ""}`;
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  if (urlKey !== seenUrlKey) {
    setSeenUrlKey(urlKey);
    if (urlKey !== stateKey) {
      const next: View = isView(urlView) ? urlView : "vault";
      setViewState(next);
      setProject(next === "board" ? params.get("project") : null);
      setIdea(next === "vault" ? params.get("idea") : null);
    }
  }
  useEffect(() => {
    if (!props.demo) rememberTeam(props.team.slug);
  }, [props.team.slug, props.demo]);

  const [execTab, setExecTab] = useState<ExecTab>("projects");
  const [inviteOpen, setInviteOpen] = useState(!!props.initialInvite);
  // ?invite=1 (from team settings) opens the invite dialog once, then leaves the URL.
  useEffect(() => {
    if (!props.initialInvite) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url);
  }, [props.initialInvite]);
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "error" } | null>(null);
  const [, startTransition] = useTransition();

  const [tasks, applyTask] = useOptimistic(props.tasks, (state: TaskDTO[], op: TaskOp) => {
    if (op.type === "add") return [op.task, ...state];
    if (op.type === "remove") return state.filter((t) => t.id !== op.id);
    return state.map((t) => (t.id === op.id ? { ...t, ...op.patch } : t));
  });
  const [ideas, applyIdea] = useOptimistic(props.ideas, (state: IdeaDTO[], op: IdeaOp) => {
    if (op.type === "add") return [op.idea, ...state];
    if (op.type === "remove") return state.filter((i) => i.id !== op.id);
    return state.map((i) => (i.id === op.id ? { ...i, ...op.patch } : i));
  });

  // Items created here that the server hasn't confirmed yet (cleared automatically when the save ends).
  const [pendingIds, addPending] = useOptimistic(new Set<string>() as ReadonlySet<string>, (s: ReadonlySet<string>, id: string) => new Set(s).add(id));

  const showToast = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setToast({ id: Date.now(), text, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.tone === "error" ? 4200 : 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const memberMap = useMemo(() => new Map(props.members.map((m) => [m.userId, m])), [props.members]);

  const ctx: Ctx = {
    team: props.team,
    viewer: props.viewer,
    myRole: props.myRole,
    perms: props.perms,
    can: (p) => props.perms.includes(p),
    members: props.members,
    member: (id) => (id ? memberMap.get(id) : undefined),
    tasks,
    ideas,
    openProject,
    openIdea,
    tags: props.tags,
    execTab,
    setExecTab,
    setView,
    run: (fn, opts) =>
      props.demo
        ? showToast("This is the demo team, so nothing here is saved.")
        : startTransition(async () => {
        if (opts?.pendingId) addPending(opts.pendingId);
        opts?.optimistic?.();
        const res = await fn();
        if (!res.ok) showToast(res.error, "error");
        else {
          markLocalChange();
          if (opts?.success) showToast(opts.success);
          opts?.onOk?.(res.data);
        }
      }),
    isPending: (id) => pendingIds.has(id),
    patchTask: (id, patch) => applyTask({ type: "patch", id, patch }),
    addTask: (task) => applyTask({ type: "add", task }),
    removeTask: (id) => applyTask({ type: "remove", id }),
    patchIdea: (id, patch) => applyIdea({ type: "patch", id, patch }),
    addIdea: (idea) => applyIdea({ type: "add", idea }),
    removeIdea: (id) => applyIdea({ type: "remove", id }),
  };

  // Live updates come from <LivePulse /> in the dashboard layout.

  return (
    <WorkspaceContext value={ctx}>
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-24 pt-6 sm:px-6 app:px-4 app:pb-4 app:pt-2">
        {/* Installed app: team chip, invite and settings in one compact row. */}
        <AppTeamBar
          team={props.team}
          canInvite={props.perms.includes("members.invite")}
          onInvite={() => setInviteOpen(true)}
        />
        {/* Team header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between app:hidden">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{props.team.name}</h1>
            {props.team.description && (
              <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">{props.team.description}</p>
            )}
          </div>
          <div data-tour="team-actions" className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (props.perms.includes("members.invite") ? setInviteOpen(true) : router.push(`/dashboard/${props.team.slug}/settings#members`))}
              className="flex -space-x-1.5 rounded-lg p-1 transition-colors hover:bg-tint/[0.05]"
              aria-label={`${props.members.length} members — manage`}
            >
              {props.members.slice(0, 5).map((m) => (
                <Monogram key={m.userId} name={m.username} color={m.accentColor} src={m.imageUrl} size={26} className="ring-2 ring-bg" />
              ))}
              {props.members.length > 5 && (
                <span className="grid size-[26px] place-items-center rounded-[28%] bg-surface-3 text-[11px] text-ink-2 ring-2 ring-bg">
                  +{props.members.length - 5}
                </span>
              )}
            </button>
            {props.perms.includes("members.invite") && (
              <button type="button" onClick={() => setInviteOpen(true)} className={cx(btn.outline, btn.sm)}>
                Invite teammates
              </button>
            )}
            <Link
              href={`/dashboard/${props.team.slug}/settings`}
              aria-label="Team settings"
              title="Team settings"
              className={cx(btn.outline, btn.sm, "!px-2.5")}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16.2 12.2a1.3 1.3 0 0 0 .26 1.43l.05.05a1.58 1.58 0 1 1-2.23 2.23l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.58 1.58 0 0 1-3.16 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.58 1.58 0 1 1-2.23-2.23l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79h-.14a1.58 1.58 0 0 1 0-3.16h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.58 1.58 0 1 1 2.23-2.23l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.58 1.58 0 0 1 3.16 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.58 1.58 0 1 1 2.23 2.23l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.58 1.58 0 0 1 0 3.16h-.07a1.3 1.3 0 0 0-1.19.79Z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>

        {/* In the app, Live focus belongs to the Tasks tab. */}
        <div className={cx(view === "vault" && "app:hidden")}>
          <FocusDock />
        </div>

        {/* View switcher */}
        <div className="mt-8 flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] app:hidden" role="tablist" aria-label="Workspace views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              data-tour={v.id === "shipped" ? "shipped" : undefined}
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cx(
                "relative -mb-px flex h-10 shrink-0 items-center gap-2 px-3 text-sm transition-colors",
                view === v.id ? "text-ink" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {v.label}
              <span className="font-mono text-[11px] text-ink-3">
                {v.id === "vault"
                  ? ideas.filter((i) => i.status === "VAULT").length
                  : v.id === "board"
                    ? tasks.filter((t) => t.status !== "DONE").length
                    : tasks.filter((t) => t.status === "DONE").length}
              </span>
              {view === v.id && (
                <motion.span layoutId="tab-underline" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
              )}
            </button>
          ))}
        </div>

        <div className="pt-6 app:pt-4">
          {view === "vault" && <VaultView ideaId={idea} />}
          {view === "board" && <ExecutionView projectId={project} />}
          {view === "shipped" && (
            <>
              {/* In the app, Shipped is one of the Tasks segments, so keep the segment bar on screen. */}
              <ExecutionAppSegments
                active="shipped"
                onPick={(seg) => {
                  if (seg === "shipped") return;
                  setExecTab(seg);
                  setView("board");
                }}
              />
              <ShippedView />
            </>
          )}
        </div>
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} invites={props.invites} />

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className={cx(
                "glass-solid pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]",
                toast.tone === "error" ? "border-rose/40 text-rose" : "border-line-strong text-ink",
              )}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <TeamTour show={!!props.showTour} demo={props.demo} />
    </WorkspaceContext>
  );
}

/* ── Pinned Live Team Focus dock ────────────────────────────────────────── */

function useNow(interval = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, interval);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [interval]);
  return now;
}

const elapsed = (from: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
};

function FocusDock() {
  const { tasks, member, viewer, team, run, patchTask } = useWorkspace();
  const now = useNow();
  // One entry per person in focus (several people can work on one task).
  const focused = tasks
    .filter((t) => t.status === "IN_PROGRESS")
    .flatMap((t) => t.focus.map((f) => ({ task: t, ...f })))
    .sort((x, y) => x.since.localeCompare(y.since));

  return (
    <section aria-label="Live team focus" data-tour="focus" className="card mt-6 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2 text-emerald">
          <span className={cx("relative size-2 rounded-full", focused.length ? "pulse-ring bg-emerald" : "bg-ink-3")} />
        </span>
        <h2 className="text-sm font-medium">Live team focus</h2>
        <span className="font-mono text-[11px] text-ink-3">{focused.length} in focus</span>
      </div>
      <LayoutGroup>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <AnimatePresence initial={false}>
            {focused.map(({ task: t, userId, since }) => {
              const m = member(userId);
              if (!m) return null;
              const mine = userId === viewer.id;
              return (
                <motion.li
                  layout
                  key={`${t.id}:${userId}`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  className="flex w-[280px] shrink-0 items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: `${m.accentColor}12`, boxShadow: `inset 0 0 0 1px ${m.accentColor}40, 0 0 28px -10px ${m.accentColor}` }}
                >
                  <span className="relative">
                    <Monogram name={m.username} color={m.accentColor} src={m.imageUrl} size={30} />
                    <span className="absolute -right-0.5 -top-0.5 flex size-2" style={{ color: readable(m.accentColor) }}>
                      <span className="pulse-ring relative size-2 rounded-full" style={{ backgroundColor: m.accentColor }} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px]" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
                      <span className="font-mono text-[11px] tabular-nums text-ink-3">{now ? elapsed(since, now) : ""}</span>
                    </span>
                    <span className="block truncate text-[13px] text-ink">{t.title}</span>
                  </span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() =>
                        run(() => stopFocus({ teamId: team.id, itemId: t.id }), {
                          optimistic: () => patchTask(t.id, { focus: t.focus.filter((f) => f.userId !== viewer.id) }),
                        })
                      }
                      className={cx(btn.ghost, btn.xs)}
                    >
                      Pause
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {!focused.length && (
            <li className="py-2 text-[13px] text-ink-3">
              Nobody&apos;s in focus. Press <span className="text-ink-2">Start working</span> on a task assigned to you to light up here.
            </li>
          )}
        </ul>
      </LayoutGroup>
    </section>
  );
}
