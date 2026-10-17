/*
 * Launch screens for the installed iPhone app. iOS shows one of these while the
 * app starts (instead of a blank white screen), picked by the exact screen
 * size, pixel density and light/dark setting. The page then takes over with
 * the same mark in the same place (the launch overlay in app/layout.tsx), so
 * opening the app looks like one continuous motion.
 */

/** iPhone screens in CSS pixels (portrait) and their pixel density. */
const SCREENS: [width: number, height: number, dpr: number][] = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12 / 13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12 / 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6–8 Plus
  [375, 667, 2], // 6–8, SE (2nd and 3rd gen)
  [320, 568, 2], // SE (1st gen)
];

export type SplashTheme = "dark" | "light";
export const SPLASH_BG: Record<SplashTheme, string> = { dark: "#09090B", light: "#F7F7F5" };
/** The mark's size on screen, in CSS pixels. The launch overlay uses the same. */
export const SPLASH_MARK = 84;

export type Splash = { file: string; width: number; height: number; dpr: number; theme: SplashTheme };

export const SPLASHES: Splash[] = SCREENS.flatMap(([w, h, dpr]) =>
  (["dark", "light"] as const).map((theme) => ({ file: `${w * dpr}x${h * dpr}-${theme}.png`, width: w, height: h, dpr, theme })),
);

/** The <link rel="apple-touch-startup-image"> entries for every screen. */
export const startupImages = SPLASHES.map((s) => ({
  url: `/splash/${s.file}`,
  media: `(device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait) and (prefers-color-scheme: ${s.theme})`,
}));
