"use client";

import { useState } from "react";
import { btn, cx } from "@/components/ui/primitives";

/**
 * Your @username as a button that copies it, for sharing with someone who wants
 * to invite you. Shows "Copied" in place (same width, so nothing shifts) and
 * tells screen readers too. Only ever your own username, passed in by the server.
 */
export function CopyUsername({ username, className }: { username: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy your username, ${username}`}
        className={cx(btn.outline, "h-10 shrink-0 px-3 font-mono text-[13px]", copied && "text-emerald", className)}
      >
        <span className="grid">
          <span className={cx("col-start-1 row-start-1 transition-opacity", copied && "opacity-0")}>@{username}</span>
          <span aria-hidden className={cx("col-start-1 row-start-1 text-center transition-opacity", !copied && "opacity-0")}>
            Copied
          </span>
        </span>
      </button>
      <span role="status" className="sr-only">
        {copied ? "Username copied" : ""}
      </span>
    </>
  );
}
