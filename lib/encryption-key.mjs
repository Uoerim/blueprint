// Parses ENCRYPTION_KEY. Plain .mjs so the build script (plain Node) and the
// app share one copy of the rules.
//
// Accepted: 64 hex characters, or base64 / base64url that decodes to 32 bytes.
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

/**
 * @param {string | undefined} raw
 * @returns {Buffer | null} the 32-byte key, or null when missing or malformed
 */
export function parseEncryptionKey(raw) {
  const value = raw?.trim();
  if (!value) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  if (/^[A-Za-z0-9+/_-]{43}={0,1}$/.test(value)) {
    const buf = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (buf.length === 32) return buf;
  }
  return null;
}
