/**
 * Per-team AES-256-GCM field encryption for idea and task text.
 *
 * Every team gets its own key, derived with HKDF-SHA256 from the master
 * ENCRYPTION_KEY and the team id, so a key for one team can never decrypt
 * another team's rows. Each write uses a fresh random 12-byte IV, and GCM's
 * auth tag rejects any ciphertext that was altered or moved to another team.
 *
 * Stored format:  enc:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 *
 * Only free text is encrypted (titles, descriptions, notes). Tags, statuses,
 * priorities, ids and timestamps stay plain so Postgres can filter and sort.
 * Validation always runs on the plaintext first, in the server action.
 *
 * No `server-only` import: the CLI scripts (tsx) use this module too.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { parseEncryptionKey } from "./encryption-key.mjs";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const HKDF_INFO = "blueprint/team-content/v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Shown instead of text that cannot be decrypted (wrong key or tampered row). */
export const UNREADABLE = "[encrypted: unreadable]";

if (typeof window !== "undefined") throw new Error("lib/crypto must never be bundled for the browser.");

let master: Buffer | null | undefined;
let warned = false;

function masterKey(): Buffer | null {
  if (master !== undefined) return master;
  const raw = process.env.ENCRYPTION_KEY;
  const key = parseEncryptionKey(raw);
  if (key) return (master = key);
  if (raw?.trim()) {
    throw new Error("ENCRYPTION_KEY is invalid. Use 64 hex characters (32 bytes); see .env.example.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY is not set. Blueprint refuses to run in production without it. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (!warned) {
    warned = true;
    console.warn("[crypto] ENCRYPTION_KEY is not set: idea and task text is stored in plaintext (development only).");
  }
  return (master = null);
}

/** Throws at startup in production if the key is missing or invalid (see instrumentation.ts). */
export function assertEncryptionConfigured() {
  masterKey();
}

/** True when writes are encrypted (always in production). */
export function encryptionEnabled() {
  return masterKey() !== null;
}

// Derived keys are cheap to keep and costly to recompute on every field.
const teamKeys = new Map<string, Buffer>();

function teamKey(key: Buffer, teamId: string): Buffer {
  const hit = teamKeys.get(teamId);
  if (hit) return hit;
  const derived = Buffer.from(hkdfSync("sha256", key, Buffer.from(teamId, "utf8"), HKDF_INFO, 32));
  if (teamKeys.size >= 1000) teamKeys.clear();
  teamKeys.set(teamId, derived);
  return derived;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts `plain` with the team's key. Without a key (development only) it returns the text unchanged. */
export function encryptText(plain: string, teamId: string): string {
  if (!teamId) throw new Error("encryptText needs a teamId.");
  const key = masterKey();
  if (!key) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, teamKey(key, teamId), iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

/** encryptText for optional columns: null and undefined pass straight through. */
export function encryptOptional<T extends string | null | undefined>(plain: T, teamId: string): T {
  return (typeof plain === "string" ? encryptText(plain, teamId) : plain) as T;
}

/**
 * Decrypts a value written by encryptText. Anything without the `enc:v1:`
 * prefix (seed data, rows from before encryption) is returned as-is.
 */
export function decryptText(value: string, teamId: string): string {
  if (!isEncrypted(value)) return value;
  const key = masterKey();
  if (!key) return UNREADABLE;
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return UNREADABLE;
  try {
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64"));
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return UNREADABLE;
    const decipher = createDecipheriv(ALGORITHM, teamKey(key, teamId), iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    console.error("[crypto] could not decrypt a field (wrong key, wrong team, or tampered data).");
    return UNREADABLE;
  }
}

/** decryptText for optional columns. */
export function decryptOptional<T extends string | null | undefined>(value: T, teamId: string): T {
  return (typeof value === "string" ? decryptText(value, teamId) : value) as T;
}
