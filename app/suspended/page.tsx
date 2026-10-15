import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LEGAL_EMAIL } from "@/components/legal-constants";
import { btn, cx } from "@/components/ui/primitives";
import { getViewer, isLockedOut } from "@/lib/auth";

export const metadata = { title: "Account suspended", robots: { index: false } };

export default async function SuspendedPage() {
  const user = await getViewer();
  if (!user) redirect("/sign-in");
  if (!isLockedOut(user)) redirect("/dashboard");

  return (
    <AuthShell>
      <div className="card w-full max-w-md rounded-2xl p-6 sm:p-8">
        <span className="inline-block rounded-md bg-rose/12 px-2 py-0.5 text-[12px] font-medium text-rose">Suspended</span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This account is suspended</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          You can&apos;t use Blueprint with this account right now. Your teams&apos; data is untouched.
        </p>
        {user.banReason && (
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-[14px] text-ink-2">
            <span className="block text-[12px] text-ink-3">Reason</span>
            {user.banReason}
          </p>
        )}
        <p className="mt-4 text-[14px] text-ink-2">
          Think this is a mistake? Email{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-ink underline underline-offset-2">{LEGAL_EMAIL}</a>.
        </p>
        <SignOutButton redirectUrl="/">
          <button type="button" className={cx(btn.outline, "mt-6 w-full")}>Sign out</button>
        </SignOutButton>
      </div>
    </AuthShell>
  );
}
