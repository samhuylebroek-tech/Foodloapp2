/**
 * Voorbereiding op makerabonnementen (COMMERCIAL_ROADMAP §3): uitleg en een testinstelling
 * "prijs per maand" met de verdeling tussen btw, betaalkosten, platform en maker. Er wordt niets
 * bewaard, niets verkocht en niets uitbetaald (KYC, btw en uitbetaling nog niet gekoppeld).
 */
import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { TestmodusBand } from "@/components/TestmodusBand";
import { FEE_VOORSTEL, leesPrijs, verdeelOpbrengst } from "@/lib/betalen/fee";
import { euro } from "@/lib/betalen/types";

export function MakerAbonnees() {
  const id = useId();
  const [invoer, setInvoer] = useState("3,99");
  const prijs = leesPrijs(invoer);
  const v = prijs ? verdeelOpbrengst(prijs) : null;
  return (
    <section aria-labelledby={`${id}-titel`} className="space-y-3">
      <h2 id={`${id}-titel`} className="text-sectietitel">
        Abonnees
      </h2>
      <TestmodusBand>
        Fans kunnen je later volgen met een betaald abonnement voor extra recepten en weekmenu's.
        Dit staat nog uit: er wordt niets verkocht of uitbetaald.
      </TestmodusBand>
      <div className="paneel space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-aan`} className="text-base font-semibold">
            Abonnees toelaten
          </label>
          <Switch id={`${id}-aan`} checked={false} disabled aria-describedby={`${id}-uit`} />
        </div>
        <p id={`${id}-uit`} className="text-[0.95rem] text-muted-foreground">
          Kan pas aan na identiteitscontrole (KYC), btw-registratie en koppeling van een
          betaalprovider.
        </p>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-prijs`} className="block text-base font-semibold">
            Testprijs per maand (niet bewaard)
          </label>
          <Input
            id={`${id}-prijs`}
            inputMode="decimal"
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            aria-invalid={prijs ? undefined : true}
            aria-describedby={`${id}-prijs-hulp`}
            className="min-h-14 max-w-40 text-base"
          />
          <p id={`${id}-prijs-hulp`} className="text-[0.95rem] text-muted-foreground">
            {prijs ? "Tussen € 1 en € 50." : "Geef een bedrag tussen € 1 en € 50, bv. 3,99."}
          </p>
        </div>
        {v ? (
          <dl aria-label="Verdeling per abonnee per maand" className="grid gap-1 text-base">
            {[
              ["Abonnee betaalt", v.prijsCent],
              [`Btw (${FEE_VOORSTEL.btwProcent}%)`, v.btwCent],
              ["Betaalkosten (schatting)", v.betaalkostenCent],
              [`Foodlo-platform (${FEE_VOORSTEL.platformProcent}%)`, v.platformCent],
            ].map(([l, c]) => (
              <div
                key={String(l)}
                className="flex justify-between gap-3 border-b border-border/60 py-1"
              >
                <dt>{l}</dt>
                <dd>{euro(Number(c))}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 py-1 font-semibold">
              <dt>Jij krijgt</dt>
              <dd>{euro(v.makerCent)}</dd>
            </div>
          </dl>
        ) : null}
        <p className="text-[0.95rem] text-muted-foreground">
          Voorstel: percentages en btw-regels worden pas vastgelegd na juridische en fiscale
          controle.
        </p>
      </div>
    </section>
  );
}
