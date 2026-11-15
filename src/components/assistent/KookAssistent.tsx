/**
 * "Vraag het Foodlo" — de kookassistent bij een recept en in de kookstand.
 *
 * - Vervangen: eerst de vaste tabel (zonder AI, altijd), getoetst aan jouw allergieën en dieet en
 *   aan die van wie meeëet. Daarna optioneel de slimme hulp; ook die voorstellen gaan door dezelfde
 *   toets. In demo en tests antwoordt een testadapter (zichtbaar als "Testmodus").
 * - Aanpassen: personen, vegetarisch, zonder een allergeen. Altijd eerst een voorbeeld met de
 *   verschillen; daarna kies je "Bewaar als kopie" of "Pas dit recept aan" (met ongedaan maken).
 * - Vraag: korte kookvraag, eerst vaste antwoorden.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FlaskConical,
  Loader2,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { assistentHulp } from "@/lib/ai.functions";
import { ALLERGENEN, type AllergeenId } from "@/lib/allergenen";
import {
  maakVoorstel,
  vervangVoorstel,
  type AanpasVoorstel,
  type Opdracht,
} from "@/lib/assistent/aanpassen";
import { BRON_LABEL, naarVervangers, type AssistentBron } from "@/lib/assistent/adapter";
import { etersUit } from "@/lib/assistent/eters";
import { DAGLIMIET, nogVandaag, registreerVraag } from "@/lib/assistent/gebruik";
import { bewaarAlsKopie, herstel, pasOrigineelAan } from "@/lib/assistent/opslaan";
import {
  ingredientRedenen,
  toetsVervangers,
  veiligeVervangers,
  type Afgevallen,
  type Eter,
  type Vervanger,
} from "@/lib/assistent/vervangingen";
import { GEEN_ANTWOORD, regelAntwoord, VOORBEELDVRAGEN } from "@/lib/assistent/vragen";
import { leesKennismaking } from "@/lib/kennismaking";
import { meet } from "@/lib/meten";
import type { Ingredient, Recipe } from "@/lib/types";
import { useHuishouden } from "@/lib/voeding-db";

/** Jij plus de gezinsleden waarvan je de voorkeuren mag lezen. */
function useAssistentEters() {
  const { user } = useAuth();
  const { data: gezinId } = useQuery({
    queryKey: ["assistent-gezin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "actief")
        .limit(1)
        .maybeSingle();
      return (data?.group_id as string | undefined) ?? null;
    },
  });
  const { data: huis } = useHuishouden(gezinId);
  return useMemo(
    () =>
      etersUit(
        leesKennismaking(user?.id),
        huis?.beschikbaar ? huis.data.leden : [],
        huis?.data.voeding ?? new Map(),
        user?.id,
      ),
    [huis, user?.id],
  );
}

function Bronlabel({ bron }: { bron: AssistentBron }) {
  return (
    <p
      className={
        bron === "test"
          ? "flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-[0.95rem] text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
          : "flex items-start gap-2 text-[0.95rem] text-muted-foreground"
      }
    >
      {bron === "test" ? (
        <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
      ) : (
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
      )}
      <span>{BRON_LABEL[bron]}</span>
    </p>
  );
}

function VervangerLijst({
  geschikt,
  afgevallen,
  label,
  onKies,
}: {
  geschikt: Vervanger[];
  afgevallen: Afgevallen[];
  label: string;
  onKies?: (v: Vervanger) => void;
}) {
  return (
    <div className="space-y-3">
      {geschikt.length ? (
        <ul className="space-y-2" aria-label={label}>
          {geschikt.map((v) => (
            <li key={v.naam} className="paneel flex flex-col gap-2 p-4">
              <p className="text-lg font-semibold">{v.naam}</p>
              <p className="text-base">{v.reden}</p>
              <p className="text-[0.95rem] text-muted-foreground">Hoeveel: {v.verhouding}</p>
              {onKies ? (
                <Button variant="outline" className="mt-1 self-start" onClick={() => onKies(v)}>
                  Gebruik dit in het recept
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-muted p-4 text-base">
          Geen veilige vervanger gevonden voor iedereen aan tafel. Laat het weg of kies zelf iets.
        </p>
      )}
      {afgevallen.length ? (
        <details className="rounded-2xl border border-border p-4" open>
          <summary className="min-h-10 cursor-pointer text-base font-semibold">
            Niet voorgesteld ({afgevallen.length})
          </summary>
          <ul className="mt-2 space-y-2 text-base" aria-label="Niet voorgesteld">
            {afgevallen.map((a) => (
              <li key={a.vervanger.naam} className="flex gap-2">
                <X className="mt-1 size-4 shrink-0 text-destructive" aria-hidden />
                <span>
                  <strong>{a.vervanger.naam}</strong>: {a.redenen.join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function VoorbeeldWijzigingen({
  voorstel,
  isOwner,
  bezig,
  onKopie,
  onOrigineel,
  onTerug,
}: {
  voorstel: AanpasVoorstel;
  isOwner: boolean;
  bezig: boolean;
  onKopie: () => void;
  onOrigineel: () => void;
  onTerug: () => void;
}) {
  return (
    <section aria-labelledby="voorbeeld-titel" className="space-y-4">
      <h3 id="voorbeeld-titel" className="text-sectietitel">
        Voorbeeld van de aanpassing
      </h3>
      <p className="text-base">
        Er is nog niets veranderd. Kijk de verschillen na en kies daarna wat je wil.
      </p>
      {voorstel.wijzigingen.length ? (
        <ul className="space-y-2" aria-label="Verschillen">
          {voorstel.wijzigingen.map((w, i) => (
            <li key={i} className="paneel space-y-1 p-4 text-base">
              <p>
                <del className="text-muted-foreground">{w.van}</del>
              </p>
              {w.soort === "weg" ? (
                <p className="font-semibold">Weglaten</p>
              ) : (
                <p className="font-semibold">
                  <ins className="no-underline">→ {w.naar}</ins>
                </p>
              )}
              {"reden" in w ? (
                <p className="text-[0.95rem] text-muted-foreground">{w.reden}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {voorstel.waarschuwingen.length ? (
        <ul
          className="space-y-1 rounded-2xl bg-[var(--honing-zacht)] p-4 text-base text-[var(--honing-foreground)]"
          aria-label="Let op"
        >
          {voorstel.waarschuwingen.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={onKopie} disabled={bezig || !voorstel.wijzigingen.length}>
          {bezig ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-5" aria-hidden />
          )}
          Bewaar als kopie
        </Button>
        {isOwner ? (
          <Button
            variant="outline"
            onClick={onOrigineel}
            disabled={bezig || !voorstel.wijzigingen.length}
          >
            Pas dit recept aan
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onTerug} disabled={bezig} className="sm:col-span-2">
          Terug, niets bewaren
        </Button>
      </div>
    </section>
  );
}

export function KookAssistent({
  open,
  onOpenChange,
  recept,
  ingredienten,
  isOwner,
  kookstand = false,
  beginIngredient = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recept: Recipe;
  ingredienten: Ingredient[];
  isOwner: boolean;
  kookstand?: boolean;
  /** Fase 1 veiligheid: "Vervanger zoeken" opent meteen bij dit ingrediënt. */
  beginIngredient?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const alleEters = useAssistentEters();
  const [uit, setUit] = useState<string[]>([]);
  const eters: Eter[] = alleEters.filter((e) => e.ikZelf || !uit.includes(e.id));

  const [tab, setTab] = useState("vervangen");
  const [gekozen, setGekozen] = useState<string | null>(null);
  useEffect(() => {
    if (open && beginIngredient) {
      setTab("vervangen");
      setGekozen(beginIngredient.trim());
    }
  }, [open, beginIngredient]);
  const [eigen, setEigen] = useState("");
  const [slim, setSlim] = useState<{
    bron: AssistentBron;
    lijst: Vervanger[];
    melding?: string;
  } | null>(null);
  const [slimBezig, setSlimBezig] = useState(false);
  const [voorstel, setVoorstel] = useState<AanpasVoorstel | null>(null);
  const [bewaren, setBewaren] = useState(false);
  const [personen, setPersonen] = useState(recept.servings > 0 ? recept.servings : 2);
  const mijnAllergieen = alleEters.find((e) => e.ikZelf)?.allergieen ?? [];
  const [allergeen, setAllergeen] = useState<AllergeenId>(
    (mijnAllergieen[0] as AllergeenId) ?? "melk",
  );
  const [vraag, setVraag] = useState("");
  const [antwoord, setAntwoord] = useState<{
    bron: AssistentBron;
    tekst: string;
    vast: boolean;
  } | null>(null);
  const [nog, setNog] = useState(() => nogVandaag(user?.id));

  const uitkomst = useMemo(
    () => (gekozen ? veiligeVervangers(gekozen, eters) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gekozen, JSON.stringify(eters)],
  );
  const probleem = gekozen ? ingredientRedenen(gekozen, eters) : [];
  const indexGekozen = gekozen ? ingredienten.findIndex((i) => i.name === gekozen) : -1;
  const slimGetoetst = useMemo(
    () => (slim ? toetsVervangers(slim.lijst, eters) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slim, JSON.stringify(eters)],
  );

  function kiesIngredient(naam: string) {
    setGekozen(naam.trim());
    setSlim(null);
    void meet("assistent.vervangen", undefined, { bekend: !!veiligeVervangers(naam, []).bekend });
  }

  async function vraagSlim(soort: "vervang" | "vraag", tekst: string) {
    if (!user || nog <= 0) return null;
    setSlimBezig(true);
    try {
      const r = await assistentHulp({ data: { soort, tekst, recept: recept.title } });
      if (r.bron !== "regels") setNog(registreerVraag(user.id));
      void meet("assistent.slim", undefined, { soort, bron: r.bron });
      return r;
    } catch {
      return {
        bron: "regels" as const,
        melding: "De slimme hulp is nu niet bereikbaar. Hier zijn de vaste tips.",
      };
    } finally {
      setSlimBezig(false);
    }
  }

  async function slimVervangers() {
    if (!gekozen) return;
    const r = await vraagSlim("vervang", gekozen);
    if (!r) return;
    setSlim({
      bron: r.bron,
      lijst: naarVervangers(r.vervangers ?? []),
      ...(r.melding ? { melding: r.melding } : {}),
    });
  }

  async function stelVraag(tekst: string) {
    const v = tekst.trim();
    if (!v) return;
    setVraag(v);
    const vast = regelAntwoord(v);
    setAntwoord({ bron: "regels", tekst: vast ?? GEEN_ANTWOORD, vast: !!vast });
    void meet("assistent.vraag", undefined, { vast: !!vast });
  }

  async function slimAntwoord() {
    const r = await vraagSlim("vraag", vraag);
    if (!r) return;
    setAntwoord({
      bron: r.bron,
      tekst: r.antwoord || r.melding || GEEN_ANTWOORD,
      vast: true,
    });
  }

  function toonVoorstel(opdracht: Opdracht) {
    setVoorstel(maakVoorstel(recept, ingredienten, opdracht, eters));
    setTab("aanpassen");
    void meet("assistent.voorstel", undefined, { soort: opdracht.soort });
  }

  async function ververs() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["recipe", recept.id] }),
      qc.invalidateQueries({ queryKey: ["recipes"] }),
    ]);
  }

  async function opKopie() {
    if (!user || !voorstel) return;
    setBewaren(true);
    try {
      const id = await bewaarAlsKopie(user.id, recept, voorstel);
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      setVoorstel(null);
      onOpenChange(false);
      toast.success("Kopie bewaard. Het origineel blijft zoals het was.", {
        duration: 8000,
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void (async () => {
              await supabase
                .from("recipes")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", id);
              await qc.invalidateQueries({ queryKey: ["recipes"] });
              toast.success("Kopie verwijderd");
              navigate({ to: "/recepten/$id", params: { id: recept.id } });
            })();
          },
        },
      });
      navigate({ to: "/recepten/$id", params: { id } });
    } catch {
      toast.error("Bewaren lukte niet. Er is niets veranderd.");
    } finally {
      setBewaren(false);
    }
  }

  async function opOrigineel() {
    if (!voorstel || !isOwner) return;
    setBewaren(true);
    try {
      const punt = await pasOrigineelAan(recept, ingredienten, voorstel);
      await ververs();
      setVoorstel(null);
      onOpenChange(false);
      toast.success("Recept aangepast", {
        duration: 10000,
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void (async () => {
              try {
                await herstel(punt);
                await ververs();
                toast.success("Recept teruggezet zoals het was");
              } catch {
                toast.error("Terugzetten lukte niet helemaal. Kijk het recept even na.");
              }
            })();
          },
        },
      });
    } catch {
      toast.error("Aanpassen lukte niet helemaal. Kijk het recept even na.");
      await ververs();
    } finally {
      setBewaren(false);
    }
  }

  const anderen = alleEters.filter((e) => !e.ikZelf);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sectietitel">Vraag het Foodlo</SheetTitle>
          <SheetDescription className="text-base">
            Vervangers en aanpassingen houden rekening met jouw allergieën en dieet
            {anderen.length ? " en met wie meeëet" : ""}. Dit is hulp, geen garantie: lees altijd
            het etiket.
          </SheetDescription>
        </SheetHeader>

        {anderen.length ? (
          <div className="mt-3" role="group" aria-labelledby="assistent-wie">
            <p id="assistent-wie" className="text-base font-medium">
              Wie eet mee?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex min-h-12 items-center rounded-full bg-secondary px-4 text-base font-semibold">
                Jij
              </span>
              {anderen.map((e) => {
                const aan = !uit.includes(e.id);
                return (
                  <Button
                    key={e.id}
                    variant={aan ? "secondary" : "outline"}
                    aria-pressed={aan}
                    className="min-h-12"
                    onClick={() =>
                      setUit((u) => (aan ? [...u, e.id] : u.filter((x) => x !== e.id)))
                    }
                  >
                    {aan ? <Check className="size-5" aria-hidden /> : null}
                    {e.naam}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className={`grid h-auto w-full ${kookstand ? "grid-cols-2" : "grid-cols-3"}`}>
            <TabsTrigger value="vervangen" className="whitespace-normal px-2">
              Vervangen
            </TabsTrigger>
            {kookstand ? null : (
              <TabsTrigger value="aanpassen" className="whitespace-normal px-2">
                Aanpassen
              </TabsTrigger>
            )}
            <TabsTrigger value="vraag" className="whitespace-normal px-2">
              Vraag
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vervangen" className="space-y-4 pt-2">
            {ingredienten.length ? (
              <div>
                <p className="text-base font-medium" id="kies-ingredient">
                  Welk ingrediënt wil je vervangen?
                </p>
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="kies-ingredient"
                >
                  {ingredienten.map((i) => (
                    <Button
                      key={i.id}
                      variant={gekozen === i.name ? "secondary" : "outline"}
                      aria-pressed={gekozen === i.name}
                      className="min-h-12"
                      onClick={() => kiesIngredient(i.name)}
                    >
                      {i.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (eigen.trim()) kiesIngredient(eigen);
              }}
            >
              <label htmlFor="ander-ingredient" className="sr-only">
                Ander ingrediënt
              </label>
              <Input
                id="ander-ingredient"
                value={eigen}
                maxLength={60}
                onChange={(e) => setEigen(e.target.value)}
                placeholder="Of typ een ingrediënt, bv. room"
              />
              <Button type="submit" variant="outline" disabled={!eigen.trim()}>
                Zoek vervangers
              </Button>
            </form>

            {uitkomst ? (
              <section aria-label={`Vervangers voor ${gekozen}`} className="space-y-3">
                {probleem.length ? (
                  <p
                    role="note"
                    className="rounded-2xl bg-[var(--honing-zacht)] p-4 text-base text-[var(--honing-foreground)]"
                  >
                    Let op: {gekozen} zelf — {probleem.join("; ")}.
                  </p>
                ) : null}
                {uitkomst.bekend ? (
                  <>
                    <Bronlabel bron="regels" />
                    <VervangerLijst
                      geschikt={uitkomst.geschikt}
                      afgevallen={uitkomst.afgevallen}
                      label={`Vaste vervangers voor ${uitkomst.naam}`}
                      {...(!kookstand && indexGekozen >= 0
                        ? {
                            onKies: (v: Vervanger) => {
                              setVoorstel(vervangVoorstel(recept, ingredienten, indexGekozen, v));
                              setTab("aanpassen");
                            },
                          }
                        : {})}
                    />
                  </>
                ) : (
                  <p className="rounded-2xl bg-muted p-4 text-base">
                    Voor “{gekozen}” heeft Foodlo nog geen vaste vervangers.
                  </p>
                )}

                {slim ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Bronlabel bron={slim.bron} />
                    {slim.melding ? <p className="text-base">{slim.melding}</p> : null}
                    {slimGetoetst && slim.bron !== "regels" ? (
                      <VervangerLijst
                        geschikt={slimGetoetst.geschikt}
                        afgevallen={slimGetoetst.afgevallen}
                        label="Extra ideeën van de slimme hulp"
                      />
                    ) : null}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void slimVervangers()}
                    disabled={slimBezig || nog <= 0}
                  >
                    {slimBezig ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-5" aria-hidden />
                    )}
                    Meer ideeën van de slimme hulp
                  </Button>
                )}
                <p className="text-[0.95rem] text-muted-foreground">
                  {nog > 0
                    ? `Je kan vandaag nog ${nog} van de ${DAGLIMIET} slimme vragen stellen. Vaste tips zijn altijd gratis.`
                    : "Je slimme vragen voor vandaag zijn op. Vaste tips blijven werken."}
                </p>
              </section>
            ) : null}
          </TabsContent>

          {kookstand ? null : (
            <TabsContent value="aanpassen" className="space-y-4 pt-2">
              {voorstel ? (
                <VoorbeeldWijzigingen
                  voorstel={voorstel}
                  isOwner={isOwner}
                  bezig={bewaren}
                  onKopie={() => void opKopie()}
                  onOrigineel={() => void opOrigineel()}
                  onTerug={() => setVoorstel(null)}
                />
              ) : !ingredienten.length ? (
                <p className="rounded-2xl bg-muted p-4 text-base">
                  Dit recept heeft nog geen ingrediënten. Vul ze eerst aan, dan kan Foodlo het
                  aanpassen.
                </p>
              ) : (
                <>
                  <div className="paneel space-y-3 p-4">
                    <p className="text-lg font-semibold" id="aanpassen-personen">
                      Voor hoeveel personen?
                    </p>
                    <div
                      className="flex items-center gap-3"
                      role="group"
                      aria-labelledby="aanpassen-personen"
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-12"
                        aria-label="Minder personen"
                        onClick={() => setPersonen((p) => Math.max(1, p - 1))}
                      >
                        −
                      </Button>
                      <span
                        className="min-w-20 text-center text-lg font-semibold tabular-nums"
                        aria-live="polite"
                      >
                        {personen} {personen === 1 ? "persoon" : "personen"}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-12"
                        aria-label="Meer personen"
                        onClick={() => setPersonen((p) => Math.min(50, p + 1))}
                      >
                        +
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => toonVoorstel({ soort: "personen", personen })}
                    >
                      Toon voorbeeld voor {personen} {personen === 1 ? "persoon" : "personen"}
                    </Button>
                  </div>
                  <div className="paneel space-y-3 p-4">
                    <p className="text-lg font-semibold">Vegetarisch maken</p>
                    <p className="text-base">
                      Vlees en vis worden vervangen door iets dat voor iedereen aan tafel past.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => toonVoorstel({ soort: "vegetarisch" })}
                    >
                      Toon vegetarisch voorbeeld
                    </Button>
                  </div>
                  <div className="paneel space-y-3 p-4">
                    <label htmlFor="zonder-allergeen" className="text-lg font-semibold">
                      Zonder een allergeen
                    </label>
                    <select
                      id="zonder-allergeen"
                      value={allergeen}
                      onChange={(e) => setAllergeen(e.target.value as AllergeenId)}
                      className="min-h-14 w-full rounded-2xl border-2 border-input bg-card px-4 text-base"
                    >
                      {ALLERGENEN.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.naam}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => toonVoorstel({ soort: "zonder", allergeen })}
                    >
                      Toon voorbeeld zonder{" "}
                      {ALLERGENEN.find((a) => a.id === allergeen)?.naam.toLowerCase()}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="vraag" className="space-y-4 pt-2">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void stelVraag(vraag);
              }}
            >
              <label htmlFor="kookvraag" className="text-base font-medium">
                Je kookvraag
              </label>
              <Input
                id="kookvraag"
                value={vraag}
                maxLength={200}
                onChange={(e) => setVraag(e.target.value)}
                placeholder="Bv. hoe lang eieren koken?"
              />
              <Button type="submit" variant="outline" disabled={!vraag.trim()}>
                <MessageCircleQuestion className="size-5" aria-hidden />
                Vraag
              </Button>
            </form>
            <div className="flex flex-wrap gap-2" aria-label="Voorbeeldvragen" role="group">
              {VOORBEELDVRAGEN.map((q) => (
                <Button
                  key={q}
                  variant="ghost"
                  className="min-h-12 border border-border"
                  onClick={() => void stelVraag(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
            {antwoord ? (
              <section aria-live="polite" aria-label="Antwoord" className="paneel space-y-3 p-4">
                <Bronlabel bron={antwoord.bron} />
                <p className="text-lg">{antwoord.tekst}</p>
                {!antwoord.vast && antwoord.bron === "regels" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void slimAntwoord()}
                    disabled={slimBezig || nog <= 0}
                  >
                    {slimBezig ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-5" aria-hidden />
                    )}
                    Vraag het de slimme hulp
                  </Button>
                ) : null}
              </section>
            ) : null}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/** De knop die het paneel opent. */
export function VraagFoodloKnop({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Button
      variant={compact ? "zacht" : "outline"}
      onClick={onClick}
      aria-label={compact ? "Vraag het Foodlo" : undefined}
      className={
        compact
          ? "h-14 min-w-14 shrink-0 px-4"
          : "h-auto min-h-14 w-full whitespace-normal text-base"
      }
    >
      <MessageCircleQuestion className="size-6" aria-hidden />
      <span className={compact ? "hidden min-[360px]:inline" : ""}>
        {compact ? "Vraag" : "Vraag het Foodlo"}
      </span>
    </Button>
  );
}
