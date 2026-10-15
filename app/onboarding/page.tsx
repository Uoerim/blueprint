import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getViewer, isLockedOut } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Choose your username" };

export default async function OnboardingPage() {
  const user = await getViewer();
  if (!user) redirect("/sign-in");
  if (isLockedOut(user)) redirect("/suspended");
  if (user.onboarded && user.username) redirect("/dashboard");

  const suggestion = (user.displayName ?? user.email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);

  return (
    <AuthShell>
      <OnboardingForm suggestion={suggestion.length >= 3 ? suggestion : ""} />
    </AuthShell>
  );
}
