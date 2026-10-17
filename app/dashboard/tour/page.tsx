import type { Metadata } from "next";
import { requireOnboardedPage } from "@/lib/auth";
import type { Viewer } from "@/lib/types";
import { DemoTeam } from "./demo-team";

export const metadata: Metadata = { title: "Demo team" };

/**
 * The demo team the welcome tour opens: a sample team to look around in, shown
 * on screen only. Signed-in people only (like the rest of the dashboard); it
 * reads nothing from the database except who you are, and writes nothing.
 */
export default async function DemoTeamPage() {
  const user = await requireOnboardedPage();
  const viewer: Viewer = {
    id: user.id,
    username: user.username!,
    accentColor: user.accentColor,
    displayName: user.displayName,
    imageUrl: user.imageUrl,
  };
  return <DemoTeam viewer={viewer} />;
}
