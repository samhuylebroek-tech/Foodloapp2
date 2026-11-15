import { useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { PartnerKader, PartnerKop, PartnerProvider } from "@/components/partner/PartnerShell";
import { Keuze, Veld } from "@/components/partner/Velden";
import { Button } from "@/components/ui/button";
import { dienAanvraagIn, haalMijnAanvraag, haalMijnLidmaatschappen } from "@/lib/partners-db";
import { PARTNER_SOORTEN, veiligeWebsite } from "@/lib/partners";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Partneromgeving – Foodlo" },
      {
        name: "description",
        content: "Zakelijke omgeving voor merken, producenten, winkels en restaurants op Foodlo.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PartnerLayout,
});

function PartnerLayout() {
  const { user, loading } = useAuth();
  const { beschikbaar, laden } = useModuleBeschikbaar("partners");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partner-lidmaatschap", user?.id],
    enabled: !!user && beschikbaar,
    queryFn: () => haalMijnLidmaatschappen(user!.id),
  });

  if (loading || laden || (user && beschikbaar && isLoading)) {
    return (
      <PartnerKader>
        <p role="status" className="text-base text-muted-foreground">
          Laden…
        </p>
      </PartnerKader>
    );
  }
  if (!user) {
    return (
      <PartnerKader>
        <PartnerKop
          titel="Partneromgeving"
          uitleg="Meld je aan met het account waarmee je organisatie bij Foodlo geregistreerd is."
        />
        <Button asChild className="h-14 px-6 text-base">
          <Link to="/aanmelden">Aanmelden</Link>
        </Button>
      </PartnerKader>
    );
  }
  if (!beschikbaar) {
    return (
      <PartnerKader>
        <ModuleNietBeschikbaar naam="De partneromgeving" />
      </PartnerKader>
    );
  }
  if (isError) {
    return (
      <PartnerKader>
        <p className="paneel p-4 text-base">De partneromgeving kon niet geladen worden.</p>
        <Button variant="outline" className="h-14 px-6 text-base" onClick={() => void refetch()}>
          Opnieuw proberen
        </Button>
      </PartnerKader>
    );
  }
  const eerste = data?.[0];
  if (!eerste) {
    return (
      <PartnerKader>
        <GeenPartner userId={user.id} />
      </PartnerKader>
    );
  }
  return (
    <PartnerProvider partner={eerste.partner} lid={eerste.lid}>
      <PartnerKader partner={eerste.partner} rol={eerste.lid.rol}>
        <Outlet />
      </PartnerKader>
    </PartnerProvider>
  );
}

/** Geen partnerrol: uitleg en een aanvraagformulier (rij in partner_aanvragen). */
function GeenPartner({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: aanvraag, isLoading } = useQuery({
    queryKey: ["partner-aanvraag", userId],
    queryFn: () => haalMijnAanvraag(userId),
  });
  const [bedrijf, setBedrijf] = useState("");
  const [soort, setSoort] = useState("producent");
  const [website, setWebsite] = useState("");
  const [bericht, setBericht] = useState("");
  const websiteFout =
    website.trim() && !veiligeWebsite(website) ? "Gebruik een https-adres." : null;

  const verstuur = useMutation({
    mutationFn: () =>
      dienAanvraagIn({
        user_id: userId,
        bedrijfsnaam: bedrijf.trim(),
        soort,
        website: veiligeWebsite(website),
        bericht: bericht.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Aanvraag verstuurd. Het Foodlo-team neemt contact op.");
      void qc.invalidateQueries({ queryKey: ["partner-aanvraag", userId] });
    },
    onError: () => toast.error("Je aanvraag kon niet verstuurd worden. Probeer het opnieuw."),
  });

  return (
    <div className="space-y-5">
      <PartnerKop
        titel="Partneromgeving"
        uitleg="Hier werken merken, producenten, winkels en restaurants samen met Foodlo: producten koppelen aan ingrediënten, campagnes voorstellen en samenwerken met makers."
      />
      <div className="paneel space-y-2 p-4 text-base">
        <p className="font-semibold">Je account heeft nog geen partnerrol.</p>
        <p className="text-muted-foreground">
          Aanmelden als partner kan via het formulier hieronder. Het Foodlo-team controleert elke
          organisatie voor ze toegang krijgt. Commerciële inhoud is op Foodlo altijd duidelijk
          gelabeld, en partners zien nooit persoonsgegevens van gebruikers.
        </p>
      </div>
      {isLoading ? null : aanvraag ? (
        <div role="status" className="paneel flex items-start gap-3 p-4 text-base">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-semibold">Je aanvraag voor {aanvraag.bedrijfsnaam} is ontvangen.</p>
            <p className="text-muted-foreground">
              Status: {aanvraag.status === "nieuw" ? "wacht op het Foodlo-team" : aanvraag.status}.
              Je hoeft niets meer te doen.
            </p>
          </div>
        </div>
      ) : (
        <form
          aria-label="Aanvraag partner worden"
          className="paneel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (bedrijf.trim().length >= 2 && !websiteFout) verstuur.mutate();
          }}
        >
          <h2 className="text-sectietitel">Partner worden</h2>
          <Veld label="Naam van je organisatie" waarde={bedrijf} onWijzig={setBedrijf} verplicht />
          <Keuze
            label="Soort organisatie"
            waarde={soort}
            onWijzig={setSoort}
            opties={PARTNER_SOORTEN}
          />
          <Veld
            label="Website (niet verplicht)"
            waarde={website}
            onWijzig={setWebsite}
            fout={websiteFout}
            type="url"
          />
          <Veld
            label="Wat wil je met Foodlo doen? (niet verplicht)"
            waarde={bericht}
            onWijzig={setBericht}
            meerRegels
          />
          <Button
            type="submit"
            className="h-14 w-full px-6 text-base sm:w-auto"
            disabled={bedrijf.trim().length < 2 || !!websiteFout || verstuur.isPending}
          >
            Aanvraag versturen
          </Button>
        </form>
      )}
    </div>
  );
}
