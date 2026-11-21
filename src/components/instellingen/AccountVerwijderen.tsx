/**
 * Fase 8 — Account verwijderen, met vooraf in gewone taal wat er gebeurt:
 * - per gezin waarvan je eigenaar bent: wie het overneemt, of dat het opgeheven wordt;
 * - wat anoniem bewaard blijft (facturen: boekhouding) en dat er geen bedenktijd is;
 * - na het verwijderen ook alles op dit toestel weg (lokale opslag, offline-kopie, AI-cache).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { KnopRij } from "@/components/mobiel/Lijst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { verwijderGevolgen, verwijderMijnAccount } from "@/lib/account.functions";
import { wisToestelGegevens } from "@/lib/privacy/toestel-wissen";

export function AccountVerwijderen() {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);
  const verwijder = useServerFn(verwijderMijnAccount);
  const gevolgenFn = useServerFn(verwijderGevolgen);
  const gevolgen = useQuery({
    queryKey: ["verwijder-gevolgen"],
    queryFn: () => gevolgenFn(),
    enabled: open,
    retry: false,
  });

  if (!open)
    return (
      <KnopRij
        icoon={Trash2}
        gevaar
        titel="Account verwijderen"
        uitleg="Wist al je gegevens definitief"
        onClick={() => setOpen(true)}
      />
    );

  const gezinnen = gevolgen.data?.gezinnen ?? [];
  return (
    <section
      aria-labelledby="verwijder-titel"
      className="space-y-4 bg-[oklch(0.97_0.02_25)] p-4 dark:bg-transparent"
    >
      <h3 id="verwijder-titel" className="text-lg font-semibold">
        Weet je het zeker?
      </h3>
      <p className="text-base">
        Je account, recepten, weekmenu's, lijsten, voorraad, allergieën, makerprofiel, reacties en
        foto's worden meteen en definitief gewist. Er is geen bedenktijd: dit kan niet ongedaan
        gemaakt worden.
      </p>
      <p className="text-base text-muted-foreground">
        Tip: download eerst je gegevens (hierboven bij "Gegevens en privacy").
      </p>

      <div className="space-y-2">
        <h4 className="text-base font-semibold">Wat gebeurt er met je gezin?</h4>
        {gevolgen.isLoading ? (
          <p className="text-base text-muted-foreground">Even nakijken…</p>
        ) : gevolgen.isError ? (
          <p className="text-base text-muted-foreground">
            Nakijken lukte niet. Gezinnen gaan naar het langst actieve lid, of worden opgeheven als
            er niemand anders is.
          </p>
        ) : gezinnen.length === 0 ? (
          <p className="text-base text-muted-foreground">
            Je bent van geen enkel gezin de eigenaar. Uit een gezin van iemand anders stap je gewoon
            uit; hun spullen blijven.
          </p>
        ) : (
          <ul className="space-y-1.5 text-base" data-testid="gezin-gevolgen">
            {gezinnen.map((g, i) => (
              <li key={i} className="break-words">
                <span className="font-semibold">{g.naam}</span>:{" "}
                {g.opvolger
                  ? `${g.opvolger} wordt de nieuwe eigenaar. De gezinslijst en wat anderen erop zetten, blijven.`
                  : "er is geen ander actief lid, dus het gezin wordt opgeheven (met de gezinslijst en het gezinsmenu)."}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-base text-muted-foreground">
        Facturen blijven 7 jaar bewaard voor de boekhouding, zonder je naam. Op dit toestel wissen
        we daarna ook alles van Foodlo (ook wat "alleen op dit toestel" stond).
      </p>

      <label className="block text-base font-semibold" htmlFor="verwijder-bevestig">
        Typ VERWIJDER om te bevestigen
      </label>
      <Input
        id="verwijder-bevestig"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        className="h-14 text-lg"
        aria-label="Typ VERWIJDER"
        autoCapitalize="characters"
        autoComplete="off"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="min-h-14 text-base" onClick={() => setOpen(false)}>
          Annuleren
        </Button>
        <Button
          variant="destructive"
          className="min-h-14 text-base"
          disabled={tekst.trim() !== "VERWIJDER" || bezig}
          onClick={async () => {
            setBezig(true);
            try {
              await verwijder({ data: { bevestiging: "VERWIJDER" } });
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              await wisToestelGegevens();
              // Volledige herlaadbeurt (alle caches weg); de bevestiging staat op de aanmeldpagina.
              window.location.href = "/aanmelden?verwijderd=1";
            } catch (e) {
              toast.error((e as Error).message);
              setBezig(false);
            }
          }}
        >
          {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Definitief verwijderen
        </Button>
      </div>
    </section>
  );
}
