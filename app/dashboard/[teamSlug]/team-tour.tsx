"use client";

import { TourFlow } from "@/components/tour/flow";
import { TourLauncher } from "@/components/tour/launcher";
import type { TourStep } from "@/components/tour/tour";
import { useWorkspace } from "./workspace";

/**
 * The first time someone opens a team (one they just made, or one they joined):
 * a walk through the loop, switching views so each stop is on screen.
 */
export function TeamTour({ show }: { show: boolean }) {
  const { team, setView, setExecTab } = useWorkspace();
  const toVault = () => setView("vault");
  const toBoard = () => {
    setView("board");
    setExecTab("projects");
  };

  const steps: TourStep[] = [
    {
      id: "hello",
      title: <>Welcome to {team.name}</>,
      body: (
        <>
          Every idea here can travel the whole way to done. Six quick stops and you&apos;ll know how it works.
          <TourFlow />
        </>
      ),
      before: toVault,
    },
    {
      id: "capture",
      target: "capture",
      title: "Capture raw ideas",
      body: "Type an idea and press Drop it. Tags keep things sorted, and sparks show which ideas the team likes most.",
      before: toVault,
    },
    {
      id: "promote",
      target: "promote",
      title: "Promote the good ones",
      body: "Promote turns an idea into a project with its own page, board, tasks and subtasks. Ideas you add will show this button.",
      before: toVault,
    },
    {
      id: "plan",
      target: "exec-views",
      title: "Plan the work",
      body: {
        web: "Execution lists every project, your tasks and the whole team's. Each project has its own board.",
        app: "Tasks lists every project, your own tasks and everyone's. Each project has its own board.",
      },
      before: toBoard,
    },
    {
      id: "focus",
      target: "focus",
      title: "See who's on what",
      body: "Press Start on a task and the team sees you're working on it, live, with a timer.",
      before: toBoard,
    },
    {
      id: "shipped",
      target: "shipped",
      title: "Celebrate what shipped",
      body: "Finished tasks land in Shipped, with the name of whoever finished them.",
      before: toBoard,
    },
    {
      id: "squad",
      target: "team-actions",
      title: "Bring your squad",
      body: {
        web: "Invite teammates by their @username. Roles, tags and the archive live in the team's Settings.",
        app: "Invite teammates by their @username. Roles, tags and the archive live in team settings, behind the gear.",
      },
    },
    {
      id: "ready",
      title: "Your team is ready",
      body: "Start by dropping your first idea into the vault. Live updates keep everyone in sync as you go.",
    },
  ];

  return <TourLauncher tour="team" show={show} steps={steps} label="Team tour" finishLabel="Start capturing" onDone={toVault} />;
}
