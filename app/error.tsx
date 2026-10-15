"use client";

import Link from "next/link";
import { btn } from "@/components/ui/primitives";

// Never render error.message: it can carry server details.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-start justify-center px-4">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Something broke.</h1>
      <p className="mt-3 text-[15px] text-ink-2">It&apos;s on our side, not yours. Try again, or head back.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className={btn.primary}>Try again</button>
        <Link href="/dashboard" className={btn.ghost}>Dashboard</Link>
      </div>
    </div>
  );
}
