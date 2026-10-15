import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/primitives";

export const LEGAL_EMAIL = "support@raqameen.com";
export const LEGAL_UPDATED = "15 October 2026";

/** Shared frame for /privacy and /terms: plain reading layout, no app chrome. */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-md text-ink transition-opacity hover:opacity-80">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">Blueprint</span>
        </Link>
        <nav className="flex gap-5 text-sm text-ink-3">
          <Link href="/privacy" className="transition-colors hover:text-ink">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-ink">Terms</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-[clamp(1.9rem,4.5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.035em]">{title}</h1>
        <p className="mt-3 text-[14px] text-ink-3">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 text-[17px] leading-[1.65] text-ink-2">{intro}</div>
        <div className="mt-10 space-y-10">{children}</div>
        <p className="mt-14 border-t border-line pt-6 text-[15px] text-ink-2">
          Questions? Email <Mail />.
        </p>
      </main>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-8">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-[1.7] text-ink-2 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${LEGAL_EMAIL}`} className="text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink">
      {LEGAL_EMAIL}
    </a>
  );
}
