import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlleenLezen, PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { Veld } from "@/components/partner/Velden";
import { Button } from "@/components/ui/button";
import { bewaarCampagne, dienCampagneIn, haalCampagnes, haalItems } from "@/lib/partners-db";
import {
  campagneBewerkbaar,
  indienFout,
  korteDatum,
  STATUS_LABEL,
  type Campagne,
} from "@/lib/partners";

export const Route = createFileRoute("/partner/campagnes")({ component: Campagnes });

type Concept = { id?: string; naam: string; doel: string; start: string; einde: string };
const LEEG: Concept = { naam: "", doel: "", start: "", einde: "" };

function Campagnes() {
  const { partner, mag } = usePartner();
  const qc = useQueryClient();
  const sleutel = ["partner", partner.id, "campagnes"];
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: sleutel,
    queryFn: () => haalCampagnes(partner.id),
  });
  const ids = data.map((c) => c.id);
  const { data: items = [] } = useQuery({
    queryKey: ["partner", partner.id, "items", ids.join(",")],
    enabled: data.length > 0,
    queryFn: () => haalItems(ids),
  });
  const magBewerken = mag("campagnes.bewerken");
  const [concept, setConcept] = useState<Concept | null>(null);
  const ververs = () => qc.invalidateQueries({ queryKey: ["partner", partner.id] });

  const bewaar = useMutation({
    mutationFn: (c: Concept) =>
      bewaarCampagne({
        ...(c.id ? { id: c.id } : {}),
        partner_id: partner.id,
        naam: c.naam,
        doel: c.doel,
        start: c.start,
        einde: c.einde,
      }),
    onSuccess: () => {
      toast.success("Campagne bewaard als concept.");
      setConcept(null);
      void ververs();
    },
    onError: () => toast.error("De campagne kon niet bewaard worden."),
  });
  const indienen = useMutation({
    mutationFn: (c: Campagne) => dienCampagneIn(c),
    onSuccess: () => {
      toast.success("Ingediend. Het Foodlo-team kijkt de campagne na.");
      void ververs();
    },
    onError: () => toast.error("Indienen lukte niet."),
  });

  const naamFout = concept && concept.naam.trim().length < 2 ? "Geef de campagne een naam." : null;
  const datumFout =
    concept && concept.start && concept.einde && concept.einde < concept.start
      ? "De einddatum ligt vóór de begindatum."
      : null;

  return (
    <>
      <PartnerKop
        titel="Campagnes"
        uitleg="Stel een campagne op, koppel gesponsorde inhoud en dien ze in. Het Foodlo-team keurt elke campagne goed voor ze getoond wordt."
      />
      {!magBewerken ? <AlleenLezen wat="campagnes" /> : null}
      {magBewerken && !concept ? (
        <Button className="h-14 px-6 text-base" onClick={() => setConcept(LEEG)}>
          Nieuwe campagne
        </Button>
      ) : null}
      {concept ? (
        <form
          aria-label={concept.id ? "Campagne aanpassen" : "Nieuwe campagne"}
          className="paneel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!naamFout && !datumFout) bewaar.mutate(concept);
          }}
        >
          <h2 className="text-sectietitel">
            {concept.id ? "Campagne aanpassen" : "Nieuwe campagne"}
          </h2>
          <Veld
            label="Naam van de campagne"
            waarde={concept.naam}
            onWijzig={(v) => setConcept({ ...concept, naam: v })}
            fout={concept.naam ? naamFout : null}
            verplicht
          />
          <Veld
            label="Doel (niet verplicht)"
            uitleg="Bv. Seizoensgroenten bekender maken."
            waarde={concept.doel}
            onWijzig={(v) => setConcept({ ...concept, doel: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld
              label="Begint op"
              type="date"
              waarde={concept.start}
              onWijzig={(v) => setConcept({ ...concept, start: v })}
            />
            <Veld
              label="Eindigt op"
              type="date"
              waarde={concept.einde}
              onWijzig={(v) => setConcept({ ...concept, einde: v })}
              fout={datumFout}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="h-14 px-6 text-base"
              disabled={!!naamFout || !!datumFout || bewaar.isPending}
            >
              Campagne bewaren
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 px-6 text-base"
              onClick={() => setConcept(null)}
            >
              Annuleren
            </Button>
          </div>
        </form>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-muted-foreground">
          Laden…
        </p>
      ) : isError ? (
        <p className="paneel p-4">De campagnes konden niet geladen worden.</p>
      ) : !data.length ? (
        <p className="paneel p-4 text-base text-muted-foreground">Nog geen campagnes.</p>
      ) : (
        <ul className="space-y-3" aria-label="Jouw campagnes">
          {data.map((c) => {
            const aantal = items.filter((i) => i.campagne_id === c.id).length;
            const reden = indienFout(c, aantal);
            return (
              <li key={c.id}>
                <article aria-label={`Campagne ${c.naam}`} className="paneel space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-kaarttitel break-words">{c.naam}</h2>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-[0.95rem] font-semibold text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-50">
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="text-base text-muted-foreground">
                    {korteDatum(c.start)} tot {korteDatum(c.einde)} · {aantal}{" "}
                    {aantal === 1 ? "gesponsord item" : "gesponsorde items"}
                  </p>
                  {c.doel ? <p className="text-base">Doel: {c.doel}</p> : null}
                  {c.status === "concept" && c.beoordeling_reden ? (
                    <p role="note" className="rounded-xl bg-muted p-3 text-base">
                      Teruggestuurd door het Foodlo-team: {c.beoordeling_reden}
                    </p>
                  ) : null}
                  {magBewerken && campagneBewerkbaar(c) ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="min-h-12"
                        onClick={() =>
                          setConcept({
                            id: c.id,
                            naam: c.naam,
                            doel: c.doel ?? "",
                            start: c.start ?? "",
                            einde: c.einde ?? "",
                          })
                        }
                      >
                        Aanpassen
                      </Button>
                      <Button variant="outline" asChild className="min-h-12">
                        <Link to="/partner/gesponsord" search={{ campagne: c.id }}>
                          Inhoud koppelen
                        </Link>
                      </Button>
                      <Button
                        className="min-h-12"
                        disabled={!!reden || indienen.isPending}
                        aria-describedby={reden ? `reden-${c.id}` : undefined}
                        onClick={() => indienen.mutate(c)}
                      >
                        Indienen ter goedkeuring
                      </Button>
                      {reden ? (
                        <p
                          id={`reden-${c.id}`}
                          className="w-full text-[0.95rem] text-muted-foreground"
                        >
                          {reden}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
