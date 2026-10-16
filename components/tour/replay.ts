"use client";

import { useRouter } from "next/navigation";
import { replayTours } from "@/app/actions/account";
import { resetTourMemory } from "./launcher";

/** "Take the tour": clears this person's finished tours and starts again from the dashboard home. */
export function useReplayTours() {
  const router = useRouter();
  return async () => {
    const res = await replayTours();
    if (!res.ok) return res.error;
    resetTourMemory();
    router.push("/dashboard");
    router.refresh();
    return null;
  };
}
