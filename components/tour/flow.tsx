import { cx } from "@/components/ui/primitives";

const STAGES = [
  { label: "Idea", tone: "text-accent bg-accent/12" },
  { label: "Project", tone: "text-violet bg-violet/12" },
  { label: "Tasks", tone: "text-amber bg-amber/12" },
  { label: "Shipped", tone: "text-emerald bg-emerald/12" },
];

/** Blueprint's whole loop in one line, for the first card of a tour. */
export function TourFlow() {
  return (
    <ol aria-label="How work moves through Blueprint" className="mt-3 flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span className={cx("rounded-lg px-2 py-1 font-mono text-[11px]", s.tone)}>{s.label}</span>
          {i < STAGES.length - 1 && (
            <span aria-hidden className="text-ink-3">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
