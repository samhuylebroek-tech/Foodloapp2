import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { Button } from "@/components/ui/button";
import { premiumExtra } from "@/lib/betalen/premium.functions";
import { beschrijfRecht, isGeenRechtFout, NIVEAU_NAAM, niveauVan } from "@/lib/betalen/rechten";
import { useAbonnement } from "@/lib/betalen/useAbonnement";

/**
 * Vriendelijke uitleg voor wie een recht (nog) niet heeft: wat het is, bij welk plan het hoort,
 * en dat alles wat gratis is gratis blijft. Nooit een kapotte of uitgeschakelde knop.
 */
export function PremiumUitleg({ recht, metKnop = true }: { recht: string; metKnop?: boolean }) {
  const info = beschrijfRecht(recht);
  const niveau = niveauVan(recht);
  return (
    <div
      data-testid="premium-uitleg"
      className="space-y-3 rounded-2xl bg-secondary/60 p-4 text-base"
    >
      <p className="flex items-start gap-2 font-semibold">
        <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>Dit hoort bij {niveau ? NIVEAU_NAAM[niveau] : "een abonnement"}.</span>
      </p>
      {info ? <p className="text-muted-foreground">{info.uitleg}</p> : null}
      <p className="text-muted-foreground">Alles wat je nu gratis gebruikt, blijft gratis.</p>
      {metKnop && niveau === "premium" ? (
        <Button asChild variant="outline" className="h-14 px-6 text-base">
          <Link to="/premium">Bekijk Premium</Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Een premium-extra: de UI kijkt eerst naar de rechten (snel, geen onnodige aanroep), de inhoud
 * komt van de server die het recht opnieuw controleert. Weigert de server toch (bv. net
 * verlopen), dan dezelfde vriendelijke uitleg.
 */
export function PremiumExtraBlok({
  soort,
  titel,
  metKnop = true,
}: {
  soort: "seizoenskalender" | "weekmenu_sjablonen";
  titel: string;
  metKnop?: boolean;
}) {
  const recht =
    soort === "seizoenskalender" ? "premium.seizoenskalender" : "premium.weekmenu_extra";
  const { mag, isLoading: rechtenLaden } = useAbonnement();
  const heeft = mag(recht);
  const haal = useServerFn(premiumExtra);
  const q = useQuery({
    queryKey: ["premium-extra", soort],
    enabled: heeft,
    retry: false,
    queryFn: () => haal({ data: { soort } }),
  });
  const id = `extra-${soort}`;
  return (
    <section aria-labelledby={id} className="paneel space-y-3 p-4">
      <h2 id={id} className="text-sectietitel">
        {titel}
      </h2>
      {rechtenLaden ? (
        <div className="h-20 animate-pulse rounded-2xl bg-muted" aria-label="Laden" />
      ) : !heeft || (q.isError && isGeenRechtFout(q.error)) ? (
        <PremiumUitleg recht={recht} metKnop={metKnop} />
      ) : q.isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-muted" aria-label="Laden" />
      ) : q.isError || !q.data ? (
        <div className="space-y-2">
          <p className="text-base">Dit kon niet geladen worden.</p>
          <Button
            variant="outline"
            className="h-14 px-6 text-base"
            onClick={() => void q.refetch()}
          >
            Opnieuw proberen
          </Button>
        </div>
      ) : !q.data.beschikbaar ? (
        <ModuleNietBeschikbaar compact naam={titel} />
      ) : q.data.soort === "seizoenskalender" ? (
        <>
          <p className="text-base text-muted-foreground">
            Nu op zijn best in België ({q.data.maand}):
          </p>
          <ul aria-label="Seizoenskalender" className="grid gap-2 sm:grid-cols-2">
            {q.data.items.map((s) => (
              <li key={s} className="rounded-xl bg-secondary px-3 py-2 text-base">
                {s}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul aria-label="Weekmenu-sjablonen" className="grid gap-3 sm:grid-cols-3">
          {q.data.sjablonen.map((w) => (
            <li key={w.id} className="space-y-2 rounded-2xl bg-secondary p-3">
              <p className="text-base font-semibold">{w.naam}</p>
              <p className="text-[0.95rem] text-muted-foreground">{w.uitleg}</p>
              <ol className="list-decimal space-y-1 pl-5 text-base">
                {w.dagen.map((d) => (
                  <li key={d} className="break-words">
                    {d}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
