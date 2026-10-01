import { Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="flex justify-between">
        <Bar className="h-3 w-40" />
        <Bar className="h-3 w-28" />
      </div>
      <div className="grid grid-cols-12 gap-6 border-b-2 border-ink pb-8">
        <div className="col-span-12 space-y-3 md:col-span-8">
          <Bar className="h-3 w-32" />
          <Bar className="h-11 w-80" />
          <Bar className="h-4 w-full max-w-xl" />
          <Bar className="h-3 w-72" />
        </div>
        <div className="col-span-12 space-y-3 md:col-span-4 md:justify-items-end">
          <Bar className="h-3 w-20 md:ml-auto" />
          <Bar className="h-11 w-36 md:ml-auto" />
          <Bar className="h-3 w-48 md:ml-auto" />
        </div>
      </div>
      <div className="space-y-3">
        <Bar className="h-3 w-28" />
        <Bar className="h-5 w-full max-w-3xl" />
        <Bar className="h-5 w-full max-w-3xl" />
        <Bar className="h-5 w-2/3 max-w-2xl" />
      </div>
      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-7">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2 border-b border-rule py-4">
              <div className="flex justify-between">
                <Bar className="h-4 w-48" />
                <Bar className="h-3 w-24" />
              </div>
              <Bar className="h-3 w-full max-w-lg" />
            </div>
          ))}
        </div>
        <div className="col-span-12 space-y-3 lg:col-span-5">
          <Bar className="h-2 w-full" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
