import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AlleenLezen, PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { Keuze } from "@/components/partner/Velden";
import { Button } from "@/components/ui/button";
import {
  haalCampagnes,
  haalItems,
  haalProducten,
  haalSponsorbareRecepten,
  koppelItem,
  ontkoppelItem,
} from "@/lib/partners-db";
import { campagneBewerkbaar, STATUS_LABEL } from "@/lib/partners";

export const Route = createFileRoute("/partner/gesponsord")({
  validateSearch: z.object({ campagne: z.string().optional() }),
  component: Gesponsord,
});

function Gesponsord() {
  const { partner, mag } = usePartner();
  const { campagne: gekozenUitUrl } = Route.useSearch();
  const qc = useQueryClient();
  const magBewerken = mag("campagnes.bewerken");
  const { data: campagnes = [], isLoading } = useQuery({
    queryKey: ["partner", partner.id, "campagnes"],
    queryFn: () => haalCampagnes(partner.id),
  });
  const ids = campagnes.map((c) => c.id);
  const { data: items = [] } = useQuery({
    queryKey: ["partner", partner.id, "items", ids.join(",")],
    enabled: campagnes.length > 0,
    queryFn: () => haalItems(ids),
  });
  const { data: recepten = [] } = useQuery({
    queryKey: ["partner", "sponsorbare-recepten"],
    queryFn: haalSponsorbareRecepten,
  });
  const { data: producten = [] } = useQuery({
    queryKey: ["partner", partner.id, "producten"],
    queryFn: () => haalProducten(partner.id),
  });
  const titel = new Map(recepten.map((r) => [r.id, r.title]));
  const concepten = campagnes.filter(campagneBewerkbaar);
  const [campagneId, setCampagneId] = useState<string>("");
  const actieveCampagne = campagneId || gekozenUitUrl || concepten[0]?.id || "";
  const [soort, setSoort] = useState<"recept" | "product">("recept");
  const [keuze, setKeuze] = useState("");
  const ververs = () => qc.invalidateQueries({ queryKey: ["partner", partner.id] });

  const koppel = useMutation({
    mutationFn: () =>
      koppelItem(
        soort === "recept"
          ? { campagne_id: actieveCampagne, soort, recipe_id: keuze, product_naam: null }
          : {
              campagne_id: actieveCampagne,
              soort,
              recipe_id: null,
              product_naam: producten.find((p) => p.id === keuze)?.naam ?? null,
            },
      ),
    onSuccess: () => {
      toast.success("Gekoppeld aan de campagne.");
      setKeuze("");
      void ververs();
    },
    onError: () => toast.error("Koppelen lukte niet."),
  });
  const ontkoppel = useMutation({
    mutationFn: (id: string) => ontkoppelItem(id),
    onSuccess: () => {
      toast.success("Losgekoppeld.");
      void ververs();
    },
  });

  const opties =
    soort === "recept"
      ? recepten.map((r) => ({ waarde: r.id, label: r.title }))
      : producten.map((p) => ({ waarde: p.id, label: `${p.naam} (${p.ingredient_koppeling})` }));

  return (
    <>
      <PartnerKop
        titel="Gesponsorde content"
        uitleg="Koppel een openbaar recept of een van je producten aan een campagne. Op Foodlo staat dit altijd met het label “Gesponsord” en “In samenwerking met”, op één vaste plek in Ontdek."
      />
      {!magBewerken ? <AlleenLezen wat="gesponsorde content" /> : null}
      {magBewerken ? (
        isLoading ? null : !concepten.length ? (
          <p className="paneel p-4 text-base text-muted-foreground">
            Koppelen kan alleen aan een campagne die nog een concept is. Maak eerst een campagne
            aan.
          </p>
        ) : (
          <form
            aria-label="Inhoud koppelen"
            className="paneel space-y-4 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (keuze && actieveCampagne) koppel.mutate();
            }}
          >
            <Keuze
              label="Campagne"
              waarde={actieveCampagne}
              onWijzig={setCampagneId}
              opties={concepten.map((c) => ({ waarde: c.id, label: c.naam }))}
            />
            <Keuze
              label="Wat wil je koppelen?"
              waarde={soort}
              onWijzig={(v) => {
                setSoort(v);
                setKeuze("");
              }}
              opties={[
                { waarde: "recept", label: "Een openbaar recept" },
                { waarde: "product", label: "Een van je producten" },
              ]}
            />
            <Keuze
              label={soort === "recept" ? "Recept" : "Product"}
              waarde={keuze}
              onWijzig={setKeuze}
              opties={[{ waarde: "", label: "Kies…" }, ...opties]}
            />
            <Button
              type="submit"
              className="h-14 px-6 text-base"
              disabled={!keuze || koppel.isPending}
            >
              Koppelen aan campagne
            </Button>
          </form>
        )
      ) : null}
      <section aria-labelledby="gk-lijst" className="space-y-3">
        <h2 id="gk-lijst" className="text-sectietitel">
          Per campagne
        </h2>
        {campagnes.map((c) => {
          const eigen = items.filter((i) => i.campagne_id === c.id);
          return (
            <div key={c.id} className="paneel space-y-2 p-4">
              <p className="font-semibold">
                {c.naam}{" "}
                <span className="font-normal text-muted-foreground">
                  · {STATUS_LABEL[c.status]}
                </span>
              </p>
              {!eigen.length ? (
                <p className="text-base text-muted-foreground">Nog niets gekoppeld.</p>
              ) : (
                <ul className="space-y-2">
                  {eigen.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base">
                        <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.9rem] font-semibold text-amber-950">
                          {i.label_tekst}
                        </span>
                        {i.soort === "recept"
                          ? `Recept: ${titel.get(i.recipe_id ?? "") ?? "recept"}`
                          : `Product: ${i.product_naam}`}
                      </span>
                      {magBewerken && campagneBewerkbaar(c) ? (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          onClick={() => ontkoppel.mutate(i.id)}
                        >
                          Loskoppelen
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
