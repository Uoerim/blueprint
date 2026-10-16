import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireOnboardedPage } from "@/lib/auth";
import { isStaff } from "@/lib/site-roles";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { ProfileScreen } from "./profile-screen";

export const metadata: Metadata = { title: "Profile" };

/** The installed app's Profile tab (also reachable in the browser at /dashboard/me). */
export default async function ProfilePage() {
  const user = await requireOnboardedPage();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <ProfileScreen
      username={user.username!}
      displayName={user.displayName}
      accentColor={user.accentColor}
      imageUrl={user.imageUrl}
      theme={theme}
      staff={isStaff(user.siteRole)}
    />
  );
}
