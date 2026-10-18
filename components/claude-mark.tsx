import { cx } from "@/components/ui/primitives";

/*
 * The "by Claude" marks. They come from fields the database won't let anyone
 * change ("made by Claude" can never be removed; once Claude has worked on a
 * task that stays too), so the label can always be trusted.
 */

export type ClaudeMarkKind = "made" | "finished" | "worked" | "added" | "ticked" | "addedTicked";

const LABEL: Record<ClaudeMarkKind, string> = {
  made: "Made by Claude",
  finished: "Finished by Claude",
  worked: "Claude worked on this",
  added: "Added by Claude",
  ticked: "Ticked by Claude",
  addedTicked: "Added and ticked by Claude",
};

export function ClaudeGlyph({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}

/** A small pill ("Made by Claude"), or just the glyph and "Claude" when compact. */
export function ClaudeMark({ kind, compact, iconOnly, className }: { kind: ClaudeMarkKind; compact?: boolean; iconOnly?: boolean; className?: string }) {
  const label = LABEL[kind];
  if (iconOnly) {
    return (
      <span title={label} aria-label={label} role="img" className={cx("inline-grid size-4 shrink-0 place-items-center rounded-[5px] bg-accent/14 text-accent", className)}>
        <ClaudeGlyph size={9} />
      </span>
    );
  }
  return (
    <span
      title={label}
      className={cx("inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-accent/12 px-1.5 text-[10.5px] font-medium text-accent", className)}
    >
      <ClaudeGlyph />
      {compact ? <><span aria-hidden>Claude</span><span className="sr-only">{label}</span></> : label}
    </span>
  );
}

/** The one mark a task card shows: finished, else made, else worked on. */
export function taskMark(t: { status: string; createdVia: string | null; completedVia: string | null; claudeAt: string | null }): ClaudeMarkKind | null {
  if (t.status === "DONE" && t.completedVia === "claude") return "finished";
  if (t.createdVia === "claude") return "made";
  if (t.claudeAt) return "worked";
  return null;
}

/** Every mark that applies, for the task's own view. */
export function taskMarks(t: { status: string; createdVia: string | null; completedVia: string | null; claudeAt: string | null }): ClaudeMarkKind[] {
  const out: ClaudeMarkKind[] = [];
  if (t.createdVia === "claude") out.push("made");
  if (t.status === "DONE" && t.completedVia === "claude") out.push("finished");
  if (t.claudeAt && !out.length) out.push("worked");
  return out;
}
