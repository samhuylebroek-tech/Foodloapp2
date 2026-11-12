/**
 * WP3 — "Daarna": hooguit drie korte signalen onder de Nu-kaart, elk met één actie.
 * Nooit iets herhalen wat de Nu-kaart al zegt (zie `signalen` in lib/vandaag.ts).
 */
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Loader2, ShoppingCart, Sparkles } from "lucide-react";
import type { Signaal } from "@/lib/vandaag";
import { useT } from "@/lib/voorkeuren";

export function Daarna({
  signalen,
  bezig,
  onAanvullen,
}: {
  signalen: Signaal[];
  bezig: boolean;
  onAanvullen: () => void;
}) {
  const t = useT();
  if (!signalen.length) return null;
  return (
    <section aria-labelledby="daarna-titel">
      <h2 id="daarna-titel" className="text-sectietitel">
        {t("Daarna")}
      </h2>
      <ul className="paneel mt-4 divide-y divide-border/70 overflow-hidden">
        {signalen.map((s) => (
          <li key={s.soort} className="flex min-h-20 items-center gap-4 px-4 py-3">
            {s.soort === "aanvullen" ? (
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-honing/25 text-foreground">
                  <Sparkles className="size-6" aria-hidden />
                </span>
                <span className="min-w-0 text-lg break-words hyphens-auto">
                  <span className="font-semibold">
                    {s.aantal} {t(s.aantal === 1 ? "ding ontbreekt" : "dingen ontbreken")}
                  </span>{" "}
                  <span className="text-muted-foreground">{t("voor je komende maaltijden")}</span>
                </span>
                {/* Smal scherm: knop onder de tekst, zodat de zin niet in stukjes breekt.
                    Onder 400 px over de volle breedte (BUG-126: 320 px met tekst 200 %). */}
                <button
                  type="button"
                  onClick={onAanvullen}
                  disabled={bezig}
                  className="col-span-2 inline-flex min-h-12 max-w-full items-center gap-2 justify-self-start rounded-full bg-primary px-4 text-left text-base font-semibold text-primary-foreground disabled:opacity-70 min-[400px]:col-span-1 min-[400px]:col-start-2 sm:col-start-3"
                >
                  {bezig ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <ShoppingCart className="size-5" aria-hidden />
                  )}
                  {t("Zet op mijn lijst")}
                </button>
              </div>
            ) : (
              <Link
                to={s.soort === "week-vrij" ? "/planner" : "/boodschappen"}
                className="-mx-4 -my-3 flex min-h-20 min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-muted/50 min-[400px]:gap-4"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                  {s.soort === "week-vrij" ? (
                    <CalendarDays className="size-6" aria-hidden />
                  ) : (
                    <ShoppingCart className="size-6" aria-hidden />
                  )}
                </span>
                {/* BUG-126: lange woorden ("boodschappenlijst") mogen afbreken bij grote tekst. */}
                <span className="min-w-0 flex-1 text-lg break-words hyphens-auto">
                  {s.soort === "week-vrij" ? (
                    <>
                      <span className="font-semibold">
                        {s.dagen} {t(s.dagen === 1 ? "dag nog vrij" : "dagen nog vrij")}
                      </span>{" "}
                      <span className="text-muted-foreground">{t("de komende week")}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">
                        {s.aantal} {t(s.aantal === 1 ? "ding" : "dingen")}
                      </span>{" "}
                      <span className="text-muted-foreground">{t("op je boodschappenlijst")}</span>
                    </>
                  )}
                </span>
                <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
