import { useT } from "@/lib/voorkeuren";
import { toonHoeveelheid, type StapIngredient } from "@/lib/stap-ingredienten";

export type StapIngredientRegel = StapIngredient & { herhaling?: boolean };

type Props = {
  ingredienten: StapIngredientRegel[];
  factor: number;
  groot?: boolean;
};

/** Toont de hoeveelheden die bij één kookstap horen. */
export function StapIngredienten({ ingredienten, factor, groot }: Props) {
  const t = useT();
  if (!ingredienten.length) return null;

  return (
    <ul
      className={groot ? "mt-6 flex flex-wrap gap-3" : "mt-3 flex flex-wrap gap-2"}
      aria-label={t("Hoeveelheden voor deze stap")}
    >
      {ingredienten.map((i, idx) => {
        const hoeveelheid = toonHoeveelheid(i, factor);
        return (
          <li
            key={`${i.name}-${idx}`}
            className={
              groot
                ? "inline-flex min-h-14 items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-xl"
                : "inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-base"
            }
          >
            {!i.herhaling && hoeveelheid && (
              <span className="font-semibold text-primary">{hoeveelheid}</span>
            )}
            <span>{t(i.name)}</span>
            {i.herhaling && (
              <span className={groot ? "text-lg text-muted-foreground" : "text-base text-muted-foreground"}>
                ({t("rest")})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
