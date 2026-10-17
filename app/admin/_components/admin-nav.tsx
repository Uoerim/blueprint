"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/primitives";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Accounts" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/reports", label: "Feedback" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-6">
      {LINKS.map((l) => {
        const on = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "relative -mb-px flex h-10 shrink-0 items-center px-3 text-sm transition-colors",
              on ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
