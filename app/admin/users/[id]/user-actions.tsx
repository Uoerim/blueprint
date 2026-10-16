"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { deleteUser, renameUser, setSiteRole, signOutEverywhere, suspendUser, unsuspendUser } from "@/app/actions/admin";
import { ConfirmDialog, type ConfirmLevel } from "@/components/ui/confirm-dialog";
import { inputCls } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";
import { ToastView, useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-types";
import { ROLE_LABEL, ROLE_NOTE, SITE_ROLES, type SiteRole } from "@/lib/site-roles";

type Ask = { title: string; description: ReactNode; confirmLabel: string; level: ConfirmLevel; tone?: "danger" | "neutral"; run: () => void };

export function UserActions({
  user,
  perms,
  isMe,
}: {
  user: { id: string; username: string | null; siteRole: SiteRole; banned: boolean; deleted: boolean };
  perms: { suspend: boolean; signout: boolean; role: boolean; delete: boolean; rename: boolean };
  isMe: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { toast, show } = useToast();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [role, setRole] = useState<SiteRole>(user.siteRole);
  const [reason, setReason] = useState("");
  const [newName, setNewName] = useState(user.username ?? "");
  const name = user.username ? `@${user.username}` : "this account";
  const nameValid = USERNAME.test(newName);
  const nameChanged = newName !== user.username;

  const run = <T,>(fn: () => Promise<ActionResult<T>>, ok: string, after?: (data: T) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return show(res.error, "error");
      show(ok);
      after?.(res.data);
      router.refresh();
    });

  const clerkNote = (d: { clerk: boolean }) => {
    if (!d.clerk) show("Saved, but Clerk didn't confirm. The app still enforces it.", "error");
  };

  const overlays = (
    <>
      <ConfirmDialog
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.title ?? ""}
        description={ask?.description}
        confirmLabel={ask?.confirmLabel ?? ""}
        level={ask?.level ?? { kind: "plain" }}
        tone={ask?.tone}
        onConfirm={() => ask?.run()}
      />
      <ToastView toast={toast} />
    </>
  );

  const renamePanel = perms.rename && (
    <Panel title="Username">
      <label htmlFor="new-username" className="block text-[13px] text-ink-2">
        New username
      </label>
      <div className="field mt-1.5 flex h-10 items-center rounded-lg px-3">
        <span className="font-mono text-[14px] text-ink-3">@</span>
        <input
          id="new-username"
          value={newName}
          onChange={(e) => setNewName(normalize(e.target.value))}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          className="h-full flex-1 bg-transparent font-mono text-[14px] text-ink outline-none"
        />
      </div>
      <p className={cx("mt-1.5 text-[12px]", newName && !nameValid ? "text-rose" : "text-ink-3")}>
        3 to 20 characters: a to z, 0 to 9 and _. Reserved names and names already in use are refused.
      </p>
      <button
        type="button"
        disabled={pending || !nameValid || !nameChanged}
        onClick={() =>
          setAsk({
            title: `Change ${name} to @${newName}?`,
            description: (
              <>
                {isMe ? "Your" : "Their"} old username becomes free for anyone to claim. Teammates see the new name right away;
                teams, invites and history aren&apos;t affected.
              </>
            ),
            confirmLabel: "Change username",
            tone: "neutral",
            level: { kind: "plain" },
            run: () => run(() => renameUser({ userId: user.id, username: newName }), `Username changed to @${newName}.`),
          })
        }
        className={cx(btn.primary, btn.sm, "mt-3 disabled:opacity-40")}
      >
        Change username
      </button>
    </Panel>
  );

  if (user.deleted) {
    return <Panel title="Actions"><p className="text-[13px] text-ink-3">This account was deleted. There is nothing left to manage.</p></Panel>;
  }
  if (isMe) {
    return (
      <div className="space-y-4">
        {renamePanel}
        <Panel title="Actions">
          <p className="text-[13px] leading-relaxed text-ink-2">
            You can&apos;t change your own role, suspend or delete yourself from the panel. Use the CLI instead:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[12px] text-ink">npm run site:role -- {user.username ?? "username"} USER</pre>
        </Panel>
        {overlays}
      </div>
    );
  }
  if (!perms.suspend && !perms.signout && !perms.role && !perms.delete && !perms.rename) {
    return (
      <Panel title="Actions">
        <p className="text-[13px] text-ink-3">Your role can view this account but not change it.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {renamePanel}
      {perms.role && (
        <Panel title="Site role">
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Site role</legend>
            {SITE_ROLES.map((r) => (
              <label key={r} className={cx("flex cursor-pointer items-start gap-3 rounded-xl p-2.5 transition-colors", role === r ? "bg-surface-2" : "hover:bg-tint/[0.03]")}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block text-[14px] font-medium text-ink">{ROLE_LABEL[r]}</span>
                  <span className="block text-[12px] text-ink-3">{ROLE_NOTE[r]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={role === user.siteRole || pending}
            onClick={() =>
              setAsk({
                title: `Make ${name} ${ROLE_LABEL[role]}?`,
                description: <>{ROLE_NOTE[role]}</>,
                confirmLabel: "Change role",
                tone: "neutral",
                level: role === "ADMIN" ? { kind: "type", phrase: user.username ?? "", what: "username" } : { kind: "plain" },
                run: () => run(() => setSiteRole({ userId: user.id, role }), `${name} is now ${ROLE_LABEL[role]}.`),
              })
            }
            className={cx(btn.primary, btn.sm, "mt-3 disabled:opacity-40")}
          >
            Save role
          </button>
        </Panel>
      )}

      {(perms.suspend || perms.signout) && (
        <Panel title="Access">
          {perms.suspend &&
            (user.banned ? (
              <Row note="Lets them sign in and use Blueprint again.">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setAsk({
                      title: `Unsuspend ${name}?`,
                      description: <>They can sign in again straight away.</>,
                      confirmLabel: "Unsuspend",
                      tone: "neutral",
                      level: { kind: "plain" },
                      run: () => run(() => unsuspendUser({ userId: user.id }), `${name} is active again.`, clerkNote),
                    })
                  }
                  className={cx(btn.outline, btn.sm)}
                >
                  Unsuspend
                </button>
              </Row>
            ) : (
              <div>
                <label htmlFor="ban-reason" className="block text-[13px] text-ink-2">Reason (shown to them)</label>
                <textarea
                  id="ban-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="e.g. Spam invites to other users"
                  className={cx(inputCls, "mt-1.5 resize-y py-2")}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setAsk({
                      title: `Suspend ${name}?`,
                      description: <>They are signed out everywhere and can&apos;t sign in or use the API until unsuspended. Their teams keep working.</>,
                      confirmLabel: "Suspend account",
                      level: { kind: "ack" },
                      run: () => run(() => suspendUser({ userId: user.id, reason }), `${name} is suspended.`, clerkNote),
                    })
                  }
                  className={cx(btn.outline, btn.sm, "mt-2 text-rose hover:text-rose")}
                >
                  Suspend account
                </button>
              </div>
            ))}
          {perms.signout && (
            <Row note="Ends every active session. They can sign in again.">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => signOutEverywhere({ userId: user.id }), `${name} was signed out everywhere.`)}
                className={cx(btn.outline, btn.sm)}
              >
                Sign out everywhere
              </button>
            </Row>
          )}
        </Panel>
      )}

      {perms.delete && (
        <Panel title="Delete account" danger>
          <p className="text-[13px] leading-relaxed text-ink-2">
            Removes their login, team memberships and invites. Teams they own pass to the next admin or member, or are deleted if they were alone. Shared ideas and tasks stay, without their name.
          </p>
          <button
            type="button"
            disabled={pending || !user.username}
            onClick={() =>
              setAsk({
                title: `Delete ${name}?`,
                description: <>This permanently deletes the account and signs them out. It can&apos;t be undone.</>,
                confirmLabel: "Delete account",
                level: { kind: "type", phrase: user.username ?? "", what: "username" },
                run: () => run(() => deleteUser({ userId: user.id, confirm: user.username ?? "" }), "Account deleted."),
              })
            }
            className="mt-3 inline-flex h-8 items-center rounded-lg bg-rose px-3 text-[13px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-40"
          >
            Delete account
          </button>
        </Panel>
      )}

      {overlays}
    </div>
  );
}

// Mirrors usernameSchema (lib/validations.ts); the server checks again, plus reserved names and uniqueness.
const USERNAME = /^[a-z0-9_]{3,20}$/;
const normalize = (v: string) => v.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);

function Panel({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section
      className={cx("card rounded-2xl p-5", danger && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--rose)_35%,transparent)]")}
      aria-label={title}
    >
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 first:mt-0 first:border-0 first:pt-0">
      <p className="text-[13px] text-ink-3">{note}</p>
      {children}
    </div>
  );
}
