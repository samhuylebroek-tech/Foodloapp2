/**
 * P4 — Assistent met acties ("Vraag de assistent"), bereikbaar vanaf Vandaag, Week en Lijst.
 *
 * Je vraagt iets over je week ("maak mijn week goedkoper", "vervang woensdag" …). Foodlo
 * herkent het met vaste regels (zonder AI), maakt via de planner-engine een voorstel met de
 * verschillen en voert pas iets uit na "Doe maar" (één keer ongedaan maken). "Nee" verandert
 * niets. Redenen van gezinsleden die niet gedeeld zijn, staan nergens.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { haalVerzameling } from "@/lib/makers-db";
import { ArrowLeft, MessageCircleQuestion, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { VoorstelKaart, type KaartStand } from "@/components/assistent/VoorstelKaart";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAssistentContext } from "@/hooks/useAssistentContext";
import {
  maakActieVoorstel,
  nieuweRecepten,
  onveiligInVoorstel,
  type Voorstel,
} from "@/lib/assistent/acties";
import { isDemoOmgeving } from "@/lib/assistent/adapter";
import { DAGLIMIET, nogVandaag, registreerVraag } from "@/lib/assistent/gebruik";
import { herken, TestHerkenner, type HerkenBron } from "@/lib/assistent/herkenner";
import { omschrijf, VOORBEELDEN } from "@/lib/assistent/opdrachten";
import { voerVoorstelUit, type Uitvoering } from "@/lib/assistent/uitvoeren";
import { dagNaam } from "@/lib/assistent/acties";
import { euro } from "@/lib/budget";
import { HalfGelukt, lijstUitleg } from "@/lib/kringloop-db";
import { bewaarToestelEters } from "@/lib/maaltijd-eters";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { onveiligeGerechten } from "@/lib/planner/servercontrole";
import { lokaleDatum } from "@/lib/tijd";
import { bewaarEters, serverOordeel } from "@/lib/voeding-db";

type Van = "vandaag" | "week" | "lijst";
type Zoek = { van?: Van; vraag?: string; verzameling?: string };

export const Route = createFileRoute("/assistent")({
  validateSearch: (s: Record<string, unknown>): Zoek => ({
    ...(s["van"] === "vandaag" || s["van"] === "week" || s["van"] === "lijst"
      ? { van: s["van"] }
      : {}),
    ...(typeof s["vraag"] === "string" && s["vraag"].trim()
      ? { vraag: s["vraag"].slice(0, 200) }
      : {}),
    ...(typeof s["verzameling"] === "string" && /^[0-9a-f-]{36}$/i.test(s["verzameling"])
      ? { verzameling: s["verzameling"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Assistent – Foodlo" },
      {
        name: "description",
        content: "Vraag Foodlo je week aan te passen: goedkoper, sneller, iemand eet mee …",
      },
    ],
  }),
  component: AssistentPagina,
});

const TERUG: Record<Van, { to: "/" | "/planner" | "/boodschappen"; tekst: string }> = {
  vandaag: { to: "/", tekst: "Terug naar Vandaag" },
  week: { to: "/planner", tekst: "Terug naar Week" },
  lijst: { to: "/boodschappen", tekst: "Terug naar je lijst" },
};

const BRON: Record<HerkenBron, string> = {
  regels: "Zonder AI: vaste regels van Foodlo",
  test: "Testmodus: vast voorbeeld, geen echte AI",
  ai: "Slimme hulp (AI) heeft je vraag herkend",
};

type Bericht =
  | { id: string; wie: "jij"; tekst: string }
  | {
      id: string;
      wie: "foodlo";
      tekst: string;
      bron: HerkenBron;
      voorstel?: Voorstel;
      voorbeelden?: readonly string[];
    };

/** ISO-weeknummer (België: week begint maandag). */
function weekNummer(datum: string): number {
  const d = new Date(`${datum}T12:00:00`);
  const dag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dag + 3);
  const eerste = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - eerste.getTime()) / 86400000 - 3 + ((eerste.getDay() + 6) % 7)) / 7)
  );
}

const terugval = isDemoOmgeving(import.meta.env as unknown as Record<string, string | undefined>)
  ? new TestHerkenner()
  : null;

function AssistentPagina() {
  const { van, vraag, verzameling } = Route.useSearch();
  const terug = verzameling
    ? { to: `/verzamelingen/${verzameling}`, tekst: "Terug naar de verzameling" }
    : TERUG[van ?? "week"];
  return (
    <AppShell title="Assistent" ondertitel="Vraag Foodlo iets aan je week te veranderen.">
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <Link
          to={terug.to}
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          {terug.tekst}
        </Link>
        <Gesprek beginVraag={vraag} verzameling={verzameling} />
      </div>
    </AppShell>
  );
}

function Gesprek({
  beginVraag,
  verzameling,
}: {
  beginVraag: string | undefined;
  verzameling?: string | undefined;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { ctx, nietLeesbaar, regels, recepten } = useAssistentContext();
  const { beschikbaar: etersOpAccount } = useModuleBeschikbaar("maaltijd_eters");
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [standen, setStanden] = useState<Record<string, KaartStand>>({});
  const [invoer, setInvoer] = useState("");
  const [nog, setNog] = useState(() => nogVandaag(user?.id));
  const herstel = useRef<Record<string, Uitvoering>>({});
  const teller = useRef(0);
  const gevraagd = useRef(false);
  const vandaag = lokaleDatum();

  const samenvatting = useMemo(() => {
    if (!ctx) return null;
    const d = new Date(`${vandaag}T12:00:00`);
    const zondag = new Date(d);
    zondag.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
    const eind = lokaleDatum(zondag);
    const gepland = ctx.rijen.filter((r) => r.datum <= eind).length;
    return [
      `Week ${weekNummer(vandaag)}`,
      `${gepland} ${gepland === 1 ? "gerecht" : "gerechten"} gepland`,
      ctx.plan.budget ? `budget ${euro(ctx.plan.budget)}` : "geen budget ingesteld",
    ].join(" · ");
  }, [ctx, vandaag]);

  async function vraagIets(zin: string) {
    if (!ctx || !user || !zin.trim()) return;
    const id = `b${++teller.current}`;
    setBerichten((b) => [...b, { id: `${id}-jij`, wie: "jij", tekst: zin.trim() }]);
    setInvoer("");
    const namen = ctx.leden.map((l) => l.naam);
    const uitkomst = await herken(
      zin,
      { vandaag: ctx.vandaag, namen, recepten: ctx.plan.kandidaten },
      { terugval, resterend: nog },
    );
    if (uitkomst.teldMee) setNog(registreerVraag(user.id));
    const h = uitkomst.herkenning;
    if (!h.ok) {
      setBerichten((b) => [
        ...b,
        { id, wie: "foodlo", tekst: h.reden, bron: uitkomst.bron, voorbeelden: h.voorbeelden },
      ]);
      return;
    }
    const voorstel = maakActieVoorstel(h.opdracht, ctx);
    setStanden((s) => ({ ...s, [id]: { soort: "open" } }));
    setBerichten((b) => [
      ...b,
      {
        id,
        wie: "foodlo",
        tekst: `Ik begreep: ${omschrijf(h.opdracht, (d) => dagNaam(d, ctx.vandaag))}.`,
        bron: uitkomst.bron,
        voorstel,
      },
    ]);
  }

  // Fase 3: een verzameling inplannen (?verzameling=…): meteen het voorstel om na te kijken.
  const { data: verz } = useQuery({
    queryKey: ["verzameling", verzameling],
    enabled: !!verzameling && !!user,
    queryFn: () => haalVerzameling(verzameling!),
  });
  const verzGevraagd = useRef(false);
  useEffect(() => {
    if (!ctx || !verz || verzGevraagd.current) return;
    verzGevraagd.current = true;
    const id = `b${++teller.current}`;
    const ids = [...(verz.collection_recipes ?? [])]
      .sort((a, b) => a.positie - b.positie)
      .map((r) => r.recipe_id);
    const opdracht = { soort: "collectie" as const, naam: verz.naam, receptIds: ids };
    setStanden((s) => ({ ...s, [id]: { soort: "open" } }));
    setBerichten((b) => [
      ...b,
      { id: `${id}-jij`, wie: "jij", tekst: `Plan "${verz.naam}" in` },
      {
        id,
        wie: "foodlo",
        tekst: `Ik begreep: ${omschrijf(opdracht, (d) => dagNaam(d, ctx.vandaag))}. Kijk het na en tik op "Doe maar".`,
        bron: "regels",
        voorstel: maakActieVoorstel(opdracht, ctx),
      },
    ]);
  }, [ctx, verz]);

  // Vraag uit een kaart of link (?vraag=…): één keer stellen zodra alles geladen is.
  useEffect(() => {
    if (!ctx || !beginVraag || gevraagd.current) return;
    gevraagd.current = true;
    void vraagIets(beginVraag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, beginVraag]);

  function zet(id: string, stand: KaartStand) {
    setStanden((s) => ({ ...s, [id]: stand }));
  }

  async function doeMaar(id: string, v: Voorstel) {
    if (!ctx || !user) return;
    // Laatste veiligheidscontrole op het toestel én (voor wie je gegevens niet mag lezen) de server.
    const onveilig = onveiligInVoorstel(v, ctx);
    if (onveilig.length) {
      zet(id, {
        soort: "fout",
        tekst: `Niet uitgevoerd: ${onveilig.join(", ")} past niet voor iedereen.`,
      });
      return;
    }
    zet(id, { soort: "bezig" });
    try {
      const server = await onveiligeGerechten(nieuweRecepten(v), nietLeesbaar, serverOordeel);
      if (server.size) {
        zet(id, {
          soort: "fout",
          tekst:
            "Niet uitgevoerd: dit gerecht past niet voor iedereen die meeëet. Er is niets veranderd.",
        });
        return;
      }
      const r = await voerVoorstelUit(v, {
        userId: user.id,
        bewaarEters: async (planId, ids) => {
          if (etersOpAccount) await bewaarEters(planId, ids ? [...ids] : []);
          else bewaarToestelEters(user.id, planId, ids);
        },
        receptVan: (receptId) => {
          const recept = recepten.find((x) => x.id === receptId);
          return recept ? { regels: regels[receptId] ?? [], servings: recept.servings } : null;
        },
      });
      herstel.current[id] = r;
      void qc.invalidateQueries();
      const lijst =
        lijstUitleg(r.effect) ||
        (r.lijstErbij ? `lijst: ${r.lijstErbij} erbij` : "lijst: niets veranderd");
      const tekst = `Gedaan · ${lijst}`;
      zet(id, { soort: "gedaan", tekst, herstellen: true });
      toast.success(tekst, {
        duration: 10_000,
        action: { label: "Ongedaan maken", onClick: () => void ongedaan(id) },
      });
    } catch (fout) {
      zet(id, {
        soort: "fout",
        tekst:
          fout instanceof HalfGelukt
            ? "Dat lukte niet helemaal. Kijk je weekmenu en je lijst even na."
            : "Dat lukte niet. Er is niets veranderd; probeer het opnieuw.",
      });
    }
  }

  async function ongedaan(id: string) {
    const r = herstel.current[id];
    if (!r) return;
    try {
      await r.herstel();
      delete herstel.current[id];
      void qc.invalidateQueries();
      zet(id, { soort: "teruggezet" });
    } catch {
      zet(id, { soort: "fout", tekst: "Terugzetten lukte niet helemaal. Kijk je week na." });
    }
  }

  function verstuur(e: FormEvent) {
    e.preventDefault();
    void vraagIets(invoer);
  }

  if (!ctx) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <section aria-label="Jouw week" className="paneel space-y-2 p-4">
        <p className="text-lg font-semibold" data-testid="assistent-context">
          {samenvatting}
        </p>
        <p className="flex items-start gap-2 text-base text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            Foodlo doet niets zonder jouw "Doe maar". Allergieën en dieet gaan nooit naar de AI;
            Foodlo controleert ze zelf bij elk voorstel.
          </span>
        </p>
      </section>

      {berichten.length ? (
        <ol aria-label="Gesprek" aria-live="polite" className="space-y-4">
          {berichten.map((b) =>
            b.wie === "jij" ? (
              <li key={b.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-inkt px-4 py-3 text-base text-inkt-foreground break-words">
                  <span className="sr-only">Jij: </span>
                  {b.tekst}
                </p>
              </li>
            ) : (
              <li key={b.id} className="space-y-3">
                <p className="text-base">
                  <span className="sr-only">Foodlo: </span>
                  {b.tekst}
                </p>
                <p className="inline-flex rounded-xl border border-border px-2.5 py-0.5 text-[0.95rem] font-semibold">
                  {BRON[b.bron]}
                </p>
                {b.voorstel ? (
                  <VoorstelKaart
                    id={b.id}
                    voorstel={b.voorstel}
                    vandaag={ctx.vandaag}
                    stand={standen[b.id] ?? { soort: "open" }}
                    onJa={() => void doeMaar(b.id, b.voorstel!)}
                    onNee={() => zet(b.id, { soort: "nee" })}
                    onOngedaan={() => void ongedaan(b.id)}
                  />
                ) : null}
                {b.voorbeelden ? (
                  <p className="text-base text-muted-foreground">
                    Probeer bijvoorbeeld een van de vragen hieronder.
                  </p>
                ) : null}
              </li>
            ),
          )}
        </ol>
      ) : null}

      <section aria-labelledby="voorbeelden-titel" className="space-y-3">
        <h2 id="voorbeelden-titel" className="text-sectietitel">
          {berichten.length ? "Nog iets?" : "Wat kan ik voor je doen?"}
        </h2>
        <ul aria-label="Voorbeeldvragen" className="flex flex-wrap gap-2">
          {VOORBEELDEN.map((v) => (
            <li key={v}>
              <Button variant="zacht" size="sm" onClick={() => void vraagIets(v)}>
                {v}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={verstuur} className="space-y-2">
        <label htmlFor="assistent-vraag" className="block text-base font-semibold">
          Of typ zelf wat je wilt veranderen
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="assistent-vraag"
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Bv. Gust eet zaterdag mee"
            className="min-h-14 w-full min-w-0 flex-1 rounded-2xl border-2 border-border bg-card px-4 text-lg"
          />
          <Button type="submit" variant="inkt" disabled={!invoer.trim()} className="shrink-0">
            <Send aria-hidden /> Vraag
          </Button>
        </div>
        <p className="flex items-start gap-2 text-[0.95rem] text-muted-foreground">
          <MessageCircleQuestion className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            {terugval
              ? `Werkt zonder AI. Wat de vaste regels niet kennen, probeert de testmodus (nog ${nog} van ${DAGLIMIET} vandaag).`
              : "Werkt zonder AI, met vaste regels."}
          </span>
        </p>
      </form>
    </div>
  );
}
