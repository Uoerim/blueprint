import Link from "next/link";
import { btn } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-start justify-center px-4">
      <p className="font-mono text-xs text-ink-3">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Nothing here.</h1>
      <p className="mt-3 text-[15px] text-ink-2">The page doesn&apos;t exist, or it belongs to a team you&apos;re not on.</p>
      <Link href="/dashboard" className={`${btn.primary} mt-6`}>Back to dashboard</Link>
    </div>
  );
}
