import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Get started" };

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp forceRedirectUrl="/onboarding" signInFallbackRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
