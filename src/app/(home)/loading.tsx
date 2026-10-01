import { Bar, TitleSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <TitleSkeleton />
      <div className="mt-8 grid grid-cols-12 gap-10">
        <div className="col-span-12 space-y-6 lg:col-span-8">
          <Bar className="h-9 w-80" />
          <Bar className="h-36 w-full" />
          <Bar className="h-10 w-40" />
        </div>
        <div className="col-span-12 space-y-4 lg:col-span-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between border-b border-rule py-3">
              <Bar className="h-4 w-24" />
              <Bar className="h-5 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
