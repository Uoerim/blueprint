"use client";

import { motion } from "framer-motion";
import { Monogram, readable } from "@/components/ui/primitives";
import { clock, dayLabel } from "@/lib/time";
import { useWorkspace } from "./workspace";

type Entry =
  | { kind: "task"; at: string; id: string; title: string; who: string | null; idea: string | null }
  | { kind: "idea"; at: string; id: string; title: string; count: number };

export function ShippedView() {
  const { tasks, ideas, member } = useWorkspace();

  const done = tasks.filter((t) => t.status === "DONE" && t.completedAt);
  const stats = [
    { label: "Ideas in vault", value: ideas.filter((i) => i.status === "VAULT").length, color: "#6366F1" },
    { label: "Tasks remaining", value: tasks.filter((t) => t.status !== "DONE").length, color: "#F59E0B" },
    {
      label: "Teammates in focus",
      value: new Set(tasks.filter((t) => t.isFocused && t.status === "IN_PROGRESS").map((t) => t.assigneeId)).size,
      color: "#F43F5E",
    },
    { label: "Total shipped", value: done.length, color: "#10B981" },
  ];

  // Ideas whose every task is done count as executed, stamped at their last task.
  const executed: Entry[] = ideas
    .filter((i) => i.status === "PROMOTED" && i.taskCount > 0 && i.doneCount === i.taskCount)
    .map((i) => {
      const last = done
        .filter((t) => t.idea?.id === i.id)
        .reduce((m, t) => (t.completedAt! > m ? t.completedAt! : m), "");
      return { kind: "idea" as const, at: last || i.createdAt, id: i.id, title: i.title, count: i.taskCount };
    });

  const entries: Entry[] = [
    ...done.map((t) => ({
      kind: "task" as const,
      at: t.completedAt!,
      id: t.id,
      title: t.title,
      who: t.assigneeId,
      idea: t.idea?.title ?? null,
    })),
    ...executed,
  ].sort((a, b) => b.at.localeCompare(a.at));

  const groups = entries.reduce<{ day: string; items: Entry[] }[]>((acc, e) => {
    const day = dayLabel(e.at);
    const g = acc.at(-1);
    if (g?.day === day) g.items.push(e);
    else acc.push({ day, items: [e] });
    return acc;
  }, []);

  return (
    <div>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
            className="card rounded-2xl p-4"
          >
            <dt className="text-[13px] text-ink-2">{s.label}</dt>
            <dd className="mt-2 text-4xl font-semibold tabular-nums tracking-tight" style={{ color: readable(s.color) }}>
              {s.value}
            </dd>
          </motion.div>
        ))}
      </dl>

      <div className="mt-10">
        {!groups.length && (
          <div className="card rounded-2xl px-6 py-14 text-center">
            <p className="text-[15px] text-ink">Nothing shipped yet.</p>
            <p className="mt-1 text-sm text-ink-3">Mark a task done and it lands here, with your handle on it.</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.day} className="mb-10">
            <h2 className="sticky top-14 z-10 bg-bg/90 py-2 text-sm font-medium text-ink-2" suppressHydrationWarning>{g.day}</h2>
            <ol className="relative ml-3 space-y-1 border-l border-line pl-6">
              {g.items.map((e, i) => {
                if (e.kind === "idea") {
                  return (
                    <motion.li
                      key={`idea-${e.id}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03 }}
                      className="relative rounded-xl bg-violet/10 px-4 py-3"
                    >
                      <span className="absolute -left-[31px] top-4 size-2.5 rounded-full bg-violet ring-4 ring-bg" aria-hidden />
                      <p className="text-[14px] text-ink">
                        <span className="font-medium">Idea executed:</span> {e.title}
                      </p>
                      <p className="mono-meta mt-0.5" suppressHydrationWarning>{e.count} tasks · {clock(e.at)}</p>
                    </motion.li>
                  );
                }
                const m = member(e.who);
                return (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03 }}
                    className="relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="absolute -left-[29px] top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-emerald ring-4 ring-bg" aria-hidden />
                    {m ? <Monogram name={m.username} color={m.accentColor} size={26} /> : <span className="size-[26px] rounded-[28%] bg-surface-3" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-ink">
                        <span className="font-mono text-xs" style={{ color: readable(m?.accentColor) }}>@{m?.username ?? "someone"}</span>{" "}
                        shipped {e.title}
                      </p>
                      {e.idea && <p className="truncate text-[11px] text-ink-3">◆ {e.idea}</p>}
                    </div>
                    <span className="mono-meta shrink-0" suppressHydrationWarning>{clock(e.at)}</span>
                  </motion.li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
