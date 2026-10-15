import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/primitives";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="bg-architect pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
      <div aria-hidden className="mesh pointer-events-none absolute inset-0" />
      <header className="relative px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-md text-ink transition-opacity hover:opacity-80">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">Idea Vault</span>
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-20">{children}</main>
    </div>
  );
}
