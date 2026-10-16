import type { Metadata } from "next";
import { ProfileScreen } from "./profile-screen";

export const metadata: Metadata = { title: "Profile" };

/**
 * The installed app's Profile tab (also reachable in the browser at /dashboard/me).
 * It needs no data of its own: the dashboard layout has already checked the
 * session and loaded your account, so the tab opens straight away. The layout
 * and proxy.ts still guard the route, and this page renders nothing but you.
 */
export default function ProfilePage() {
  return <ProfileScreen />;
}
