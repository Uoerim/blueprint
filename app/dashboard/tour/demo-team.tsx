"use client";

import { Suspense, useState } from "react";
import type { Viewer } from "@/lib/types";
import { Workspace } from "../[teamSlug]/workspace";
import { DEMO_PERMS, DEMO_TAGS, DEMO_TEAM, demoContent, demoMembers } from "./demo-data";

/** The sample workspace, in demo mode (no action is ever sent), with the team tour running. */
export function DemoTeam({ viewer }: { viewer: Viewer }) {
  // Built once, so the sample times don't shift while you look around.
  const [content] = useState(() => demoContent(viewer));
  return (
    <>
      <div role="status" className="mx-auto mt-4 flex w-full max-w-[1400px] items-center gap-2 px-3 text-[13px] text-amber sm:px-6 app:px-4">
        <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">Demo</span>
        A sample team for the tour. Nothing here is saved.
      </div>
      <Suspense>
        <Workspace
          team={DEMO_TEAM}
          viewer={viewer}
          myRole="OWNER"
          perms={DEMO_PERMS}
          members={demoMembers(viewer)}
          ideas={content.ideas}
          tasks={content.tasks}
          invites={[]}
          tags={DEMO_TAGS}
          showTour
          demo
        />
      </Suspense>
    </>
  );
}
