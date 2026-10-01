import { TableSkeleton, TitleSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <TitleSkeleton stats />
      <TableSkeleton />
    </div>
  );
}
