import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Get started", robots: { index: false, follow: true } };

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp forceRedirectUrl="/onboarding" signInFallbackRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
