import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, Monogram, readable } from "@/components/ui/primitives";
import { requireStaffPage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/site-roles";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Blueprint" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireStaffPage();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-3 sm:px-6">
          <Link href="/dashboard" aria-label="Back to the dashboard" className="grid size-8 place-items-center rounded-md text-ink transition-colors hover:bg-tint/[0.06]">
            <BrandMark size={20} />
          </Link>
          <span className="text-ink-3" aria-hidden>/</span>
          <span className="text-[14px] font-semibold tracking-tight">Admin</span>
          <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[11px] font-medium text-amber">{ROLE_LABEL[me.siteRole]}</span>
          <span className="ml-auto flex items-center gap-2">
            <Monogram name={me.username!} color={me.accentColor} size={22} />
            <span className="hidden font-mono text-xs sm:inline" style={{ color: readable(me.accentColor) }}>@{me.username}</span>
          </span>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-3 pb-24 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
