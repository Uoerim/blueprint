"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { getActivity } from "@/app/actions/activity";
import { ClaudeMark } from "@/components/claude-mark";
import { btn, cx } from "@/components/ui/primitives";
import type { ActivityItem } from "@/lib/activity-log";
import { timeAgo } from "@/lib/time";

/** A team's, project's or task's activity, newest first, with Claude's changes marked. */
export function ActivityFeed({ teamId, ideaId, taskId, filter }: { teamId: string; ideaId?: string; taskId?: string; filter?: boolean }) {
  const [claudeOnly, setClaudeOnly] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      const res = await getActivity({ teamId, ideaId, taskId, claudeOnly, before });
      setLoading(false);
      if (!res.ok) return setError(res.error);
      setError(null);
      setMore(res.data.more);
      setItems((prev) => (before && prev ? [...prev, ...res.data.items] : res.data.items));
    },
    [teamId, ideaId, taskId, claudeOnly],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div>
      {filter && (
        <div role="radiogroup" aria-label="Show" className="mb-3 inline-flex rounded-lg bg-surface-2 p-0.5 text-[12px] shadow-highlight">
          {[false, true].map((c) => (
            <button
              key={String(c)}
              type="button"
              role="radio"
              aria-checked={claudeOnly === c}
              onClick={() => setClaudeOnly(c)}
              className={cx("h-7 rounded-md px-2.5 transition-colors", claudeOnly === c ? "bg-surface text-ink shadow-highlight" : "text-ink-3 hover:text-ink-2")}
            >
              {c ? "By Claude" : "Everything"}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[13px] text-rose">{error}</p>}
      {items === null && !error && <div className="h-16 animate-pulse rounded-xl bg-surface-2" />}
      {items?.length === 0 && <p className="text-[13px] text-ink-3">{claudeOnly ? "Claude hasn't done anything here yet." : "Nothing recorded yet."}</p>}
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {items?.map((i) => (
            <motion.li
              key={i.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-snug hover:bg-tint/[0.03]"
            >
              <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", i.via ? "bg-accent" : "bg-ink-3")} aria-hidden />
              <span className="min-w-0 flex-1 text-ink-2">
                <span className="font-mono text-[12px] text-ink">@{i.actor}</span>{" "}
                {i.via && <ClaudeMark kind="worked" compact className="mr-1 align-middle" />}
                {i.verb}
                {i.target && <> <span className="text-ink">&ldquo;{i.target}&rdquo;</span></>}
                {i.context && <span className="text-ink-3"> · {i.context}</span>}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-ink-3" suppressHydrationWarning>{timeAgo(i.at)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {more && (
        <button type="button" disabled={loading} onClick={() => void load(items?.at(-1)?.at)} className={cx(btn.ghost, btn.sm, "mt-2 disabled:opacity-50")}>
          {loading ? "Loading…" : "Show older"}
        </button>
      )}
    </div>
  );
}
