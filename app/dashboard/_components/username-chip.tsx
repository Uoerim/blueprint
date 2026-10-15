"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { refreshAvatar } from "@/app/actions/onboarding";
import { cx, readable } from "@/components/ui/primitives";

/**
 * Your @username in the header. Click to copy it, so it's easy to share with
 * someone who wants to invite you. Also keeps your stored profile picture in
 * step with Clerk when you change it.
 */
export function UsernameChip({ username, color, imageUrl }: { username: string; color: string; imageUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const { user } = useUser();
  const synced = useRef(false);

  // When the picture in Clerk differs from ours, ask the server to re-read it from Clerk (it never trusts this value).
  const clerkImage = user ? (user.hasImage ? user.imageUrl : null) : undefined;
  useEffect(() => {
    if (clerkImage === undefined || synced.current || clerkImage === imageUrl) return;
    synced.current = true;
    void refreshAvatar();
  }, [clerkImage, imageUrl]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy your username"
      aria-label={`Copy your username, ${username}`}
      className={cx(
        "hidden h-8 items-center rounded-lg px-2.5 font-mono text-xs transition-colors hover:bg-tint/[0.06] active:scale-[0.97] sm:inline-flex",
      )}
      style={{ color: readable(color) }}
    >
      {/* Both labels share one grid cell, so the chip keeps the username's width and nothing beside it moves. */}
      <span className="grid">
        <span className={cx("col-start-1 row-start-1 transition-opacity", copied && "opacity-0")}>@{username}</span>
        <span aria-hidden className={cx("col-start-1 row-start-1 text-center text-emerald transition-opacity", !copied && "opacity-0")}>
          Copied!
        </span>
      </span>
      <span className="sr-only" aria-live="polite">{copied ? "Username copied" : ""}</span>
    </button>
  );
}
