"use client";

import { useEffect, useState } from "react";
import { finishTour } from "@/app/actions/account";
import type { TourId } from "@/lib/tours";
import { Tour, type TourStep } from "./tour";

// Tours finished in this tab. Screens are cached for a short while, so their
// server-rendered "show the tour" flag can be stale; this keeps it from coming back.
const finished = new Set<TourId>();

/** Called by "Take the tour", so replayed tours can show again in this tab. */
export function resetTourMemory() {
  finished.clear();
}

/**
 * Shows a guided tour once, when the server says this person hasn't done it.
 * Finishing or skipping both count as done and are saved to their account.
 */
export function TourLauncher({
  tour,
  show,
  steps,
  label,
  finishLabel,
  onDone,
}: {
  tour: TourId;
  show: boolean;
  steps: TourStep[];
  label: string;
  finishLabel?: string;
  onDone?: (finished: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show || finished.has(tour)) return;
    // Let the page settle (and its entrance animations finish) before starting.
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [show, tour]);

  if (!open) return null;
  return (
    <Tour
      steps={steps}
      label={label}
      finishLabel={finishLabel}
      onClose={(done) => {
        finished.add(tour);
        setOpen(false);
        void finishTour({ tour });
        onDone?.(done);
      }}
    />
  );
}
