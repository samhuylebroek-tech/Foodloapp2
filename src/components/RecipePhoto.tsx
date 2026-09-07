import { CookingPot } from "lucide-react";
import { useSignedUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

export function RecipePhoto({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = useSignedUrl(path);

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-muted-foreground",
          className,
        )}
      >
        <CookingPot className="size-10" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
