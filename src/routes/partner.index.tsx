import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PartnerKop, TestBand, usePartner } from "@/components/partner/PartnerShell";
import {
  haalCampagnes,
  haalDagtotalen,
  haalProducten,
  haalSamenwerkingen,
} from "@/lib/partners-db";
import { rapportTotalen, STATUS_LABEL } from "@/lib/partners";

export const Route = createFileRoute("/partner/")({ component: Overzicht });

function Tegel({ label, waarde, naar }: { label: string; waarde: number | string; naar: string }) {
  return (
    <Link
      to={naar}
      className="paneel block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block text-[0.95rem] text-muted-foreground">{label}</span>
      <span className="block text-3xl font-semibold">{waarde}</span>
    </Link>
  );
}

function Overzicht() {
  const { partner } = usePartner();
  const id = partner.id;
  const producten = useQuery({
    queryKey: ["partner", id, "producten"],
    queryFn: () => haalProducten(id),
  });
  const campagnes = useQuery({
    queryKey: ["partner", id, "campagnes"],
    queryFn: () => haalCampagnes(id),
  });
  const samen = useQuery({
    queryKey: ["partner", id, "samenwerkingen"],
    queryFn: () => haalSamenwerkingen(id),
  });
  const ids = (campagnes.data ?? []).map((c) => c.id);
  const stat = useQuery({
    queryKey: ["partner", id, "statistiek", ids.join(",")],
    enabled: campagnes.isSuccess,
    queryFn: () => haalDagtotalen(ids),
  });
  const totaal = rapportTotalen(stat.data ?? []);
  const lijst = campagnes.data ?? [];
  const tel = (s: string) => lijst.filter((c) => c.status === s).length;

  return (
    <>
      <PartnerKop titel="Overzicht" uitleg={`Welkom bij de partneromgeving van ${partner.naam}.`} />
      {partner.verificatie_status !== "geverifieerd" ? (
        <TestBand>
          Je organisatie wacht nog op verificatie door het Foodlo-team. Je kunt al alles
          voorbereiden; campagnes worden pas getoond na goedkeuring.
        </TestBand>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tegel label="Producten" waarde={producten.data?.length ?? "…"} naar="/partner/producten" />
        <Tegel
          label="Campagnes"
          waarde={campagnes.data ? lijst.length : "…"}
          naar="/partner/campagnes"
        />
        <Tegel
          label="Lopend (goedgekeurd of actief)"
          waarde={campagnes.data ? tel("actief") + tel("goedgekeurd") : "…"}
          naar="/partner/campagnes"
        />
        <Tegel
          label="Samenwerkingen"
          waarde={samen.data?.length ?? "…"}
          naar="/partner/samenwerkingen"
        />
      </div>
      <section aria-labelledby="ov-status" className="paneel space-y-2 p-4">
        <h2 id="ov-status" className="text-sectietitel">
          Campagnes per status
        </h2>
        <ul className="grid gap-1 text-base sm:grid-cols-2">
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
            <li key={s} className="flex justify-between gap-3 border-b border-border/60 py-1.5">
              <span>{STATUS_LABEL[s]}</span>
              <span className="font-semibold">{campagnes.data ? tel(s) : "…"}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="ov-bereik" className="paneel space-y-2 p-4">
        <h2 id="ov-bereik" className="text-sectietitel">
          Bereik (alle campagnes samen)
        </h2>
        <p className="text-base">
          <strong>{totaal.vertoningen.toLocaleString("nl-BE")}</strong> keer getoond ·{" "}
          <strong>{totaal.klikken.toLocaleString("nl-BE")}</strong> keer bekeken ·{" "}
          {totaal.klikratio.toLocaleString("nl-BE")}% klikratio
        </p>
        <p className="text-[0.95rem] text-muted-foreground">
          Demogegevens: verzonnen dagtotalen. Je ziet altijd alleen totalen, nooit wie iets zag.
        </p>
        <Link
          to="/partner/rapportage"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
        >
          Naar de rapportage
        </Link>
      </section>
    </>
  );
}
