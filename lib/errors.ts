import "server-only";

/** What people see when something breaks on the server. Never the real error. */
export const GENERIC_ERROR = "An unexpected error occurred. Please try again.";

// Credentials that could ride along inside a driver error: URLs with a user:password@ part,
// and key=value pairs that look like secrets.
const URL_WITH_CREDENTIALS = /\b([a-z][a-z0-9+.-]*):\/\/[^\s/'"@]+@[^\s'"]*/gi;
const SECRET_PAIRS = /\b(password|passwd|pwd|token|secret|api[_-]?key|key|authorization)=([^&\s'"]+)/gi;

/** Removes connection strings and secrets from anything about to be logged. */
export function redact(text: string): string {
  return text.replace(URL_WITH_CREDENTIALS, "$1://[redacted]").replace(SECRET_PAIRS, "$1=[redacted]");
}

/**
 * Logs an unexpected server error with a short reference code and returns that
 * code. The person only sees GENERIC_ERROR plus the reference, so support can
 * find the full log line without the response ever carrying stack traces,
 * Prisma codes, file paths or connection details.
 */
export function logServerError(scope: string, error: unknown): string {
  const ref = crypto.randomUUID().slice(0, 8);
  const e = error instanceof Error ? error : new Error(String(error));
  const code = (error as { code?: unknown } | null)?.code;
  const head = `[${scope}] ref=${ref}${typeof code === "string" ? ` code=${code}` : ""} ${e.name}: ${e.message}`;
  console.error(redact(e.stack ? `${head}\n${e.stack.split("\n").slice(1).join("\n")}` : head));
  return ref;
}
