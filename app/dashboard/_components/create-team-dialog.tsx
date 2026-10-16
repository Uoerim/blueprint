"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createTeam } from "@/app/actions/teams";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { btn, cx, Monogram, readable } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/constants";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Person = { id: string; username: string; displayName: string | null; accentColor: string; imageUrl: string | null };

export function CreateTeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [invitees, setInvitees] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setInvitees([]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createTeam({
        name,
        slug: slugTouched ? slug : "",
        description: description || undefined,
        inviteeIds: invitees.map((p) => p.id),
      });
      if (!res.ok) return setError(res.error);
      onClose();
      reset();
      router.push(`/dashboard/${res.data.slug}`);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Create a new team" description="You'll be the owner. Invite your squad now or later.">
      <form onSubmit={submit} className="space-y-5 pt-2">
        <Field label="Team name" htmlFor="team-name">
          <input
            id="team-name"
            autoFocus
            required
            minLength={2}
            maxLength={LIMITS.teamName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Night Shift"
            className={cx(inputCls, "h-10")}
          />
        </Field>
        <Field label="URL slug" htmlFor="team-slug" hint={<span className="font-mono">/dashboard/{effectiveSlug || "your-team"}</span>}>
          <input
            id="team-slug"
            value={effectiveSlug}
            maxLength={40}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="night-shift"
            className={cx(inputCls, "h-10 font-mono")}
          />
        </Field>
        <Field label="Description" htmlFor="team-desc" hint="Optional. What is this squad building?">
          <textarea
            id="team-desc"
            rows={2}
            maxLength={LIMITS.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cx(inputCls, "resize-none py-2.5")}
          />
        </Field>

        <InvitePicker picked={invitees} onChange={setInvitees} />

        {error && <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>Cancel</button>
          <button type="submit" disabled={pending || name.trim().length < 2} className={btn.primary}>
            {pending ? "Creating…" : invitees.length ? `Create and invite ${invitees.length}` : "Create team"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Search people by @username and collect them; invites go out when the team is created. */
function InvitePicker({ picked, onChange }: { picked: Person[]; onChange: (p: Person[]) => void }) {
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<{ for: string; users: Person[]; limited: boolean } | null>(null);
  const term = q.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
  const fresh = reply?.for === term ? reply : null;
  const results = term && fresh ? fresh.users.filter((u) => !picked.some((p) => p.id === u.id)) : [];
  const loading = !!term && !fresh;

  useEffect(() => {
    if (!term) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        if (res.status === 429) return setReply({ for: term, users: [], limited: true });
        const data = (await res.json()) as { users?: Person[] };
        setReply({ for: term, users: data.users ?? [], limited: false });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setReply({ for: term, users: [], limited: false });
      }
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [term]);

  return (
    <div>
      <label htmlFor="invite-q" className="block text-sm font-medium text-ink">Invite people <span className="font-normal text-ink-3">(optional)</span></label>
      <div className="field mt-1.5 flex h-10 items-center gap-2 rounded-lg px-3">
        <span className="font-mono text-sm text-ink-3">@</span>
        <input
          id="invite-q"
          value={q}
          maxLength={21}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="username"
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" aria-label="Searching" />}
      </div>
      {term && (
        <ul className="mt-1.5 space-y-0.5" aria-live="polite">
          {results.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-tint/[0.03]">
              <Monogram name={u.displayName ?? u.username} color={u.accentColor} src={u.imageUrl} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[13px]" style={{ color: readable(u.accentColor) }}>@{u.username}</span>
                {u.displayName && <span className="block truncate text-xs text-ink-3">{u.displayName}</span>}
              </span>
              <button
                type="button"
                disabled={picked.length >= 20}
                onClick={() => {
                  onChange([...picked, u]);
                  setQ("");
                }}
                className={cx(btn.outline, btn.xs)}
              >
                Add
              </button>
            </li>
          ))}
          {fresh && !results.length && !fresh.limited && <li className="px-2 py-2 text-[13px] text-ink-3">No one with a username starting @{term}.</li>}
          {fresh?.limited && <li className="px-2 py-2 text-[13px] text-rose">Searching too fast. Give it a few seconds.</li>}
        </ul>
      )}
      {picked.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="People to invite">
          {picked.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-lg py-0.5 pl-0.5 pr-1 shadow-highlight" style={{ backgroundColor: `${p.accentColor}12` }}>
              <Monogram name={p.username} color={p.accentColor} src={p.imageUrl} size={20} />
              <span className="font-mono text-[12px]" style={{ color: readable(p.accentColor) }}>@{p.username}</span>
              <button
                type="button"
                onClick={() => onChange(picked.filter((x) => x.id !== p.id))}
                aria-label={`Don't invite @${p.username}`}
                className="grid size-5 place-items-center rounded text-ink-3 hover:text-ink"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden><path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
