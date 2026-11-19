/**
 * P4 — Instellingen › Suggesties: welke tips Foodlo uit zichzelf toont (per soort aan/uit) en
 * verborgen kaarten terughalen. Op je account na voorstel 0016, anders op dit toestel.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Groep } from "@/components/mobiel/Lijst";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSuggesties } from "@/hooks/useSuggesties";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { isAan, SUGGESTIE_SOORTEN, type SuggestieSoort } from "@/lib/suggesties";
import { useMeldingInstellingen } from "@/hooks/useMeldingInstellingen";
import { meldingAan, MELDING_SOORTEN, type MeldingSoort } from "@/lib/samenwerking/meldingen";

export const Route = createFileRoute("/instellingen_/suggesties")({
  head: () => ({
    meta: [
      { title: "Suggesties en meldingen – Foodlo" },
      {
        name: "description",
        content:
          "Kies welke tips Foodlo je uit zichzelf toont en welke meldingen je in de app krijgt.",
      },
    ],
  }),
  component: SuggestiesPagina,
});

function SuggestiesPagina() {
  const sug = useSuggesties();
  const [slim] = useSlimmeVoorstellen();
  const mld = useMeldingInstellingen();

  async function zetMelding(soort: MeldingSoort, aan: boolean, label: string) {
    try {
      await mld.zet(soort, aan);
      toast.success(`${label}: ${aan ? "aan" : "uit"}`);
    } catch {
      toast.error("Bewaren lukte niet. Er is niets veranderd.");
    }
  }

  async function zet(soort: SuggestieSoort, aan: boolean, label: string) {
    try {
      await sug.zet(soort, aan);
      toast.success(`${label}: ${aan ? "aan" : "uit"}`);
    } catch {
      toast.error("Bewaren lukte niet. Er is niets veranderd.");
    }
  }

  return (
    <AppShell
      title="Suggesties en meldingen"
      ondertitel="Kies welke tips Foodlo je uit zichzelf toont en welke meldingen je krijgt."
    >
      <div className="mx-auto max-w-2xl space-y-7 pb-8">
        <Link
          to="/instellingen"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Instellingen
        </Link>
        {!slim ? (
          <p
            role="note"
            className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              "Slimme voorstellen" staat uit. Dan toont Foodlo geen enkele suggestie, wat je hier
              ook kiest. Zet het weer aan bij{" "}
              <Link to="/instellingen" className="font-semibold underline underline-offset-4">
                Instellingen
              </Link>
              .
            </span>
          </p>
        ) : null}
        {sug.laden ? (
          <PageSkeleton />
        ) : (
          <>
            <Groep
              titel="Op Vandaag"
              voet={`Foodlo toont hooguit één suggestie tegelijk. Een suggestie verandert nooit zelf iets: wil je iets aanpassen, dan krijg je eerst een voorstel. ${
                sug.opslag === "account"
                  ? "Deze keuzes staan op je account."
                  : "Deze keuzes gelden op dit toestel."
              }`}
            >
              {SUGGESTIE_SOORTEN.map((s) => (
                <label key={s.id} className="block cursor-pointer px-4 py-3">
                  {/* Schakelaar naast de naam; de uitleg eronder over de volle breedte (200 %). */}
                  <span className="flex min-h-12 items-center gap-3.5">
                    <span className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug break-words hyphens-auto">
                      {s.label}
                    </span>
                    <Switch
                      checked={isAan(sug.inst, s.id)}
                      onCheckedChange={(aan) => void zet(s.id, aan, s.label)}
                    />
                  </span>
                  <span className="mt-1 block text-[0.95rem] text-muted-foreground">
                    {s.uitleg}
                  </span>
                </label>
              ))}
            </Groep>
            <Groep
              titel="Verborgen suggesties"
              voet='Met "Niet meer tonen" verberg je één kaart. Een nieuwe situatie (een ander restje, een andere week) geeft een nieuwe kaart.'
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-base" data-testid="aantal-verborgen">
                  {sug.inst.verborgen.length
                    ? `${sug.inst.verborgen.length} ${sug.inst.verborgen.length === 1 ? "kaart" : "kaarten"} verborgen`
                    : "Geen verborgen kaarten"}
                </p>
                {sug.inst.verborgen.length ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void sug
                        .toonVerborgen()
                        .then(() => toast.success("Verborgen suggesties komen weer terug"))
                        .catch(() => toast.error("Dat lukte niet. Probeer het opnieuw."))
                    }
                  >
                    Toon ze weer
                  </Button>
                ) : null}
              </div>
            </Groep>
            {/* P5: meldingen in de app (bel bovenaan), per soort aan/uit. Nooit naar buiten. */}
            <div id="meldingen" className="scroll-mt-24">
              <Groep
                titel="Meldingen in de app"
                voet={`Deze meldingen zie je bij de bel bovenaan. Ze gaan niet naar je telefoon of e-mail; herinneringen op je telefoon kies je apart bij "Herinneringen op je telefoon". Een melding noemt nooit waarom iets niet veilig is voor iemand. ${
                  mld.opslag === "account"
                    ? "Deze keuzes staan op je account."
                    : "Deze keuzes gelden op dit toestel."
                }`}
              >
                {MELDING_SOORTEN.map((s) => (
                  <label key={s.id} className="block cursor-pointer px-4 py-3">
                    <span className="flex min-h-12 items-center gap-3.5">
                      <span className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug break-words hyphens-auto">
                        {s.label}
                      </span>
                      <Switch
                        checked={meldingAan(mld.inst, s.id)}
                        onCheckedChange={(aan) => void zetMelding(s.id, aan, s.label)}
                      />
                    </span>
                    <span className="mt-1 block text-[0.95rem] text-muted-foreground">
                      {s.uitleg}
                    </span>
                  </label>
                ))}
              </Groep>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
