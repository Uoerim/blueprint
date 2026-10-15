import { cx } from "@/components/ui/primitives";

/** Plain outbound link (no third-party widget script, so the CSP stays strict). */
export function CoffeeButton({ href, className, label = "Buy me a coffee" }: { href: string; className?: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-lg bg-[#FFDD00] px-3.5 text-[13px] font-semibold text-[#1a1a1a] transition-[transform,filter] hover:brightness-95 active:scale-[0.97]",
        className,
      )}
    >
      <CupIcon />
      {label}
    </a>
  );
}

function CupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 6h8v4.5A2.5 2.5 0 0 1 8.5 13h-3A2.5 2.5 0 0 1 3 10.5V6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11 7h.75a1.75 1.75 0 0 1 0 3.5H11" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 2.5c0 .8.8.8.8 1.6M8 2.5c0 .8.8.8.8 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
