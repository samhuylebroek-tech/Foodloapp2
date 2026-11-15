import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlleenLezen, PartnerKop, TestBand, usePartner } from "@/components/partner/PartnerShell";
import { haalCampagnes, haalDagtotalen } from "@/lib/partners-db";
import { korteDatum, rapportTotalen } from "@/lib/partners";

export const Route = createFileRoute("/partner/rapportage")({ component: Rapportage });

function Rapportage() {
  const { partner, mag } = usePartner();
  const { data: campagnes = [], isSuccess } = useQuery({
    queryKey: ["partner", partner.id, "campagnes"],
    queryFn: () => haalCampagnes(partner.id),
  });
  const ids = campagnes.map((c) => c.id);
  const { data: dagen = [], isLoading } = useQuery({
    queryKey: ["partner", partner.id, "statistiek", ids.join(",")],
    enabled: isSuccess && mag("rapportage.zien"),
    queryFn: () => haalDagtotalen(ids),
  });
  if (!mag("rapportage.zien")) return <AlleenLezen wat="de rapportage" />;
  const totaal = rapportTotalen(dagen);
  const naam = new Map(campagnes.map((c) => [c.id, c.naam]));
  const n = (x: number) => x.toLocaleString("nl-BE");

  return (
    <>
      <PartnerKop
        titel="Rapportage"
        uitleg="Alleen totalen per dag en per campagne. Foodlo deelt nooit wie iets zag of aanklikte."
      />
      <TestBand>Demogegevens: verzonnen dagtotalen, geen echte cijfers.</TestBand>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="paneel p-4">
          <p className="text-[0.95rem] text-muted-foreground">Keer getoond</p>
          <p className="text-3xl font-semibold">{n(totaal.vertoningen)}</p>
        </div>
        <div className="paneel p-4">
          <p className="text-[0.95rem] text-muted-foreground">Keer bekeken</p>
          <p className="text-3xl font-semibold">{n(totaal.klikken)}</p>
        </div>
        <div className="paneel p-4">
          <p className="text-[0.95rem] text-muted-foreground">Klikratio</p>
          <p className="text-3xl font-semibold">{n(totaal.klikratio)}%</p>
        </div>
      </div>
      {isLoading ? (
        <p role="status" className="text-muted-foreground">
          Laden…
        </p>
      ) : !dagen.length ? (
        <p className="paneel p-4 text-base text-muted-foreground">
          Nog geen cijfers: er liep nog geen campagne.
        </p>
      ) : (
        <section aria-labelledby="rap-dag" className="paneel overflow-x-auto p-4">
          <h2 id="rap-dag" className="text-sectietitel mb-2">
            Per dag
          </h2>
          <table className="w-full min-w-[28rem] text-left text-base">
            <caption className="sr-only">Dagtotalen per campagne</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">
                  Dag
                </th>
                <th scope="col" className="py-2 pr-3">
                  Campagne
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Getoond
                </th>
                <th scope="col" className="py-2 text-right">
                  Bekeken
                </th>
              </tr>
            </thead>
            <tbody>
              {dagen.map((d) => (
                <tr key={`${d.campagne_id}-${d.dag}`} className="border-b border-border/60">
                  <td className="py-2 pr-3">{korteDatum(d.dag)}</td>
                  <td className="py-2 pr-3">{naam.get(d.campagne_id) ?? "–"}</td>
                  <td className="py-2 pr-3 text-right">{n(d.vertoningen)}</td>
                  <td className="py-2 text-right">{n(d.klikken)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
