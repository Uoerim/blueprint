import { Bone, LoadingScreen } from "@/components/ui/skeleton";

/** The Profile tab while it opens. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading profile" className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
      <div className="flex flex-col items-center">
        <Bone className="size-[88px] rounded-full" />
        <Bone className="mt-3 h-6 w-40" />
        <Bone className="mt-2 h-4 w-28" />
      </div>
      <Bone className="mt-5 h-[168px] rounded-3xl" />
      <Bone className="mt-5 h-56 rounded-3xl" />
    </LoadingScreen>
  );
}
