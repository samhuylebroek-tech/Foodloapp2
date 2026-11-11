import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ALLERGENEN } from "@/lib/allergenen";
import { markeerNieuweGebruiker } from "@/lib/eerste-stappen";
import {
  bewaarKennismaking,
  leesKennismaking,
  naarWeekmenu,
  type Kennismaking,
} from "@/lib/kennismaking";
import { startRondleiding } from "@/lib/rondleiding";
import { useVoorkeuren } from "@/lib/voorkeuren";

export const Route = createFileRoute("/kennismaking")({
  validateSearch: (s: Record<string, unknown>): { terug?: "instellingen" } =>
    s["terug"] === "instellingen" ? { terug: "instellingen" } : {},
  head: () => ({ meta: [{ title: "Kennismaking — Foodlo" }] }),
  component: KennismakingPagina,
});

function Keuze<T extends string | number>({
  titel,
  uitleg,
  opties,
  waarde,
  zet,
}: {
  titel: string;
  uitleg: ReactNode;
  opties: { w: T; label: string }[];
  waarde: T | undefined;
  zet: (w: T | undefined) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-3" aria-describedby={`${id}-u`}>
      <legend className="text-lg font-bold">{titel}</legend>
      <p id={`${id}-u`} className="text-[0.95rem] text-muted-foreground">
        {uitleg}
      </p>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {opties.map((o) => {
          const aan = waarde === o.w;
          return (
            <button
              key={String(o.w)}
              type="button"
              aria-pressed={aan}
              onClick={() => zet(aan ? undefined : o.w)}
              className={
                aan
                  ? "flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-secondary px-4 text-left text-base font-semibold"
                  : "flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-transparent bg-card px-4 text-left text-base font-semibold ring-1 ring-border hover:bg-muted"
              }
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
              {aan ? <Check className="size-5 shrink-0 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function KennismakingPagina() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { terug } = Route.useSearch();
  const { weekmenu, zetWeekmenu } = useVoorkeuren();
  const [k, setK] = useState<Kennismaking>(() => leesKennismaking(user?.id));
  const zet =
    <S extends keyof Kennismaking>(s: S) =>
    (w: Kennismaking[S]) =>
      setK((o) => ({ ...o, [s]: w }));

  function bewaar(rondleiding: boolean) {
    if (user) {
      bewaarKennismaking(user.id, k);
      const w = naarWeekmenu(k);
      if (Object.keys(w).length) zetWeekmenu({ ...weekmenu, ...w });
    }
    if (terug === "instellingen") {
      navigate({ to: "/instellingen" });
      return;
    }
    markeerNieuweGebruiker();
    if (rondleiding) startRondleiding();
    navigate({ to: rondleiding ? "/" : "/eerste-stappen" });
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <main id="inhoud" className="mx-auto w-full max-w-xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Even kennismaken</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Zo stemt Foodlo de uitleg en je weekvoorstel op jou af. Alles is optioneel en je kan het
            later wijzigen in Instellingen.
          </p>
        </div>

        <Keuze
          titel="Hoeveel kook je?"
          uitleg="Beginners krijgen een volledige rondleiding, ervaren koks een korte."
          opties={[
            { w: "nieuw", label: "Ik ben nieuw in de keuken" },
            { w: "soms", label: "Ik kook af en toe" },
            { w: "graag", label: "Ik kook graag en veel" },
          ]}
          waarde={k.ervaring}
          zet={zet("ervaring")}
        />

        <Keuze
          titel="Hoeveel tijd heb je meestal om te koken?"
          uitleg="Gebruikt voor je weekvoorstel (Laat Foodlo kiezen)."
          opties={[
            { w: 20, label: "Tot 20 minuten" },
            { w: 30, label: "Tot 30 minuten" },
            { w: 45, label: "Tot 45 minuten" },
            { w: 0, label: "Maakt niet uit" },
          ]}
          waarde={k.kooktijd}
          zet={zet("kooktijd")}
        />

        <Keuze
          titel="Wat eet je?"
          uitleg={
            <>
              <Lock className="mr-1 inline size-4 align-[-2px]" aria-hidden />
              Blijft alleen op dit toestel, tenzij je hieronder kiest om het voor je weekvoorstel te
              gebruiken.
            </>
          }
          opties={[
            { w: "alles", label: "Alles" },
            { w: "weinig-vlees", label: "Weinig vlees" },
            { w: "pescotarisch", label: "Vis, geen vlees" },
            { w: "vegetarisch", label: "Vegetarisch" },
            { w: "veganistisch", label: "Veganistisch" },
          ]}
          waarde={k.dieet}
          zet={zet("dieet")}
        />
        {k.dieet ? (
          <label className="flex min-h-12 items-start gap-3 text-base">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={!!k.dieetInWeekmenu}
              onChange={(e) => zet("dieetInWeekmenu")(e.target.checked)}
            />
            <span>
              Gebruik dit voor mijn weekvoorstel. Let op: je weekvoorkeuren zijn dan zichtbaar voor
              je gezinsleden.
            </span>
          </label>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-lg font-bold">Allergieën</legend>
          <p className="text-[0.95rem] text-muted-foreground">
            <Lock className="mr-1 inline size-4 align-[-2px]" aria-hidden />
            Blijft alleen op dit toestel. Op een recept waarschuwt Foodlo als een ingrediënt
            mogelijk een allergeen bevat. Dat is een hulp, geen garantie: lees altijd het etiket.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENEN.map((a) => {
              const aan = k.allergieen.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={aan}
                  onClick={() =>
                    setK((o) => ({
                      ...o,
                      allergieen: aan
                        ? o.allergieen.filter((x) => x !== a.id)
                        : [...o.allergieen, a.id],
                    }))
                  }
                  className={
                    aan
                      ? "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground"
                      : "inline-flex min-h-11 items-center rounded-full bg-card px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
                  }
                >
                  {aan ? <Check className="size-4" aria-hidden /> : null}
                  {a.naam}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Keuze
          titel="Voor hoeveel personen kook je meestal?"
          uitleg="Kook je samen? In de rondleiding zie je hoe je je gezin uitnodigt."
          opties={[
            { w: "1", label: "Voor mezelf" },
            { w: "2", label: "Met twee" },
            { w: "3-4", label: "3 of 4 personen" },
            { w: "5+", label: "5 of meer" },
          ]}
          waarde={k.gezin}
          zet={zet("gezin")}
        />

        <Keuze
          titel="Hoe plan je het liefst?"
          uitleg="Zo leggen we uit wat voor jou het nuttigst is."
          opties={[
            { w: "week", label: "De hele week vooraf" },
            { w: "dag", label: "Per dag beslissen" },
            { w: "voorstel", label: "Foodlo stelt voor" },
          ]}
          waarde={k.planwijze}
          zet={zet("planwijze")}
        />

        <div className="sticky bottom-0 -mx-5 space-y-2 bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {terug === "instellingen" ? (
            <Button onClick={() => bewaar(false)} className="h-14 w-full text-lg">
              Bewaren
            </Button>
          ) : (
            <>
              <Button onClick={() => bewaar(true)} className="h-14 w-full text-lg">
                Bewaren en rondleiding starten
              </Button>
              <Button
                variant="secondary"
                onClick={() => bewaar(false)}
                className="h-12 w-full text-base"
              >
                Bewaren, zonder rondleiding
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  markeerNieuweGebruiker();
                  navigate({ to: "/" });
                }}
                className="h-12 w-full text-base"
              >
                Overslaan
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
