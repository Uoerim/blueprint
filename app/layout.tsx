import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ServiceWorker } from "@/components/service-worker";
import { APP_PREVIEW_COOKIE } from "@/lib/app-preview";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Blueprint — where raw ideas become shipped reality", template: "%s · Blueprint" },
  description:
    "A fast, private idea vault and execution board for friends and small squads. Dump ideas, promote them to tasks, see who's in focus, keep what shipped.",
  applicationName: "Blueprint",
  // Installed on an iPhone it opens full screen like an app, under the name "Blueprint".
  appleWebApp: { capable: true, title: "Blueprint", statusBarStyle: "black" },
  formatDetection: { telephone: false, email: false, address: false },
};

const BG = { light: "#f7f7f5", dark: "#09090b" };

export async function generateViewport(): Promise<Viewport> {
  // The phone's status bar takes the page colour of the theme you picked, not just the phone's own setting.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    // No viewport-fit=cover: the installed app is laid out below the phone's status bar instead of
    // under it. Drawn edge to edge, newer Android puts a see-through scrim over the top of the page
    // that smears whatever sits there, and some phones don't report the inset needed to avoid it.
    // Pinch-zoom stays allowed for accessibility; inputs are 16px on phones so focusing one never zooms.
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: BG.light },
            { media: "(prefers-color-scheme: dark)", color: BG.dark },
          ]
        : BG[theme],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every response carries a fresh CSP nonce (proxy.ts), so render per request.
  await connection();
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  // The ?app=1 test switch: lets a phone browser preview the installed-app layout.
  const preview = jar.get(APP_PREVIEW_COOKIE)?.value === "1";
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${preview ? " app-preview" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          dynamic
          appearance={{
            variables: {
              // CSS variables, so Clerk's widgets follow the light/dark theme too.
              colorPrimary: "var(--accent)",
              colorBackground: "var(--surface)",
              colorForeground: "var(--ink)",
              colorMutedForeground: "var(--ink-2)",
              colorInput: "var(--surface-2)",
              colorInputForeground: "var(--ink)",
              colorNeutral: "var(--ink)",
              colorDanger: "var(--rose)",
              colorSuccess: "var(--emerald)",
              borderRadius: "0.625rem",
              fontFamily: "var(--font-geist-sans)",
            },
          }}
        >
          {children}
          <ServiceWorker />
        </ClerkProvider>
      </body>
    </html>
  );
}
