import "server-only";

/**
 * Buy Me a Coffee page, from the BUYMEACOFFEE_URL env var
 * (e.g. https://buymeacoffee.com/yourname). Only https links are accepted;
 * when it is unset the coffee buttons are hidden.
 */
export function coffeeUrl(): string | null {
  const raw = process.env.BUYMEACOFFEE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
