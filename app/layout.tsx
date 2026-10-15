import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Idea Vault — where raw ideas become shipped reality", template: "%s · Idea Vault" },
  description:
    "A fast, private idea vault and execution board for friends and small squads. Dump ideas, promote them to tasks, see who's in focus, keep what shipped.",
};

export const viewport: Viewport = { themeColor: "#09090b", colorScheme: "dark" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every response carries a fresh CSP nonce (proxy.ts), so render per request.
  await connection();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          dynamic
          appearance={{
            variables: {
              colorPrimary: "#6366F1",
              colorBackground: "#121215",
              colorForeground: "#FAFAFA",
              colorMutedForeground: "#A1A1AA",
              colorInput: "#18181C",
              colorInputForeground: "#FAFAFA",
              colorNeutral: "#FAFAFA",
              colorDanger: "#F43F5E",
              colorSuccess: "#10B981",
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
