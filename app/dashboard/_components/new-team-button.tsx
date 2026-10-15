"use client";

import { useState } from "react";
import { btn, cx } from "@/components/ui/primitives";
import { CreateTeamDialog } from "./create-team-dialog";

export function NewTeamButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(btn.primary, "h-11 px-5")}>
        + Create new team
      </button>
      <CreateTeamDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
