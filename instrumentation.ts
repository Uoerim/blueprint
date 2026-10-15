// Runs once when a server instance starts. In production, refuse to boot
// without a valid ENCRYPTION_KEY rather than silently store plaintext.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEncryptionConfigured } = await import("./lib/crypto");
  assertEncryptionConfigured();
}
