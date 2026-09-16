import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5" aria-label="Even laden" aria-busy="true">
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}