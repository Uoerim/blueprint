"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { resolveBugReport } from "@/app/actions/admin";
import { btn, cx } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";

/** Marks a report resolved, or reopens it. The server re-checks the staff permission. */
export function ResolveButton({ reportId, resolved }: { reportId: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { toast, show } = useToast();

  const toggle = () =>
    start(async () => {
      const res = await resolveBugReport({ reportId, resolved: !resolved });
      if (!res.ok) return show(res.error, "error");
      show(resolved ? "Reopened." : "Marked as resolved.");
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cx(resolved ? btn.ghost : btn.outline, btn.sm, "disabled:opacity-40")}
      >
        {resolved ? "Reopen" : "Mark resolved"}
      </button>
      <ToastView toast={toast} />
    </>
  );
}
