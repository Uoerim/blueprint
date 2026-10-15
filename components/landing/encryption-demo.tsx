"use client";

import { useState } from "react";

const START = "Tilt arpeggiator for the pocket synth";
// A fixed first sample so the server and client render the same thing.
const SAMPLE = "enc:v1:q3Vt0jZr8w1mYk2L:Zx9oQ1c7S2V0bW9kZXJuIQ==:3vKp0Qm1Zr8tYy2Nw7c4LfXa9eHs1UuB0iQpRkT2mGvW5oJxE";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Illustration of what the database stores: a fresh IV every write, so the same text never looks the same twice. */
function seal(text: string) {
  const length = new TextEncoder().encode(text).length;
  return `enc:v1:${b64(random(12))}:${b64(random(16))}:${b64(random(Math.max(1, length)))}`;
}

export function EncryptionDemo() {
  const [text, setText] = useState(START);
  const [stored, setStored] = useState(SAMPLE);

  return (
    <div data-ui className="card overflow-hidden rounded-2xl">
      <div className="p-4 sm:p-5">
        <label htmlFor="enc-demo" className="text-[12px] font-medium text-ink-2">What you type</label>
        <input
          id="enc-demo"
          value={text}
          maxLength={80}
          onChange={(e) => {
            setText(e.target.value);
            setStored(seal(e.target.value));
          }}
          className="field mt-1.5 h-11 w-full rounded-xl px-3 text-[15px] text-ink"
        />
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="inline-block size-1.5 rounded-full bg-emerald" aria-hidden /> Your teammates see this, decrypted with your team&apos;s key.
        </p>
      </div>
      <div className="border-t border-line bg-surface-2/60 p-4 sm:p-5">
        <p className="text-[12px] font-medium text-ink-2">What the database stores</p>
        <p className="mt-1.5 break-all rounded-xl bg-bg/60 p-3 font-mono text-[12px] leading-relaxed text-ink-3 shadow-highlight" aria-live="polite">
          {stored}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          {[
            ["Cipher", "AES-256-GCM"],
            ["Key", "One per team"],
            ["IV", "New every save"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface p-2 shadow-highlight">
              <dt className="text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
