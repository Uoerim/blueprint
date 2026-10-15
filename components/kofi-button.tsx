"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cx } from "@/components/ui/primitives";

export const KOFI_URL = "https://ko-fi.com/yosifibrahim";
// Ko-fi's own embed. Allowed by `frame-src` in proxy.ts.
const KOFI_EMBED = `${KOFI_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;

/** Opens the Ko-fi donation panel in a dialog, with a plain link as fallback. */
export function KofiButton({ className, label = "Support on Ko-fi" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cx(
          "inline-flex h-9 items-center gap-2 rounded-lg bg-[#FF5E5B] px-3.5 text-[13px] font-semibold text-[#1a1a1a] transition-[transform,filter] hover:brightness-95 active:scale-[0.97]",
          className,
        )}
      >
        <CupIcon />
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Support Blueprint"
        description="Blueprint is free with no limits. Tips keep it running."
        className="max-h-[84vh] max-w-md"
      >
        <iframe
          id="kofiframe"
          src={KOFI_EMBED}
          title="yosifibrahim on Ko-fi"
          height={712}
          allow="payment"
          className="block w-full rounded-xl border-none bg-[#f9f9f9] p-1"
        />
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-[13px] text-ink-3 underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          Not loading? Open Ko-fi in a new tab
        </a>
      </Dialog>
    </>
  );
}

function CupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4.5h9v5A3 3 0 0 1 8.5 12.5h-3a3 3 0 0 1-3-3v-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.5 5.5h.75a1.75 1.75 0 0 1 0 3.5h-.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 10.2 5.3 8.6a1 1 0 0 1 1.5-1.3l.2.2.2-.2a1 1 0 0 1 1.5 1.3L7 10.2Z" fill="currentColor" />
    </svg>
  );
}
