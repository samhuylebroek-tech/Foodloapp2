import { Skeleton } from "@/components/ui/skeleton";

/** Laadscherm (V2): grijze vormen in dezelfde opbouw als de echte inhoud. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Even laden" aria-busy="true">
      <Skeleton className="h-32 w-full rounded-[1.5rem]" />
      <div className="divide-y divide-border/80 paneel overflow-hidden">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-16 items-center gap-3.5 px-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
