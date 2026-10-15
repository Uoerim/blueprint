"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { cx } from "./primitives";

type Toast = { id: number; text: string; tone: "ok" | "error" };

/** A single bottom-centre toast: `show("Saved")` or `show("Failed", "error")`. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.tone === "error" ? 4200 : 2400);
    return () => window.clearTimeout(t);
  }, [toast]);
  const show = useCallback((text: string, tone: Toast["tone"] = "ok") => setToast({ id: Date.now(), text, tone }), []);
  return { toast, show };
}

export function ToastView({ toast }: { toast: Toast | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            className={cx(
              "glass-solid pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]",
              toast.tone === "error" ? "border-rose/40 text-rose" : "border-line-strong text-ink",
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
