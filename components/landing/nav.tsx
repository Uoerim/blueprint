import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BrandMark, btn, cx } from "@/components/ui/primitives";

const LINKS = [
  { href: "#tour", label: "What it does" },
  { href: "#projects", label: "Projects" },
];

export function LandingNav() {
  return (
    <header className="glass sticky top-0 z-40">
      <nav className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 rounded-md text-ink transition-opacity hover:opacity-80">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">Blueprint</span>
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-md px-2.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-tint/[0.05] hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton>
              <button type="button" className={cx(btn.ghost, btn.sm)}>Sign in</button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/onboarding">
              <button type="button" className={cx(btn.primary, btn.sm)}>Get started</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className={cx(btn.primary, btn.sm)}>Go to dashboard →</Link>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
