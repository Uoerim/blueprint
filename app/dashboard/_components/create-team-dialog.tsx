"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTeam } from "@/app/actions/teams";
import { Dialog, Field, inputCls } from "@/components/ui/dialog";
import { btn, cx } from "@/components/ui/primitives";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function CreateTeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createTeam({
        name,
        slug: slugTouched ? slug : "",
        description: description || undefined,
      });
      if (!res.ok) return setError(res.error);
      onClose();
      setName("");
      setSlug("");
      setSlugTouched(false);
      setDescription("");
      router.push(`/dashboard/${res.data.slug}`);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create a new team" description="You'll be the owner. Invite your squad by @username next.">
      <form onSubmit={submit} className="space-y-5 pt-2">
        <Field label="Team name" htmlFor="team-name">
          <input
            id="team-name"
            autoFocus
            required
            minLength={2}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Night Shift"
            className={cx(inputCls, "h-10")}
          />
        </Field>
        <Field
          label="URL slug"
          htmlFor="team-slug"
          hint={<span className="font-mono">/dashboard/{effectiveSlug || "your-team"}</span>}
        >
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
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cx(inputCls, "resize-none py-2.5")}
          />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>Cancel</button>
          <button type="submit" disabled={pending || name.trim().length < 2} className={btn.primary}>
            {pending ? "Creating…" : "Create team"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
