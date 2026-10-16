"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppMode } from "@/lib/app-mode";

/** The installed phone app skips the marketing page and goes straight to Home (or sign-in). */
export function AppLandingRedirect() {
  const app = useAppMode();
  const router = useRouter();
  useEffect(() => {
    if (app) router.replace("/dashboard");
  }, [app, router]);
  return null;
}
