import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlleenLezen, PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { Keuze, Veld } from "@/components/partner/Velden";
import { Button } from "@/components/ui/button";
import { bewaarPartner } from "@/lib/partners-db";
import { PARTNER_SOORTEN, veiligeWebsite, type PartnerSoort } from "@/lib/partners";

export const Route = createFileRoute("/partner/profiel")({ component: Profiel });

const VERIFICATIE = {
  aangevraagd: "Wacht op verificatie door het Foodlo-team",
  geverifieerd: "Geverifieerd door het Foodlo-team",
  geweigerd: "Niet geverifieerd — neem contact op met het Foodlo-team",
} as const;

function Profiel() {
  const { partner, mag } = usePartner();
  const qc = useQueryClient();
  const magBewerken = mag("profiel.bewerken");
  const [naam, setNaam] = useState(partner.naam);
  const [soort, setSoort] = useState<PartnerSoort>(partner.soort);
  const [website, setWebsite] = useState(partner.website ?? "");
  const [omschrijving, setOmschrijving] = useState(partner.omschrijving ?? "");
  const websiteFout =
    website.trim() && !veiligeWebsite(website) ? "Gebruik een https-adres." : null;
  const naamFout = naam.trim().length < 2 ? "Geef een naam van minstens 2 tekens." : null;

  const bewaar = useMutation({
    mutationFn: () =>
      bewaarPartner(partner.id, {
        naam: naam.trim(),
        soort,
        website: veiligeWebsite(website),
        logo_url: partner.logo_url,
        omschrijving: omschrijving.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Bedrijfsprofiel bewaard.");
      void qc.invalidateQueries({ queryKey: ["partner-lidmaatschap"] });
    },
    onError: () => toast.error("Het profiel kon niet bewaard worden."),
  });

  return (
    <>
      <PartnerKop
        titel="Bedrijfsprofiel"
        uitleg="Zo staat je organisatie bij gesponsorde inhoud."
      />
      <p className="paneel p-4 text-base">
        <span className="font-semibold">Verificatie:</span>{" "}
        {VERIFICATIE[partner.verificatie_status]}
      </p>
      {!magBewerken ? <AlleenLezen wat="het bedrijfsprofiel" /> : null}
      <form
        aria-label="Bedrijfsprofiel"
        className="paneel space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!naamFout && !websiteFout && magBewerken) bewaar.mutate();
        }}
      >
        <Veld
          label="Naam"
          waarde={naam}
          onWijzig={setNaam}
          fout={naamFout}
          disabled={!magBewerken}
          verplicht
        />
        <Keuze
          label="Soort organisatie"
          waarde={soort}
          onWijzig={setSoort}
          opties={PARTNER_SOORTEN}
          disabled={!magBewerken}
        />
        <Veld
          label="Website"
          waarde={website}
          onWijzig={setWebsite}
          fout={websiteFout}
          disabled={!magBewerken}
          type="url"
        />
        <Veld
          label="Korte omschrijving"
          waarde={omschrijving}
          onWijzig={setOmschrijving}
          disabled={!magBewerken}
          meerRegels
          uitleg="Eén of twee zinnen, zonder gezondheidsclaims."
        />
        {magBewerken ? (
          <Button
            type="submit"
            className="h-14 px-6 text-base"
            disabled={!!naamFout || !!websiteFout || bewaar.isPending}
          >
            Profiel bewaren
          </Button>
        ) : null}
      </form>
    </>
  );
}
