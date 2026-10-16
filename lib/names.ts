/** What we call someone in greetings: the first word of their name, or their username if they have no name. */
export function firstName(user: { displayName: string | null; username: string | null }): string {
  return user.displayName?.trim().split(/\s+/)[0] || user.username || "there";
}
