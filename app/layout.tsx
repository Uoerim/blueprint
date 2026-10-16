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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the installed app draw edge to edge; app chrome pads itself with the safe-area insets.
  viewportFit: "cover",
  // Pinch-zoom stays allowed for accessibility; inputs are 16px on phones so focusing one never zooms.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

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
