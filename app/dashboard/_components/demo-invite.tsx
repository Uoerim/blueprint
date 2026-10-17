"use client";

import { AnimatePresence, motion } from "framer-motion";
import { btn, cx } from "@/components/ui/primitives";
import { useTourDemo } from "@/lib/tour-demo";

/**
 * The welcome tour's sample invite, for people who already have teams (so the
 * dashboard has no Invites section to point at). On screen only, never saved,
 * clearly marked as an example, and gone when the step ends.
 */
export function DemoInvite() {
  const on = useTourDemo("invite");
  return (
    <AnimatePresence initial={false}>
      {on && (
        <motion.section
          key="demo-invite"
          data-tour="invites"
          aria-hidden
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="pt-8">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink-2">
              Invites <span className="font-mono text-[11px] text-ink-3">1</span>
              <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber">Example</span>
            </h2>
            <div className="card mt-2 flex items-center gap-3 rounded-2xl p-3 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--amber)_45%,transparent)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-[28%] bg-accent/15 font-mono text-[12px] text-accent">MA</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink">
                  <span className="font-mono text-pink-400">@maya_example</span> invited you to <span className="font-medium">Demo team</span>
                </span>
                <span className="block font-mono text-[11px] text-ink-3">just now</span>
              </span>
              <span className={cx(btn.ghost, btn.sm, "pointer-events-none")}>Decline</span>
              <span className={cx(btn.primary, btn.sm, "pointer-events-none")}>Accept</span>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
