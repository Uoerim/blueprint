"use client";

import { useId, useState, type ReactNode } from "react";
import { Dialog, inputCls } from "./dialog";
import { btn, cx } from "./primitives";

/**
 * How hard a destructive action is to confirm:
 * - "plain": just a confirm button (reversible things, e.g. archiving)
 * - "ack":   tick "there is no undo" first (deleting one task or idea)
 * - "type":  type the exact name first (deleting a project, a team, bulk deletes)
 */
export type ConfirmLevel = { kind: "plain" } | { kind: "ack" } | { kind: "type"; phrase: string; what: string };

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  level,
  tone = "danger",
  children,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  level: ConfirmLevel;
  tone?: "danger" | "neutral";
  /** Extra options shown above the confirmation (e.g. "also delete its tasks"). */
  children?: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open && (
        <ConfirmBody level={level} tone={tone} confirmLabel={confirmLabel} description={description} onClose={onClose} onConfirm={onConfirm}>
          {children}
        </ConfirmBody>
      )}
    </Dialog>
  );
}

function ConfirmBody({
  level,
  tone,
  confirmLabel,
  description,
  children,
  onClose,
  onConfirm,
}: {
  level: ConfirmLevel;
  tone: "danger" | "neutral";
  confirmLabel: string;
  description: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const ids = useId();
  const ready = level.kind === "plain" || (level.kind === "ack" && ack) || (level.kind === "type" && typed.trim() === level.phrase);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onClose();
        onConfirm();
      }}
      className="space-y-4"
    >
      <div className="text-[14px] leading-relaxed text-ink-2">{description}</div>
      {children}

      {level.kind === "ack" && (
        <label htmlFor={`${ids}-ack`} className="flex cursor-pointer items-start gap-3 rounded-xl bg-rose/[0.07] p-3 text-[14px] text-ink">
          <input
            id={`${ids}-ack`}
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--rose)]"
          />
          <span>I understand this is permanent and there is no undo.</span>
        </label>
      )}

      {level.kind === "type" && (
        <div>
          <label htmlFor={`${ids}-type`} className="block text-[14px] text-ink-2">
            This is permanent. Type the {level.what} <span className="font-medium text-ink">{level.phrase}</span> to confirm.
          </label>
          <input
            id={`${ids}-type`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className={cx(inputCls, "mt-1.5 h-10")}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>Cancel</button>
        <button
          type="submit"
          disabled={!ready}
          className={cx(
            tone === "danger"
              ? "inline-flex h-8 items-center justify-center rounded-lg bg-rose px-3 text-[13px] font-medium text-white transition-[filter,opacity] hover:brightness-110"
              : cx(btn.primary, btn.sm),
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
