/**
 * Keuken: je restjes (op je account en bij je gezin na migratie 0019, anders op dit toestel),
 * met wanneer ze gekookt zijn, en "Opgegeten" of "Weggegooid" (met ongedaan maken).
 * Daaronder een klein overzicht van deze maand: een richtwaarde, alleen wat je zelf markeerde.
 * Na 3 dagen stelt Foodlo ze niet meer voor en vraagt het om zelf te kijken of het nog goed is.
 * Altijd zichtbaar (ook met Slimme voorstellen uit): het is je eigen lijst, geen voorstel.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRestjes, useRestjesActies, useRestjesBron } from "@/hooks/useRestjes";
import { useEigenGezinId } from "@/hooks/useVoorstelEters";
import { labelVoor } from "@/components/planner/gedeeld";
import {
  RESTJE_VOORSTEL_DAGEN,
  dagenOud,
  gekooktTekst,
  type Afloop,
  type Restje,
} from "@/lib/intelligentie/restjes";
import { verspillingDezeMaand } from "@/lib/intelligentie/restjes-db";
import { meet } from "@/lib/meten";

const porties = (n: number) => `${n} ${n === 1 ? "portie" : "porties"}`;

export function RestjesLijst() {
  const { user } = useAuth();
  const lijst = useRestjes();
  const acties = useRestjesActies();
  const bron = useRestjesBron();
  const qc = useQueryClient();

  function sluit(r: Restje, status: Afloop) {
    if (!acties) return;
    const herstel = acties.sluit(r.id, status);
    if (!herstel) return;
    void meet("restjes.afgesloten", undefined, { status });
    void qc.invalidateQueries({ queryKey: ["restjes-verspilling"] });
    toast(status === "opgegeten" ? `${r.titel}: opgegeten` : `${r.titel}: weggegooid`, {
      description:
        status === "weggegooid"
          ? "Het telt mee in je overzicht van deze maand."
          : "Goed bezig: minder verspild.",
      action: {
        label: "Ongedaan maken",
        onClick: () =>
          void herstel().finally(
            () => void qc.invalidateQueries({ queryKey: ["restjes-verspilling"] }),
          ),
      },
    });
  }

  if (!user) return null;
  return (
    <div className="min-w-0 space-y-4">
      {lijst.length ? (
        <section aria-labelledby="restjes-titel" className="min-w-0">
          <h2 id="restjes-titel" className="text-sectietitel">
            Restjes
          </h2>
          <p className="mt-1 text-base text-muted-foreground" data-testid="restjes-bron">
            {bron === "account" ? "Op je account, ook zichtbaar voor je gezin." : "Op dit toestel."}
          </p>
          <ul className="mt-3 divide-y divide-border rounded-2xl bg-card shadow-zacht">
            {lijst.map((r) => (
              <li
                key={r.id}
                className="flex min-h-[4.25rem] flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-4 pr-2"
              >
                <span className="min-w-0 flex-1 basis-44">
                  <span className="block text-lg font-semibold leading-snug break-words">
                    {r.titel}
                  </span>
                  <span className="block text-[0.95rem] text-muted-foreground">
                    {gekooktTekst(r)} · {porties(r.porties)}
                  </span>
                  {r.gepland ? (
                    <span className="block text-[0.95rem] font-semibold text-primary">
                      Gepland: {labelVoor(r.gepland)}
                    </span>
                  ) : null}
                  {dagenOud(r) > RESTJE_VOORSTEL_DAGEN ? (
                    <span className="block text-[0.95rem] font-semibold text-[oklch(0.42_0.1_55)] dark:text-[oklch(0.85_0.09_75)]">
                      Kijk zelf of het nog goed is.
                    </span>
                  ) : null}
                </span>
                <span className="ml-auto flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    aria-label={`Opgegeten: ${r.titel}`}
                    onClick={() => sluit(r, "opgegeten")}
                    className="min-h-12 rounded-full border border-border px-4 text-base font-semibold hover:bg-muted"
                  >
                    Opgegeten
                  </button>
                  <button
                    type="button"
                    aria-label={`Weggegooid: ${r.titel}`}
                    onClick={() => sluit(r, "weggegooid")}
                    className="min-h-12 rounded-full border border-border px-4 text-base font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Weggegooid
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <VerspillingOverzicht />
    </div>
  );
}

/** "Deze maand: 6 porties opgegeten, 1 weggegooid." Niets gemarkeerd = niets tonen. */
export function VerspillingOverzicht() {
  const { user } = useAuth();
  const gezinId = useEigenGezinId();
  const lijst = useRestjes();
  const { data } = useQuery({
    queryKey: ["restjes-verspilling", user?.id, gezinId, lijst.length],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => verspillingDezeMaand(user!.id, gezinId),
  });
  if (!data || data.procentWeg === null) return null;
  const maandNaam = new Date(`${data.maand}-15T12:00:00`).toLocaleDateString("nl-BE", {
    month: "long",
  });
  return (
    <section
      aria-labelledby="verspilling-titel"
      className="rounded-2xl bg-muted px-4 py-3 text-base"
      data-testid="verspilling"
    >
      <h3 id="verspilling-titel" className="font-semibold">
        Verspilling in {maandNaam}
      </h3>
      <p>
        {porties(data.opgegeten)} opgegeten · {porties(data.weggegooid)} weggegooid
        {data.weggegooid ? ` (${data.procentWeg}%)` : ""}.
      </p>
      <p className="text-[0.95rem] text-muted-foreground">
        Een richtwaarde: Foodlo telt alleen wat {data.bron === "account" ? "jullie" : "je"} zelf
        markeerde{data.bron === "account" ? "" : " op dit toestel"}.
      </p>
    </section>
  );
}
