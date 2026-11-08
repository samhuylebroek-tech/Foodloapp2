import { useEffect, useState } from "react";
import {
  Beef,
  CakeSlice,
  Carrot,
  Cookie,
  Croissant,
  CupSoda,
  Fish,
  Salad,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useSignedUrl } from "@/lib/photos";
import { kiesOmslag, type OmslagIcoon } from "@/lib/omslag";
import { cn } from "@/lib/utils";

const ICONEN: Record<OmslagIcoon, LucideIcon> = {
  beef: Beef,
  fish: Fish,
  carrot: Carrot,
  soup: Soup,
  salad: Salad,
  cake: CakeSlice,
  croissant: Croissant,
  cup: CupSoda,
  cookie: Cookie,
  utensils: UtensilsCrossed,
};

/**
 * Receptfoto, of — zonder (werkende) foto — een warme omslag in de kleur
 * van het soort gerecht. Geef `recept` mee voor de juiste omslag.
 */
export function RecipePhoto({
  path,
  alt,
  className,
  recept,
  icoonClassName,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  recept?: { title?: string | null; category?: string | null; tags?: string[] | null };
  icoonClassName?: string;
}) {
  const url = useSignedUrl(path);
  // Externe foto's (bv. van sociale media) kunnen vervallen of geweigerd worden;
  // dan tonen we dezelfde rustige omslag in plaats van een gebroken beeld.
  const [mislukt, setMislukt] = useState(false);
  useEffect(() => setMislukt(false), [url]);

  if (!url || mislukt) {
    const { stijl, icoon } = kiesOmslag(recept ?? { title: alt });
    const Icoon = ICONEN[icoon];
    return (
      <div
        className={cn("omslag flex items-center justify-center", `omslag-${stijl}`, className)}
        data-omslag={stijl}
      >
        <Icoon
          className={cn(
            "size-[38%] max-h-24 max-w-24 text-white/85 drop-shadow-sm",
            icoonClassName,
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        {alt ? <span className="sr-only">{alt}</span> : null}
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
