"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { importIdea } from "@/app/actions/ideas";
import { Dialog, inputCls } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/constants";
import { importPrompt, parseReply } from "@/lib/import-template";
import { importPlanSchema, type ImportPlan } from "@/lib/validations";
import { useWorkspace } from "./workspace";

/**
 * "Import with AI" in the idea vault: copy a prompt, let any AI write the plan,
 * paste it back, and get a raw idea with its tasks, ready to promote.
 * The JSON is checked here as you paste (the server checks it again) and shown
 * as a preview before anything is created.
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Import an idea with AI" size="lg" description="Plan it with any AI assistant, paste what it writes, and get the idea in your vault with its tasks and subtasks.">
      {open && <ImportBody onClose={onClose} />}
    </Dialog>
  );
}

type Check = { state: "empty" } | { state: "error"; message: string } | { state: "ok"; plan: ImportPlan; dropped: string[]; projectTags: boolean; repaired: boolean };

/** "tasks.3.subtasks.1.title" → "Task 4, subtask 2, title". */
function where(path: PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const next = path[i + 1];
    if ((p === "tasks" || p === "subtasks") && typeof next === "number") {
      parts.push(`${p === "tasks" ? "Task" : "subtask"} ${next + 1}`);
      i++;
    } else if (typeof p === "string") parts.push(p);
  }
  return parts.join(", ") || "The plan";
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const { team, tags, run, openIdea } = useWorkspace();
  const [raw, setRaw] = useState("");
  const [about, setAbout] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const teamTags = tags.map((t) => t.name);

  const check: Check = useMemo(() => {
    if (!raw.trim()) return { state: "empty" };
    if (raw.length > LIMITS.importChars) {
      return { state: "error", message: `That's too big to import at once (over ${LIMITS.importChars.toLocaleString("en")} characters). Ask for fewer or shorter tasks, or import it in parts.` };
    }
    const reply = parseReply(raw);
    if (!reply.ok) return { state: "error", message: reply.message };
    const parsed = importPlanSchema.safeParse(reply.data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return { state: "error", message: `${where(issue.path)}: ${issue.message}` };
    }
    const known = new Set(teamTags);
    const all = parsed.data.tasks.flatMap((t) => t.tags).map((t) => t.trim().toLowerCase().replace(/^#/, ""));
    const dropped = [...new Set(all.filter((t) => t && !known.has(t)))];
    return { state: "ok", plan: parsed.data, dropped, projectTags: (parsed.data.tags?.length ?? 0) > 0, repaired: reply.repaired };
  }, [raw, teamTags]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(importPrompt(teamTags, about));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const create = () => {
    if (check.state !== "ok" || pending) return;
    setPending(true);
    const count = check.plan.tasks.length;
    run(() => importIdea({ teamId: team.id, plan: check.plan }), {
      success: count ? `Idea imported with ${count} task${count === 1 ? "" : "s"}.` : "Idea imported.",
      onOk: (data) => {
        onClose();
        openIdea(data.id);
      },
    });
    // The toast reports a failure; let them fix the JSON and try again.
    window.setTimeout(() => setPending(false), 1500);
  };

  const subtaskCount = check.state === "ok" ? check.plan.tasks.reduce((n, t) => n + t.subtasks.length, 0) : 0;

  return (
    <div className="space-y-5">
      <Step n={1} title="Describe it and copy the prompt">
        <p className="text-[13px] leading-relaxed text-ink-3">
          Write a few lines about the idea (or add them in the assistant later). The prompt already explains Blueprint&apos;s format, the limits
          {teamTags.length ? " and your team's tags" : ""}, so you can paste it straight into ChatGPT, Claude, Gemini or any other assistant.
        </p>
        <label htmlFor="import-about" className="sr-only">
          Describe your idea
        </label>
        <textarea
          id="import-about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. A beta of our music app for 50 friends by the end of the month: build, demo video, invites, feedback form."
          className={cx(inputCls, "mt-3 resize-y py-2.5 leading-relaxed")}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <motion.button type="button" onClick={copy} whileTap={{ scale: 0.96 }} className={cx(btn.primary, btn.sm, "min-w-32")} aria-live="polite">
            {copied ? "Copied ✓" : "Copy prompt"}
          </motion.button>
          <button type="button" onClick={() => setPreview((v) => !v)} aria-expanded={preview} className={cx(btn.ghost, btn.sm)}>
            {preview ? "Hide the prompt" : "See the prompt"}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {preview && (
            <motion.pre
              key="prompt"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-ink-2"
            >
              {importPrompt(teamTags, about)}
            </motion.pre>
          )}
        </AnimatePresence>
      </Step>

      <Step n={2} title="Paste the JSON it writes back">
        <label htmlFor="import-json" className="sr-only">
          The plan as JSON
        </label>
        <textarea
          id="import-json"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder='{ "title": "…", "tasks": [ … ] }'
          className={cx(inputCls, "resize-y py-2.5 font-mono text-[12.5px] leading-relaxed")}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[12px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={check.state === "error" ? check.message : check.state}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              role={check.state === "error" ? "alert" : undefined}
              className={check.state === "error" ? "text-rose" : check.state === "ok" ? "text-emerald" : "text-ink-3"}
            >
              {check.state === "error" ? check.message : check.state === "ok" ? (check.repaired ? "Looks good. We fixed a few small JSON slips from the AI." : "Looks good.") : "Nothing is added until you press Add to the vault."}
            </motion.span>
          </AnimatePresence>
          <span className="shrink-0 font-mono tabular-nums text-ink-3">{raw.length.toLocaleString("en")}</span>
        </div>
      </Step>

      <AnimatePresence initial={false}>
        {check.state === "ok" && (
          <motion.section
            key="preview"
            aria-label="Preview"
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-surface-2 p-4 shadow-highlight">
              <p className="flex items-start gap-2 text-[15px] font-medium text-ink">
                <span className="mt-0.5 text-amber" aria-hidden>✦</span>
                <span className="min-w-0">{check.plan.title}</span>
              </p>
              {check.plan.description && <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{check.plan.description}</p>}
              <p className="mt-2 font-mono text-[11px] text-ink-3">
                {check.plan.tasks.length} task{check.plan.tasks.length === 1 ? "" : "s"} · {subtaskCount} subtask{subtaskCount === 1 ? "" : "s"}
              </p>
              {check.plan.tasks.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {check.plan.tasks.slice(0, 6).map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                      <span className="size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-ink">{t.title}</span>
                      {t.subtasks.length > 0 && <span className="shrink-0 font-mono text-[11px] text-ink-3">{t.subtasks.length} sub</span>}
                    </li>
                  ))}
                  {check.plan.tasks.length > 6 && <li className="pl-3.5 text-[12px] text-ink-3">and {check.plan.tasks.length - 6} more</li>}
                </ul>
              )}
              {check.projectTags && <p className="mt-3 text-[12px] text-ink-3">Tags go on tasks, so the idea&apos;s own tags are left off.</p>}
              {check.dropped.length > 0 && (
                <p className="mt-3 text-[12px] text-amber">
                  These tags aren&apos;t in your team, so they&apos;ll be left off: {check.dropped.map((t) => `#${t}`).join(", ")}
                </p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={cx(btn.ghost, btn.sm)}>
          Cancel
        </button>
        <button type="button" onClick={create} disabled={check.state !== "ok" || pending} className={cx(btn.primary, btn.sm, "disabled:opacity-40")}>
          {pending ? "Adding…" : "Add to the vault"}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[12px] text-accent" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-medium text-ink">{title}</h3>
        <div className="mt-1">{children}</div>
      </div>
    </section>
  );
}
