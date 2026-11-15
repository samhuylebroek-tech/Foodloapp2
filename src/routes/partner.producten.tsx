import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlleenLezen, PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { Veld } from "@/components/partner/Velden";
import { Button } from "@/components/ui/button";
import { bewaarProduct, haalProducten, verwijderProduct } from "@/lib/partners-db";
import type { PartnerProduct } from "@/lib/partners";

export const Route = createFileRoute("/partner/producten")({ component: Producten });

type Concept = { id?: string; naam: string; ingredient: string; ean: string };
const LEEG: Concept = { naam: "", ingredient: "", ean: "" };

function eanFout(ean: string) {
  const t = ean.trim();
  if (!t) return null;
  return /^\d{8}$|^\d{12,14}$/.test(t) ? null : "Een EAN-code heeft 8, 12, 13 of 14 cijfers.";
}

function Producten() {
  const { partner, mag } = usePartner();
  const qc = useQueryClient();
  const sleutel = ["partner", partner.id, "producten"];
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: sleutel,
    queryFn: () => haalProducten(partner.id),
  });
  const magBewerken = mag("producten.bewerken");
  const [concept, setConcept] = useState<Concept | null>(null);
  const ververs = () => qc.invalidateQueries({ queryKey: sleutel });

  const bewaar = useMutation({
    mutationFn: (c: Concept) =>
      bewaarProduct({
        ...(c.id ? { id: c.id } : {}),
        partner_id: partner.id,
        naam: c.naam,
        ingredient_koppeling: c.ingredient,
        ean: c.ean || null,
      }),
    onSuccess: () => {
      toast.success("Product bewaard.");
      setConcept(null);
      void ververs();
    },
    onError: () => toast.error("Het product kon niet bewaard worden."),
  });
  const weg = useMutation({
    mutationFn: (p: PartnerProduct) => verwijderProduct(p),
    onSuccess: (herstel, p) => {
      void ververs();
      toast.success(`${p.naam} verwijderd.`, {
        action: {
          label: "Ongedaan maken",
          onClick: () => void herstel().then(ververs),
        },
      });
    },
    onError: () => toast.error("Het product kon niet verwijderd worden."),
  });

  const fouten = concept
    ? {
        naam: concept.naam.trim().length < 2 ? "Geef het product een naam." : null,
        ingredient:
          concept.ingredient.trim().length < 2
            ? "Aan welk ingrediënt hoort dit product? Bv. pompoen."
            : null,
        ean: eanFout(concept.ean),
      }
    : null;
  const geldig = fouten && !fouten.naam && !fouten.ingredient && !fouten.ean;

  return (
    <>
      <PartnerKop
        titel="Producten"
        uitleg="Koppel je producten aan een ingrediëntnaam. Zo kan Foodlo ze later bij dat ingrediënt tonen, altijd gelabeld."
      />
      {!magBewerken ? <AlleenLezen wat="producten" /> : null}
      {magBewerken && !concept ? (
        <Button className="h-14 px-6 text-base" onClick={() => setConcept(LEEG)}>
          Product toevoegen
        </Button>
      ) : null}
      {concept ? (
        <form
          aria-label={concept.id ? "Product aanpassen" : "Nieuw product"}
          className="paneel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (geldig) bewaar.mutate(concept);
          }}
        >
          <h2 className="text-sectietitel">{concept.id ? "Product aanpassen" : "Nieuw product"}</h2>
          <Veld
            label="Productnaam"
            waarde={concept.naam}
            onWijzig={(v) => setConcept({ ...concept, naam: v })}
            fout={concept.naam ? fouten?.naam : null}
            verplicht
          />
          <Veld
            label="Hoort bij ingrediënt"
            uitleg="De gewone naam zoals in een recept, bv. pompoen of bloem."
            waarde={concept.ingredient}
            onWijzig={(v) => setConcept({ ...concept, ingredient: v })}
            fout={concept.ingredient ? fouten?.ingredient : null}
            verplicht
          />
          <Veld
            label="EAN-code (niet verplicht)"
            waarde={concept.ean}
            onWijzig={(v) => setConcept({ ...concept, ean: v })}
            fout={fouten?.ean}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="h-14 px-6 text-base"
              disabled={!geldig || bewaar.isPending}
            >
              Product bewaren
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
        <p className="paneel p-4">De producten konden niet geladen worden.</p>
      ) : !data.length ? (
        <p className="paneel p-4 text-base text-muted-foreground">Nog geen producten.</p>
      ) : (
        <ul aria-label="Jouw producten" className="space-y-2">
          {data.map((p) => (
            <li key={p.id} className="paneel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold break-words">{p.naam}</p>
                <p className="text-[0.95rem] text-muted-foreground">
                  Hoort bij: {p.ingredient_koppeling}
                  {p.ean ? ` · EAN ${p.ean}` : ""}
                </p>
              </div>
              {magBewerken ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="min-h-12"
                    aria-label={`${p.naam} aanpassen`}
                    onClick={() =>
                      setConcept({
                        id: p.id,
                        naam: p.naam,
                        ingredient: p.ingredient_koppeling,
                        ean: p.ean ?? "",
                      })
                    }
                  >
                    Aanpassen
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12"
                    aria-label={`${p.naam} verwijderen`}
                    onClick={() => weg.mutate(p)}
                  >
                    Verwijderen
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
