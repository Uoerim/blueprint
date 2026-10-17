"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectApp } from "@/app/actions/connect";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { btn, cx } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/time";

export function CopyField({ value, small }: { value: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={cx("mt-2 flex items-center gap-2 rounded-xl bg-surface-2 p-1.5 pl-3 shadow-highlight", small && "bg-surface")}>
      <code className={cx("min-w-0 flex-1 truncate font-mono text-ink", small ? "text-[12px]" : "text-[13.5px]")} title={value}>
        {value}
      </code>
      <motion.button type="button" onClick={copy} whileTap={{ scale: 0.94 }} className={cx(btn.outline, btn.sm, "shrink-0")} aria-live="polite">
        {copied ? "Copied ✓" : "Copy"}
      </motion.button>
    </div>
  );
}

type Connection = { id: string; app: string; detail: string; scopes: string[]; teams: string[]; createdAt: string; lastUsedAt: string | null };

export function ConnectionList({ connections }: { connections: Connection[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Connection | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const { toast, show } = useToast();
  const shown = connections.filter((c) => !gone.includes(c.id));

  const disconnect = (c: Connection) =>
    start(async () => {
      const res = await disconnectApp({ grantId: c.id });
      if (!res.ok) return show(res.error, "error");
      setGone((g) => [...g, c.id]);
      show(`${c.app} was disconnected.`);
      router.refresh();
    });

  return (
    <>
      {shown.length === 0 && (
        <p className="mt-3 rounded-2xl bg-surface px-4 py-6 text-center text-[14px] text-ink-3 shadow-highlight">
          Nothing connected yet. Add Blueprint to Claude with the address above.
        </p>
      )}
      <ul className="mt-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {shown.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              className="card rounded-2xl p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">{c.app}</p>
                  <p className="text-[12px] text-ink-3">
                    &ldquo;{c.detail}&rdquo; · connected {timeAgo(c.createdAt)}
                    {c.lastUsedAt ? ` · last used ${timeAgo(c.lastUsedAt)}` : " · not used yet"}
                  </p>
                </div>
                <button type="button" disabled={pending} onClick={() => setConfirm(c)} className={cx(btn.outline, btn.sm, "text-rose hover:text-rose disabled:opacity-40")}>
                  Disconnect
                </button>
              </div>
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <p className="text-[12px] font-medium text-ink-3">Teams</p>
                  <p className="mt-0.5 text-ink-2">{c.teams.length ? c.teams.join(", ") : "None right now (a team was switched off or you left it)"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-ink-3">May</p>
                  <ul className="mt-0.5 space-y-0.5 text-ink-2">
                    {c.scopes.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Disconnect ${confirm?.app ?? "Claude"}?`}
        description="It loses access to Blueprint immediately. You can connect it again any time."
        confirmLabel="Disconnect"
        level={{ kind: "plain" }}
        onConfirm={() => confirm && disconnect(confirm)}
      />
      <ToastView toast={toast} />
    </>
  );
}
