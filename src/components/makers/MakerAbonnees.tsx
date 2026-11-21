/**
 * Fase 4 — makerabonnement in TESTMODUS (COMMERCIAL_ROADMAP §3): de maker zet een testprijs en
 * voordelen, kiest welke recepten exclusief zijn (bij elk recept) en ziet wie er abonnee is
 * (alleen voornaam en sinds wanneer). Er wordt niets aangerekend en niets uitbetaald; echte
 * betalingen pas na KYC, btw-registratie en koppeling van een betaalprovider (gate G5).
 */
import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TestmodusBand } from "@/components/TestmodusBand";
import { FEE_VOORSTEL, leesPrijs, verdeelOpbrengst } from "@/lib/betalen/fee";
import { makerPrijsGrenzen } from "@/lib/betalen/prijzen";
import { euro } from "@/lib/betalen/types";
import { valideerMakerPlan, type MakerPlan } from "@/lib/betalen/maker-abonnement";
import { mijnMakerAbonnees } from "@/lib/betalen/maker-abonnement.functions";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import type { Maker } from "@/lib/makers";

export const MAKER_PLAN_SLEUTEL = "maker-plan";

export async function haalMakerPlan(creatorId: string): Promise<MakerPlan | null> {
  const { data, error } = await db
    .from("maker_plannen")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  return (data as MakerPlan | null) ?? null;
}

export function MakerAbonnees({ maker }: { maker: Maker }) {
  const id = useId();
  const qc = useQueryClient();
  const { beschikbaar } = useModuleBeschikbaar("maker_plannen");
  const planQ = useQuery({
    queryKey: [MAKER_PLAN_SLEUTEL, maker.id],
    enabled: beschikbaar,
    queryFn: () => haalMakerPlan(maker.id),
  });
  const haalAbonnees = useServerFn(mijnMakerAbonnees);
  const abonneesQ = useQuery({
    queryKey: ["mijn-abonnees", maker.id],
    enabled: beschikbaar,
    queryFn: () => haalAbonnees(),
  });
  const plan = planQ.data ?? null;
  const [aan, setAan] = useState(false);
  const [invoer, setInvoer] = useState("3,99");
  const [voordelen, setVoordelen] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    if (!plan) return;
    setAan(plan.actief);
    setInvoer((plan.prijs_cent / 100).toFixed(2).replace(".", ","));
    setVoordelen(plan.voordelen.join("\n"));
  }, [plan]);

  const prijs = leesPrijs(invoer);
  const v = prijs ? verdeelOpbrengst(prijs) : null;

  async function bewaar() {
    const r = valideerMakerPlan(invoer, voordelen);
    if ("fout" in r) return setFout(r.fout);
    setFout(null);
    setBezig(true);
    try {
      const { error } = await db.from("maker_plannen").upsert(
        {
          creator_id: maker.id,
          prijs_cent: r.prijs_cent,
          voordelen: r.voordelen,
          actief: aan,
          modus: "test",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "creator_id" },
      );
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: [MAKER_PLAN_SLEUTEL, maker.id] });
      await qc.invalidateQueries({ queryKey: ["maker-abonnement"] });
      toast.success(
        aan ? "Abonnement bewaard (testmodus)" : "Bewaard: fans kunnen zich nu niet abonneren",
      );
    } catch {
      toast.error("Bewaren lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  if (!beschikbaar) return null;
  const ab = abonneesQ.data;

  return (
    <section aria-labelledby={`${id}-titel`} className="space-y-3" data-testid="maker-abonnement">
      <h2 id={`${id}-titel`} className="text-sectietitel">
        Abonnement voor fans
      </h2>
      <TestmodusBand>
        Er wordt niets aangerekend en niets uitbetaald. Fans kunnen zich in testmodus abonneren om
        je exclusieve recepten te zien. Echt verkopen kan pas na identiteitscontrole (KYC),
        btw-registratie en koppeling van een betaalprovider.
      </TestmodusBand>
      <div className="paneel space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-aan`} className="text-base font-semibold">
            Abonnement aanbieden (testmodus)
          </label>
          <Switch id={`${id}-aan`} checked={aan} onCheckedChange={setAan} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-prijs`} className="block text-base font-semibold">
            Testprijs per maand (inclusief btw)
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
            {prijs
              ? `Tussen ${makerPrijsGrenzen()}.`
              : `Geef een bedrag tussen ${makerPrijsGrenzen()}, bv. 3,99.`}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-voordelen`} className="block text-base font-semibold">
            Wat krijgen abonnees? (één per regel, hoogstens 5)
          </label>
          <Textarea
            id={`${id}-voordelen`}
            value={voordelen}
            onChange={(e) => setVoordelen(e.target.value)}
            placeholder={"Elke week een exclusief recept\nMijn weekmenu als collectie"}
            className="min-h-24 text-base"
          />
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
          controle. Welke recepten exclusief zijn, kies je hierboven bij elk recept.
        </p>
        {fout ? (
          <p role="alert" className="text-base font-semibold text-destructive">
            {fout}
          </p>
        ) : null}
        <Button disabled={bezig} onClick={() => void bewaar()} className="h-14 px-6 text-base">
          {bezig ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Abonnement bewaren
        </Button>
      </div>

      <div className="paneel space-y-2 p-4" aria-live="polite">
        <h3 className="text-base font-semibold">Je abonnees</h3>
        {abonneesQ.isLoading ? (
          <Loader2 className="size-6 animate-spin" aria-label="Laden" />
        ) : !ab?.abonnees.length ? (
          <p className="text-base text-muted-foreground">Nog geen abonnees.</p>
        ) : (
          <>
            <p className="text-base">
              {ab.aantal} {ab.aantal === 1 ? "actieve abonnee" : "actieve abonnees"} · jouw deel
              geschat {euro(ab.schattingMakerCent)} per maand (testmodus)
            </p>
            <ul className="divide-y divide-border/60">
              {ab.abonnees.map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-base">
                  <span className="font-semibold">{a.voornaam}</span>
                  <span className="text-muted-foreground">
                    sinds{" "}
                    {new Date(a.sinds).toLocaleDateString("nl-BE", {
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {a.status === "actief" ? "loopt" : "opgezegd"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[0.95rem] text-muted-foreground">
          Je ziet alleen de voornaam en sinds wanneer. Geen e-mailadressen en geen betaalgegevens.
        </p>
      </div>
    </section>
  );
}
