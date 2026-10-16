export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** Per-device preference, readable by the server so the first paint is already themed. */
export const THEME_COOKIE = "bp-theme";

/** Anything missing or unknown means "system": follow the device until someone picks. */
export const parseTheme = (v: string | undefined): Theme =>
  (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : "system";
