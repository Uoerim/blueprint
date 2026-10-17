"use client";

import { useRouter } from "next/navigation";
import { TourFlow } from "@/components/tour/flow";
import { TourLauncher } from "@/components/tour/launcher";
import type { TourStep } from "@/components/tour/tour";
import { showTourDemos } from "@/lib/tour-demo";

/** The first look around for a new account, on the dashboard home. */
export function WelcomeTour({ name, username, show }: { name: string; username: string; show: boolean }) {
  const router = useRouter();
  const hide = () => showTourDemos();
  const steps: TourStep[] = [
    {
      id: "hello",
      title: <>Welcome to Blueprint, {name}</>,
      body: (
        <>
          This is where your squad&apos;s raw ideas become shipped work. Here&apos;s a quick look around.
          <TourFlow />
        </>
      ),
    },
    {
      id: "team",
      target: "create-team",
      before: hide,
      title: "Everything starts with a team",
      body: "A team has its own ideas, projects and tasks. Start one for yourself, your friends or your class: it takes a few seconds.",
    },
    {
      id: "invites",
      target: "invites",
      // People with teams have no Invites section, so a sample invite shows for this step.
      before: () => showTourDemos("invite"),
      title: "Invites land here",
      body: (
        <>
          When someone adds you to their team, you&apos;ll see it here and can accept with one tap. They&apos;ll need your
          username: <span className="font-mono text-ink">@{username}</span>.
        </>
      ),
    },
    {
      id: "nav",
      target: "nav",
      before: hide,
      title: "Find your way around",
      body: {
        web: "Switch between your teams here. The Blueprint logo always brings you back home.",
        app: "Home, Ideas, Tasks and Profile are always one tap away in this bar.",
      },
    },
    {
      id: "help",
      target: "help",
      title: "Help is close by",
      body: {
        web: "Contact support lets you report a bug or request a feature right from the app, or email us. Your theme and usage live in the account menu.",
        app: "Profile holds your account, theme, usage, and Contact support, where you can report a bug or request a feature.",
      },
    },
    {
      id: "ready",
      before: hide,
      title: "Now, a team up close",
      body: "Next we'll open a demo team so you can see ideas, projects, tasks and live focus in action. It's only on your screen; nothing is saved.",
    },
  ];

  return (
    <TourLauncher
      tour="welcome"
      show={show}
      steps={steps}
      label="Welcome tour"
      finishLabel="Show me"
      onDone={(finished) => {
        if (finished) router.push("/dashboard/tour");
      }}
    />
  );
}
