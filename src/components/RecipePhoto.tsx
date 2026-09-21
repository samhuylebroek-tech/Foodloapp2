import { useEffect, useState } from "react";
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
  // Externe foto's (bv. van sociale media) kunnen vervallen of geweigerd worden;
  // dan tonen we dezelfde rustige placeholder in plaats van een gebroken beeld.
  const [mislukt, setMislukt] = useState(false);
  useEffect(() => setMislukt(false), [url]);

  if (!url || mislukt) {
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

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setMislukt(true)}
      className={cn("object-cover", className)}
    />
  );
}
