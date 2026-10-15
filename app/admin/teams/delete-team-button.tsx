"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDeleteTeam } from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { btn, cx } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";

export function DeleteTeamButton({ team }: { team: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast, show } = useToast();

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={cx(btn.ghost, btn.xs, "text-rose hover:text-rose")}>
        Delete
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${team.name}?`}
        description={<>Every idea, project, task, membership and invite in this team is permanently deleted for all its members.</>}
        confirmLabel="Delete team"
        level={{ kind: "type", phrase: team.name, what: "team name" }}
        onConfirm={() =>
          start(async () => {
            const res = await adminDeleteTeam({ teamId: team.id, confirm: team.name });
            if (!res.ok) return show(res.error, "error");
            show(`${team.name} was deleted.`);
            router.refresh();
          })
        }
      />
      <ToastView toast={toast} />
    </>
  );
}
