"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRejectedReport, purgeRejectedReports, setReportStatus } from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { btn, cx } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";

type Status = "OPEN" | "RESOLVED" | "REJECTED";

const DONE: Record<Status, string> = { OPEN: "Reopened.", RESOLVED: "Marked as resolved.", REJECTED: "Rejected." };

/**
 * What staff can do with one piece of feedback: resolve or reject it while
 * it's open, reopen it afterwards, and (moderators and above) delete it for
 * good once it's rejected. The server re-checks every permission.
 */
export function ReportActions({ reportId, status, canDelete }: { reportId: string; status: Status; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const { toast, show } = useToast();

  const move = (next: Status) =>
    start(async () => {
      const res = await setReportStatus({ reportId, status: next });
      if (!res.ok) return show(res.error, "error");
      show(DONE[next]);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await deleteRejectedReport({ reportId });
      if (!res.ok) return show(res.error, "error");
      show("Deleted.");
      router.refresh();
    });

  return (
    <>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.16 }}
          className={cx("flex flex-wrap items-center gap-1.5", pending && "pointer-events-none opacity-50")}
        >
          {status === "OPEN" ? (
            <>
              <button type="button" onClick={() => move("RESOLVED")} className={cx(btn.outline, btn.sm)}>
                Mark resolved
              </button>
              <button type="button" onClick={() => move("REJECTED")} className={cx(btn.ghost, btn.sm, "text-ink-2")}>
                Reject
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => move("OPEN")} className={cx(btn.ghost, btn.sm)}>
                Reopen
              </button>
              {status === "REJECTED" && canDelete && (
                <button type="button" onClick={() => setConfirming(true)} className={cx(btn.ghost, btn.sm, "text-rose hover:text-rose")}>
                  Delete
                </button>
              )}
            </>
          )}
        </motion.span>
      </AnimatePresence>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this feedback?"
        description="It's removed for good, text and all. The audit log keeps a note that it was deleted."
        confirmLabel="Delete"
        level={{ kind: "plain" }}
        onConfirm={remove}
      />
      <ToastView toast={toast} />
    </>
  );
}

/** "Delete all rejected": clears the rejected pile in one go, after typing a confirmation. */
export function PurgeRejected({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast, show } = useToast();
  if (!count) return null;

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={cx(btn.outline, btn.sm, "text-rose hover:text-rose disabled:opacity-40")}>
        Delete all rejected ({count})
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${count} rejected item${count === 1 ? "" : "s"}?`}
        description="Every rejected bug report and feature request is removed for good. Open and resolved feedback isn't touched."
        confirmLabel="Delete all rejected"
        level={{ kind: "type", phrase: "delete rejected", what: "phrase" }}
        onConfirm={() =>
          start(async () => {
            const res = await purgeRejectedReports();
            if (!res.ok) return show(res.error, "error");
            show(res.data.count ? `Deleted ${res.data.count}.` : "Nothing left to delete.");
            router.refresh();
          })
        }
      />
      <ToastView toast={toast} />
    </>
  );
}
