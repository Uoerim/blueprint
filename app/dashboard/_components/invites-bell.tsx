"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondInvite } from "@/app/actions/teams";
import { Popover } from "@/components/ui/popover";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import type { IncomingInvite } from "@/lib/types";
import { timeAgo } from "@/lib/time";

export function InviteList({ invites, compact }: { invites: IncomingInvite[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const answer = (id: string, accept: boolean) => {
    setBusy(id);
    setError(null);
    start(async () => {
      const res = await respondInvite({ inviteId: id, accept });
      setBusy(null);
      if (!res.ok) return setError(res.error);
      setGone((g) => [...g, id]);
      if (accept && res.data.slug) router.push(`/dashboard/${res.data.slug}`);
    });
  };

  const visible = invites.filter((i) => !gone.includes(i.id));
  return (
    <div>
      <ul className={cx("space-y-1", compact && "max-h-80 overflow-y-auto")}>
        <AnimatePresence initial={false}>
          {visible.map((i) => (
            <motion.li
              key={i.id}
              layout
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-white/[0.03]"
            >
              <Monogram name={i.inviter.username} color={i.inviter.accentColor} size={30} />
              <div className="min-w-0 flex-1 text-[13px] leading-snug">
                <p className="text-ink">
                  <span className="font-mono text-xs" style={{ color: readable(i.inviter.accentColor) }}>@{i.inviter.username}</span>{" "}
                  invited you to <span className="font-medium">{i.team.name}</span>
                </p>
                <p className="mono-meta mt-0.5">{timeAgo(i.createdAt)}</p>
              </div>
              <button type="button" disabled={busy === i.id} onClick={() => answer(i.id, false)} className={cx(btn.ghost, btn.xs)}>
                Decline
              </button>
              <button type="button" disabled={busy === i.id} onClick={() => answer(i.id, true)} className={cx(btn.accent, btn.xs)}>
                Accept
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!visible.length && <p className="px-2.5 py-4 text-[13px] text-ink-3">No pending invites.</p>}
      {error && <p role="alert" className="px-2.5 pt-1 text-[13px] text-rose">{error}</p>}
    </div>
  );
}

export function InvitesBell({ invites }: { invites: IncomingInvite[] }) {
  const count = invites.length;
  return (
    <Popover
      label={count ? `${count} pending invites` : "Invites"}
      align="end"
      className="w-[min(92vw,380px)]"
      triggerClassName="relative size-9 justify-center text-ink-2 hover:text-ink"
      trigger={
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 6.5a4 4 0 1 1 8 0c0 3 1.25 4.25 1.25 4.25H2.75S4 9.5 4 6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M6.5 13.25a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {count > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white">
              {count}
            </span>
          )}
        </>
      }
    >
      {() => (
        <div className="p-1">
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">Team invites</p>
          <InviteList invites={invites} compact />
        </div>
      )}
    </Popover>
  );
}
