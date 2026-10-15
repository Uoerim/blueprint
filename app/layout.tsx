import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Blueprint — where raw ideas become shipped reality", template: "%s · Blueprint" },
  description:
    "A fast, private idea vault and execution board for friends and small squads. Dump ideas, promote them to tasks, see who's in focus, keep what shipped.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every response carries a fresh CSP nonce (proxy.ts), so render per request.
  await connection();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
        </ClerkProvider>
      </body>
    </html>
  );
}
