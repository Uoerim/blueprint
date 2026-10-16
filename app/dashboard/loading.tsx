import { Bone, LoadingScreen } from "@/components/ui/skeleton";

/** Dashboard home while its teams load. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading your teams" className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-6 sm:pt-14 app:pb-6 app:pt-3">
      <div className="flex items-end justify-between gap-4 app:hidden">
        <div className="space-y-3">
          <Bone className="h-10 w-72 max-w-[70vw]" />
          <Bone className="h-4 w-56 max-w-[60vw]" />
        </div>
        <Bone className="hidden h-10 w-32 sm:block" />
      </div>
      <Bone className="mt-8 h-11 w-full rounded-2xl app:mt-0" />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </LoadingScreen>
  );
}
