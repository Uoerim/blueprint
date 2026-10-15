"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { stopFocus } from "@/app/actions/tasks";
import { btn, cx, Kbd, Monogram, readable } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/action-types";
import type { IdeaDTO, MemberDTO, OutgoingInvite, TaskDTO, Viewer } from "@/lib/types";
import { BoardView } from "./board-view";
import { InviteDialog } from "./invite-dialog";
import { ShippedView } from "./shipped-view";
import { VaultView } from "./vault-view";

type TaskOp = { type: "patch"; id: string; patch: Partial<TaskDTO> } | { type: "add"; task: TaskDTO };
type IdeaOp = { type: "patch"; id: string; patch: Partial<IdeaDTO> } | { type: "add"; idea: IdeaDTO } | { type: "remove"; id: string };

type Ctx = {
  team: { id: string; name: string; slug: string; description: string | null };
  viewer: Viewer;
  myRole: MemberDTO["role"];
  members: MemberDTO[];
  member: (id: string | null | undefined) => MemberDTO | undefined;
  tasks: TaskDTO[];
  ideas: IdeaDTO[];
  run: <T>(fn: () => Promise<ActionResult<T>>, opts?: { optimistic?: () => void; success?: string; onOk?: (data: T) => void }) => void;
  patchTask: (id: string, patch: Partial<TaskDTO>) => void;
  addTask: (task: TaskDTO) => void;
  patchIdea: (id: string, patch: Partial<IdeaDTO>) => void;
  addIdea: (idea: IdeaDTO) => void;
  removeIdea: (id: string) => void;
  captureRef: React.RefObject<HTMLInputElement | null>;
};

const WorkspaceContext = createContext<Ctx | null>(null);
export function useWorkspace() {
  const ctx = use(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside Workspace");
  return ctx;
}

type View = "vault" | "board" | "shipped";
const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "vault", label: "Idea Vault", key: "1" },
  { id: "board", label: "Execution", key: "2" },
  { id: "shipped", label: "Shipped", key: "3" },
];

export function Workspace(props: {
  team: Ctx["team"];
  viewer: Viewer;
  myRole: MemberDTO["role"];
  members: MemberDTO[];
  ideas: IdeaDTO[];
  tasks: TaskDTO[];
  invites: OutgoingInvite[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("vault");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  const captureRef = useRef<HTMLInputElement>(null);

  const [tasks, applyTask] = useOptimistic(props.tasks, (state: TaskDTO[], op: TaskOp) =>
    op.type === "add" ? [op.task, ...state] : state.map((t) => (t.id === op.id ? { ...t, ...op.patch } : t)),
  );
  const [ideas, applyIdea] = useOptimistic(props.ideas, (state: IdeaDTO[], op: IdeaOp) => {
    if (op.type === "add") return [op.idea, ...state];
    if (op.type === "remove") return state.filter((i) => i.id !== op.id);
    return state.map((i) => (i.id === op.id ? { ...i, ...op.patch } : i));
  });

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
    members: props.members,
    member: (id) => (id ? memberMap.get(id) : undefined),
    tasks,
    ideas,
    captureRef,
    run: (fn, opts) =>
      startTransition(async () => {
        opts?.optimistic?.();
        const res = await fn();
        if (!res.ok) showToast(res.error, "error");
        else {
          if (opts?.success) showToast(opts.success);
          opts?.onOk?.(res.data);
        }
      }),
    patchTask: (id, patch) => applyTask({ type: "patch", id, patch }),
    addTask: (task) => applyTask({ type: "add", task }),
    patchIdea: (id, patch) => applyIdea({ type: "patch", id, patch }),
    addIdea: (idea) => applyIdea({ type: "add", idea }),
    removeIdea: (id) => applyIdea({ type: "remove", id }),
  };

  // Keyboard: ⌘K capture, ⌘I invite, ⌘1–3 views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setView("vault");
        window.setTimeout(() => captureRef.current?.focus(), 30);
      } else if (k === "i") {
        e.preventDefault();
        setInviteOpen(true);
      } else if (["1", "2", "3"].includes(k)) {
        e.preventDefault();
        setView(VIEWS[Number(k) - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Live" focus: refresh server state every 15s while the tab is visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !pending) router.refresh();
    }, 15_000);
    const onVis = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, pending]);

  return (
    <WorkspaceContext value={ctx}>
      <div className="mx-auto max-w-[1400px] px-3 pb-24 pt-6 sm:px-6">
        {/* Team header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{props.team.name}</h1>
            {props.team.description && (
              <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">{props.team.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex -space-x-1.5 rounded-lg p-1 transition-colors hover:bg-white/[0.05]"
              aria-label={`${props.members.length} members — manage`}
            >
              {props.members.slice(0, 5).map((m) => (
                <Monogram key={m.userId} name={m.username} color={m.accentColor} size={26} className="ring-2 ring-bg" />
              ))}
              {props.members.length > 5 && (
                <span className="grid size-[26px] place-items-center rounded-[28%] bg-surface-3 text-[11px] text-ink-2 ring-2 ring-bg">
                  +{props.members.length - 5}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setInviteOpen(true)} className={cx(btn.outline, btn.sm)}>
              Invite teammates <Kbd>⌘I</Kbd>
            </button>
          </div>
        </div>

        <FocusDock />

        {/* View switcher */}
        <div className="mt-8 flex items-center gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]" role="tablist" aria-label="Workspace views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
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

        <div className="pt-6">
          {view === "vault" && <VaultView onPromoted={() => setView("board")} />}
          {view === "board" && <BoardView />}
          {view === "shipped" && <ShippedView />}
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
                "glass pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]",
                toast.tone === "error" ? "border-rose/40 text-rose" : "border-line-strong text-ink",
              )}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
  const focused = tasks.filter((t) => t.isFocused && t.status === "IN_PROGRESS" && t.assigneeId);

  return (
    <section aria-label="Live team focus" className="card mt-6 rounded-2xl p-3 sm:p-4">
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
            {focused.map((t) => {
              const m = member(t.assigneeId);
              if (!m) return null;
              const mine = t.assigneeId === viewer.id;
              return (
                <motion.li
                  layout
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  className="flex w-[280px] shrink-0 items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: `${m.accentColor}12`, boxShadow: `inset 0 0 0 1px ${m.accentColor}40, 0 0 28px -10px ${m.accentColor}` }}
                >
                  <span className="relative">
                    <Monogram name={m.username} color={m.accentColor} size={30} />
                    <span className="absolute -right-0.5 -top-0.5 flex size-2" style={{ color: readable(m.accentColor) }}>
                      <span className="pulse-ring relative size-2 rounded-full" style={{ backgroundColor: m.accentColor }} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px]" style={{ color: readable(m.accentColor) }}>@{m.username}</span>
                      <span className="font-mono text-[11px] tabular-nums text-ink-3">{now ? elapsed(t.updatedAt, now) : ""}</span>
                    </span>
                    <span className="block truncate text-[13px] text-ink">{t.title}</span>
                  </span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() =>
                        run(() => stopFocus({ teamId: team.id, itemId: t.id }), {
                          optimistic: () => patchTask(t.id, { isFocused: false }),
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
              Nobody&apos;s in focus. Press <span className="text-ink-2">Start working</span> on a task to light up here.
            </li>
          )}
        </ul>
      </LayoutGroup>
    </section>
  );
}
