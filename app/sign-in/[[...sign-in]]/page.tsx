import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn fallbackRedirectUrl="/dashboard" signUpForceRedirectUrl="/onboarding" signUpFallbackRedirectUrl="/onboarding" />
    </AuthShell>
  );
}
