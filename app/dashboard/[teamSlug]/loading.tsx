import { Bone, LoadingScreen } from "@/components/ui/skeleton";

/** A team's workspace (or its settings) while the team loads. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading team" className="mx-auto w-full max-w-[1400px] px-3 pb-24 pt-6 sm:px-6 app:px-4 app:pb-4 app:pt-2">
      {/* Installed app: team chip, invite and settings. */}
      <div className="hidden items-center gap-2 app:flex">
        <Bone className="h-11 flex-1 rounded-full" />
        <Bone className="size-11 rounded-full" />
        <Bone className="size-11 rounded-full" />
      </div>
      {/* Website: team name, description and actions. */}
      <div className="flex items-end justify-between gap-4 app:hidden">
        <div className="space-y-3">
          <Bone className="h-9 w-48" />
          <Bone className="h-4 w-64 max-w-[60vw]" />
        </div>
        <Bone className="hidden h-9 w-40 md:block" />
      </div>
      <Bone className="mt-6 h-24 rounded-2xl app:mt-4" />
      <Bone className="mt-6 h-11 rounded-xl app:mt-4" />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 app:mt-4">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </LoadingScreen>
  );
}
