"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { completeOnboarding } from "@/app/actions/onboarding";
import { btn, cx, Monogram } from "@/components/ui/primitives";
import { ACCENTS } from "@/lib/constants";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; reason: string }
  | { state: "error"; reason: string };

const normalize = (v: string) => v.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);

export function OnboardingForm({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(suggestion);
  const [accent, setAccent] = useState<string>(ACCENTS[0].hex);
  // Results are keyed by the handle they answer, so a stale reply never shows.
  const [result, setResult] = useState<{ for: string; check: Check } | null>(null);
  const check: Check =
    username.length < 3 ? { state: "idle" } : result?.for === username ? result.check : { state: "checking" };
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Debounced availability check against the rate-limited endpoint.
  useEffect(() => {
    if (username.length < 3) return;
    const setCheck = (c: Check) => setResult({ for: username, check: c });
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?u=${encodeURIComponent(username)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (res.status === 429) {
          setCheck({ state: "error", reason: "Too many checks — wait a moment." });
          return;
        }
        const data = (await res.json()) as { available: boolean; reason: string | null };
        setCheck(data.available ? { state: "available" } : { state: "taken", reason: data.reason ?? "Already taken" });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setCheck({ state: "error", reason: "Couldn't check right now." });
      }
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [username]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await completeOnboarding({ username, accentColor: accent });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  };

  const accentName = ACCENTS.find((a) => a.hex === accent)?.name;
  const canSubmit = check.state === "available" && !pending;

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass w-full max-w-[440px] rounded-2xl border border-line-strong p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:p-8"
    >
      <div className="flex items-center gap-3">
        <motion.div key={accent + username.slice(0, 2)} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
          <Monogram name={username || "you"} color={accent} size={44} />
        </motion.div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Claim your handle</h1>
          <p className="text-sm text-ink-2">This is how your squad finds and invites you.</p>
        </div>
      </div>

      <label htmlFor="username" className="mt-7 block text-sm font-medium text-ink">Username</label>
      <div
        className={cx(
          "mt-2 flex h-11 items-center rounded-lg bg-bg px-3 transition-shadow",
          check.state === "available" && "shadow-[inset_0_0_0_1px_#10B981]",
          (check.state === "taken" || check.state === "error") && "shadow-[inset_0_0_0_1px_#F43F5E]",
          (check.state === "idle" || check.state === "checking") && "shadow-[inset_0_0_0_1px_var(--line-strong)] focus-within:shadow-[inset_0_0_0_1px_#6366F1]",
        )}
      >
        <span className="font-mono text-sm text-ink-3">@</span>
        <input
          id="username"
          name="username"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(normalize(e.target.value))}
          aria-describedby="username-status"
          className="h-full min-w-0 flex-1 bg-transparent pl-0.5 font-mono text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          placeholder="your_handle"
        />
      </div>
      <div id="username-status" aria-live="polite" className="mt-2 h-5 text-[13px]">
        <AnimatePresence mode="wait">
          <motion.span
            key={check.state}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cx(
              "inline-flex items-center gap-1.5",
              check.state === "available" && "text-emerald",
              (check.state === "taken" || check.state === "error") && "text-rose",
              (check.state === "idle" || check.state === "checking") && "text-ink-3",
            )}
          >
            {check.state === "idle" && "3–20 characters: a–z, 0–9 and underscores."}
            {check.state === "checking" && "Checking…"}
            {check.state === "available" && <><Dot /> <span className="font-mono">@{username}</span> is available</>}
            {check.state === "taken" && <><Dot /> {check.reason}</>}
            {check.state === "error" && check.reason}
          </motion.span>
        </AnimatePresence>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">Signature colour</legend>
        <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a.hex}
              type="button"
              role="radio"
              aria-checked={accent === a.hex}
              aria-label={a.name}
              title={a.name}
              onClick={() => setAccent(a.hex)}
              className="grid size-9 place-items-center rounded-[30%] transition-transform hover:scale-110 active:scale-95"
              style={{ boxShadow: accent === a.hex ? `0 0 0 2px var(--bg), 0 0 0 4px ${a.hex}` : undefined }}
            >
              <span className="size-6 rounded-[28%]" style={{ backgroundColor: a.hex }} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">{accentName}</p>
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={cx(btn.primary, "mt-7 h-11 w-full")}>
        {pending ? "Claiming…" : username.length >= 3 ? `Claim @${username} →` : "Claim handle →"}
      </button>
    </motion.form>
  );
}

function Dot() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden />;
}
