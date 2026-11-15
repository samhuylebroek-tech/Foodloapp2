/**
 * WP6 — "Laat Foodlo kiezen": weekvoorstel.
 * Foodloapp Intelligence (I-1, Week): dezelfde harde regels als op Vandaag (nooit een gekozen
 * allergeen, "liever niet" of iets buiten je dieet uit de kennismaking) en per voorstel 1 à 2
 * redenen. Allergieën en dieet blijven op dit toestel; de AI-ideeën krijgen ze niet.
 */
import { voorAI } from "@/lib/ai/privacy";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Loader2,
  Sparkles,
  Type,
  RefreshCw,
  Clock3,
  Utensils,
  BookOpen,
  WandSparkles,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Recipe } from "@/lib/types";
import { AllergieWaarschuwing } from "@/components/AllergieWaarschuwing";
import { RecipePhoto } from "@/components/RecipePhoto";
import { useAuth } from "@/hooks/useAuth";
import { bepaalContext } from "@/lib/intelligentie/context";
import { beoordeel, toegelaten, type Kandidaat } from "@/lib/intelligentie/voorstel";
import { leesKennismaking } from "@/lib/kennismaking";
import { weekmenuIdeeen, type WeekmenuIdee } from "@/lib/ai.functions";
import { ideeTitelToegelaten } from "@/lib/veiligheid";
import { bruikbareVoorraad, useVoorraadBijhouden } from "@/lib/intelligentie/voorraad-modus";
import { type WeekmenuInstelling, type DagVoorkeur } from "@/lib/voorkeuren";
import { kiesUitEigen, type DagRegel, type Soortkeuze } from "@/lib/weekmenu-voorstel";
import { datumTekst, labelVoor, kortLabel } from "./gedeeld";
import { GerechtKaart } from "./ReceptKiezer";
import { alleRijen } from "@/lib/pagineer";
import { useVoorstelEters } from "@/hooks/useVoorstelEters";
import { etiketVoorEters, oordelenVoor, veiligVoorEters } from "@/lib/voorstel-eters";

export function ReceptFoto({
  url,
  recept,
}: {
  url: string | null;
  recept?: Pick<Recipe, "title" | "category" | "tags"> | null;
}) {
  return (
    <RecipePhoto
      path={url}
      alt=""
      recept={recept ?? { title: "" }}
      className="size-16 shrink-0 rounded-2xl"
      icoonClassName="size-8"
    />
  );
}

export function VoorstelFoto({
  url,
  recept,
}: {
  url: string | null;
  recept?: Pick<Recipe, "title" | "category" | "tags"> | null;
}) {
  return (
    <RecipePhoto
      path={url}
      alt=""
      recept={recept ?? { title: "" }}
      className="aspect-[16/9] w-full"
    />
  );
}

const TIJD_KEUZES = [
  { id: 20, label: "Snel (max 20 min)" },
  { id: 45, label: "Gewoon (max 45 min)" },
  { id: 90, label: "Rustig koken" },
  { id: 0, label: "Maakt niet uit" },
];

const SOORT_KEUZES: { id: Soortkeuze; label: string }[] = [
  { id: null, label: "Foodlo kiest" },
  { id: "vlees", label: "Vlees" },
  { id: "vis", label: "Vis" },
  { id: "vega", label: "Vegetarisch" },
];

type Rij = {
  datum: string;
  moment: string;
  recept: Recipe | null;
  idee: WeekmenuIdee | null;
  bezet: boolean;
  aan: boolean;
};

function weekdagVan(datum: string) {
  return String((new Date(`${datum}T12:00:00`).getDay() + 6) % 7);
}

/** Foodlo stelt een weekmenu voor; jij vinkt aan wat je houdt. */
export function WeekmenuVoorstel({
  week,
  momenten,
  instelling,
  zetInstelling,
  bezet,
  alGepland,
  onSluit,
  onZet,
  gezinId,
}: {
  /** Gezin voor "Wie eet mee?"; weggelaten = je eigen gezin opzoeken. */
  gezinId?: string | null;
  week: string[];
  momenten: string[];
  instelling: WeekmenuInstelling;
  zetInstelling: (deel: Partial<WeekmenuInstelling>) => void;
  bezet: Set<string>;
  /** Gerechten die deze week al ingepland staan; die stellen we niet opnieuw voor. */
  alGepland: Set<string>;
  onSluit: () => void;
  onZet: (rijen: Rij[]) => Promise<void>;
}) {
  const [stap, setStap] = useState<"vragen" | "voorstel">("vragen");
  const [dagen, setDagen] = useState<string[]>(week);
  const [gekozenMomenten, setGekozenMomenten] = useState<string[]>([
    momenten[momenten.length - 1] ?? "avondeten",
  ]);
  const [bron, setBron] = useState<"eigen" | "ook-extern">(instelling.bron);
  const [regels, setRegels] = useState<Record<string, DagVoorkeur>>({});
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [bezigMet, setBezigMet] = useState("");
  const [actieveStap, setActieveStap] = useState(0);
  const [keuzeOpen, setKeuzeOpen] = useState(false);
  const [eigenZoek, setEigenZoek] = useState("");
  const getoondeRecepten = useRef<Record<string, string[]>>({});
  const getoondeIdeeen = useRef<string[]>([]);
  // Wie eet mee (werkstroom A): standaard het hele huishouden.
  const [gekozenEters, setGekozenEters] = useState<string[] | null>(null);

  const { data: alleRecepten = [] } = useQuery({
    queryKey: ["voorstel-recepten"],
    queryFn: async () => {
      // Tweede laag naast RLS (BUG-105): nooit recepten van onbekenden.
      const eigenaren = await zichtbareEigenaren();
      if (!eigenaren.length) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .in("user_id", eigenaren)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Recipe[];
    },
  });

  // Wat al in deze week staat, stellen we niet nog eens voor.
  const recepten = alleRecepten.filter((r) => !alGepland.has(r.id));

  // `klaar`: zonder ingrediënten kunnen we allergenen niet herkennen, dus nog niet voorstellen.
  const { data: ingredienten = {}, isSuccess: ingredientenKlaar } = useQuery({
    queryKey: ["voorstel-ingredienten"],
    queryFn: async () => {
      // Gepagineerd: wie 100 recepten heeft, zit al snel boven de 1000 ingrediënten.
      const { data } = await alleRijen(
        supabase.from("recipe_ingredients").select("recipe_id, name").order("id"),
        20_000,
      );
      const map: Record<string, string[]> = {};
      for (const i of data) {
        const id = i.recipe_id as string;
        (map[id] ??= []).push(i.name as string);
      }
      return map;
    },
  });

  const { data: recent = {} } = useQuery({
    queryKey: ["voorstel-recent"],
    queryFn: async () => {
      const grens = new Date();
      grens.setDate(grens.getDate() - 30);
      const { data, error } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date")
        .gte("plan_date", datumTekst(grens));
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data) if (r.recipe_id) map[r.recipe_id as string] = r.plan_date as string;
      return map;
    },
  });

  const { user } = useAuth();
  const kennis = leesKennismaking(user?.id);

  // Alleen voor de redenen: voorraad, sterren en favorieten. Lukt het niet, dan zonder.
  // Voorraad alleen als je die bijhoudt (anders hooguit "onlangs gekocht"; zie voorraad-modus.ts).
  const [voorraadBijgehouden] = useVoorraadBijhouden();
  const { data: extra } = useQuery({
    queryKey: ["voorstel-redenen", user?.id, voorraadBijgehouden],
    enabled: !!user,
    queryFn: async () => {
      const [voorraad, sterren, favorieten] = await Promise.all([
        supabase
          .from("pantry_items")
          .select("naam, created_at, updated_at")
          .eq("user_id", user!.id),
        supabase.from("recipe_ratings").select("recipe_id, stars").eq("user_id", user!.id),
        supabase.from("favorites").select("recipe_id").eq("user_id", user!.id),
      ]);
      const v = bruikbareVoorraad(voorraad.data ?? [], voorraadBijgehouden);
      return {
        voorraad: v.inHuis,
        onlangsGekocht: v.onlangsGekocht,
        sterren: Object.fromEntries((sterren.data ?? []).map((x) => [x.recipe_id, x.stars])),
        favorieten: (favorieten.data ?? []).map((f) => f.recipe_id as string),
      };
    },
  });

  const kandidaat = (r: Recipe): Kandidaat => ({
    id: r.id,
    title: r.title,
    minuten: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0),
    category: r.category ?? null,
    tags: r.tags ?? [],
    ingredienten: ingredienten[r.id] ?? [],
  });

  // Wat Foodlo zelf mag voorstellen: dezelfde harde regels als op Vandaag.
  // "Zelf een gerecht kiezen" toont wel alles, met een waarschuwing bij een allergeen.
  const voorstelbaarVoorMij = recepten.filter((r) =>
    toegelaten(kandidaat(r), {
      voorkeur: { maxMinuten: 0, soort: null, vermijd: instelling.vermijd, dieet: kennis.dieet },
      allergieen: kennis.allergieen,
    }),
  );
  // Mee-eters: wat niet veilig is voor iemand die meeeet, stelt Foodlo niet voor. Voor leden
  // waarvan je de gegevens niet mag lezen, kijkt de server het getoonde gerecht na (zie onder).
  const actiefReceptId = rijen[actieveStap]?.recept?.id;
  const eters = useVoorstelEters({
    gezinId,
    gekozen: gekozenEters,
    receptIds: actiefReceptId ? [actiefReceptId] : [],
  });
  const voorstelbaar = veiligVoorEters(voorstelbaarVoorMij, kandidaat, eters).veilig;

  function regelVoor(datum: string): DagRegel {
    const eigen = regels[datum] ?? instelling.perDag[weekdagVan(datum)] ?? {};
    return {
      datum,
      moment: gekozenMomenten[0] ?? "avondeten",
      maxMinuten: eigen.maxMinuten ?? instelling.maxMinuten ?? 0,
      soort: eigen.soort ?? null,
      over: eigen.over ?? false,
    };
  }

  function alleRegels(): DagRegel[] {
    return dagen.flatMap((d) => gekozenMomenten.map((m) => ({ ...regelVoor(d), moment: m })));
  }

  async function maakVoorstel() {
    if (!ingredientenKlaar) return; // allergenen pas te herkennen met de ingrediënten
    setBezigMet("Foodlo stelt je week samen…");
    try {
      const lijst = alleRegels();
      const keuzes = kiesUitEigen({
        recepten: voorstelbaar,
        ingredienten,
        regels: lijst,
        doelen: { vlees: instelling.vlees, vis: instelling.vis, vega: instelling.vega },
        vermijd: instelling.vermijd,
        recentPerRecept: recent,
        uitgesloten: getoondeRecepten.current,
      });
      const eersteKeuzes = new Map(
        keuzes.map((keuze) => [`${keuze.datum}|${keuze.moment}`, keuze]),
      );
      for (const regel of lijst) {
        const sleutel = `${regel.datum}|${regel.moment}`;
        const keuze = eersteKeuzes.get(sleutel);
        if (keuze?.recept || !getoondeRecepten.current[sleutel]?.length) continue;
        const [herstart] = kiesUitEigen({
          recepten: voorstelbaar,
          ingredienten,
          regels: [regel],
          doelen: { vlees: 0, vis: 0, vega: 0 },
          vermijd: instelling.vermijd,
          recentPerRecept: recent,
        });
        if (herstart) eersteKeuzes.set(sleutel, herstart);
        getoondeRecepten.current[sleutel] = [];
      }
      const afgerondeKeuzes = lijst.map(
        (regel) =>
          eersteKeuzes.get(`${regel.datum}|${regel.moment}`) ?? {
            datum: regel.datum,
            moment: regel.moment,
            recept: null,
          },
      );
      for (const keuze of afgerondeKeuzes) {
        if (!keuze.recept) continue;
        const sleutel = `${keuze.datum}|${keuze.moment}`;
        getoondeRecepten.current[sleutel] = [
          ...(getoondeRecepten.current[sleutel] ?? []),
          keuze.recept.id,
        ];
      }
      let nieuw: Rij[] = afgerondeKeuzes.map((k) => {
        const staatAl = bezet.has(`${k.datum}|${k.moment}`);
        const regel = lijst.find((r) => r.datum === k.datum && r.moment === k.moment);
        return {
          datum: k.datum,
          moment: k.moment,
          recept: k.recept,
          idee: null,
          bezet: staatAl,
          aan: false,
        };
      });

      const gaten = nieuw.filter((r) => !r.recept && !r.bezet && !regelVoor(r.datum).over);
      if (bron === "ook-extern" && gaten.length) {
        setBezigMet("Foodlo zoekt nieuwe ideeën…");
        const ruweIdeeen = await weekmenuIdeeen({
          data: {
            aantal: gaten.length,
            wensen: `${instelling.vlees}x vlees, ${instelling.vis}x vis, ${instelling.vega}x vegetarisch`,
            vermijd: voorAI(instelling.vermijd).tekst,
            maxMinuten: instelling.maxMinuten,
            bekend: [...recepten.slice(0, 60).map((r) => r.title), ...getoondeIdeeen.current],
          },
        });
        const ideeen = (ruweIdeeen as WeekmenuIdee[]).filter((idee) =>
          ideeTitelToegelaten(idee.title, kennis),
        );
        let i = 0;
        nieuw = nieuw.map((r) => {
          if (r.recept || r.bezet || regelVoor(r.datum).over) return r;
          const idee = ideeen[i++] ?? null;
          return idee ? { ...r, idee, aan: false } : r;
        });
        getoondeIdeeen.current = [
          ...getoondeIdeeen.current,
          ...ruweIdeeen.map((idee) => idee.title),
        ];
      }
      const nogTePlannen = nieuw.filter((rij) => !rij.bezet && !regelVoor(rij.datum).over);
      if (!nogTePlannen.length) {
        toast("De gekozen dagen zijn al ingepland of overgeslagen");
        return;
      }
      setRijen(nogTePlannen);
      setActieveStap(0);
      setKeuzeOpen(false);
      setStap("voorstel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voorstel maken lukte niet");
    } finally {
      setBezigMet("");
    }
  }

  function wissel(datum: string, moment: string) {
    const gebruikt = rijen
      .filter((r) => !(r.datum === datum && r.moment === moment))
      .map((r) => r.recept?.id)
      .filter((x): x is string => !!x);
    const huidig = rijen.find((r) => r.datum === datum && r.moment === moment)?.recept?.id;
    const sleutel = `${datum}|${moment}`;
    if (huidig) {
      getoondeRecepten.current[sleutel] = [...(getoondeRecepten.current[sleutel] ?? []), huidig];
    }
    const over = voorstelbaar.filter((r) => r.id !== huidig && !gebruikt.includes(r.id));
    const [keuze] = kiesUitEigen({
      recepten: over,
      ingredienten,
      regels: [{ ...regelVoor(datum), moment }],
      doelen: { vlees: 0, vis: 0, vega: 0 },
      vermijd: instelling.vermijd,
      recentPerRecept: recent,
      uitgesloten: getoondeRecepten.current,
    });
    if (!keuze?.recept) {
      getoondeRecepten.current[sleutel] = [];
      const [herstart] = kiesUitEigen({
        recepten: over,
        ingredienten,
        regels: [{ ...regelVoor(datum), moment }],
        doelen: { vlees: 0, vis: 0, vega: 0 },
        vermijd: instelling.vermijd,
        recentPerRecept: recent,
      });
      if (!herstart?.recept) {
        toast("Geen ander passend gerecht gevonden");
        return;
      }
      setRijen((v) =>
        v.map((r) =>
          r.datum === datum && r.moment === moment
            ? { ...r, recept: herstart.recept, idee: null, aan: true }
            : r,
        ),
      );
      return;
    }
    setRijen((v) =>
      v.map((r) =>
        r.datum === datum && r.moment === moment
          ? { ...r, recept: keuze.recept, idee: null, aan: true }
          : r,
      ),
    );
  }

  function zetRegel(datum: string, deel: DagVoorkeur, ookRest = false) {
    setRegels((v) => {
      const nieuw = { ...v, [datum]: { ...(v[datum] ?? {}), ...deel } };
      if (ookRest) {
        const vanaf = dagen.indexOf(datum);
        dagen.slice(vanaf + 1).forEach((d) => {
          nieuw[d] = { ...(nieuw[d] ?? {}), ...deel };
        });
      }
      return nieuw;
    });
    // Onthouden voor deze weekdag, zodat het de volgende keer al goed staat.
    const dag = weekdagVan(datum);
    zetInstelling({
      perDag: { ...instelling.perDag, [dag]: { ...(instelling.perDag[dag] ?? {}), ...deel } },
    });
  }

  function kiesEigenGerecht(rij: Rij, recept: Recipe) {
    setRijen((huidig) =>
      huidig.map((item) =>
        item.datum === rij.datum && item.moment === rij.moment
          ? { ...item, recept, idee: null, aan: false }
          : item,
      ),
    );
    setKeuzeOpen(false);
    setEigenZoek("");
  }

  async function kiesNieuwIdee(rij: Rij) {
    setBezigMet("Foodlo zoekt een nieuw idee…");
    try {
      const regel = regelVoor(rij.datum);
      const ideeen = await weekmenuIdeeen({
        data: {
          aantal: 1,
          wensen: regel.soort ? `Voor deze dag: ${regel.soort}` : "Gevarieerd gerecht",
          vermijd: voorAI(instelling.vermijd).tekst,
          maxMinuten: regel.maxMinuten,
          bekend: [
            ...recepten.slice(0, 60).map((recept) => recept.title),
            ...getoondeIdeeen.current,
            ...(rij.idee ? [rij.idee.title] : []),
          ],
        },
      });
      const idee = ideeen.find((x) => ideeTitelToegelaten(x.title, kennis));
      if (!idee) {
        toast("Geen ander passend idee gevonden");
        return;
      }
      getoondeIdeeen.current = [...getoondeIdeeen.current, idee.title];
      setRijen((huidig) =>
        huidig.map((item) =>
          item.datum === rij.datum && item.moment === rij.moment
            ? { ...item, recept: null, idee, aan: false }
            : item,
        ),
      );
      setKeuzeOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Een nieuw idee zoeken lukte niet");
    } finally {
      setBezigMet("");
    }
  }

  const aantalAan = rijen.filter((r) => r.aan).length;
  const actieveRij = rijen[actieveStap];
  const actieveRegel = actieveRij ? regelVoor(actieveRij.datum) : null;
  const actieveNaam = actieveRij?.recept?.title ?? actieveRij?.idee?.title ?? null;
  const actieveRecept = actieveRij?.recept ?? null;
  // Goedkoop (één gerecht): gewoon bij elke weergave berekenen.
  const redenen = (() => {
    if (!actieveRecept || !actieveRij || !actieveRegel || actieveRij.bezet) return [];
    const context = bepaalContext(new Date(`${actieveRij.datum}T18:00:00`));
    const laatst = Object.fromEntries(
      Object.entries(recent).filter(([, d]) => d < actieveRij.datum),
    );
    return beoordeel(kandidaat(actieveRecept), {
      kandidaten: [],
      context,
      voorraad: extra?.voorraad ?? [],
      onlangsGekocht: extra?.onlangsGekocht ?? [],
      geschiedenis: { laatst, komend: new Set(), minutenPerWeekdag: {} },
      sterren: extra?.sterren ?? {},
      favorieten: extra?.favorieten ?? [],
      voorkeur: {
        maxMinuten: actieveRegel.maxMinuten,
        soort: actieveRegel.soort,
        vermijd: instelling.vermijd,
      },
    }).redenen;
  })();
  const eigenResultaten = recepten
    .filter((recept) => recept.title.toLowerCase().includes(eigenZoek.trim().toLowerCase()))
    .slice(0, 5);

  function gaVerder(aan: boolean) {
    if (!actieveRij) return;
    setRijen((huidig) =>
      huidig.map((item, index) => (index === actieveStap ? { ...item, aan } : item)),
    );
    setKeuzeOpen(false);
    if (actieveStap < rijen.length - 1) setActieveStap((index) => index + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">Foodlo kiest met jou</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-5" />
          </Button>
        </div>

        {stap === "vragen" ? (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-base font-semibold">Voor welke dagen?</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {week.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dagen.includes(d)}
                    onClick={() =>
                      setDagen((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d].sort()))
                    }
                    className={
                      dagen.includes(d)
                        ? "min-h-12 rounded-xl bg-primary px-3 text-base font-semibold capitalize text-primary-foreground"
                        : "min-h-12 rounded-xl border border-border px-3 text-base font-semibold capitalize"
                    }
                  >
                    {kortLabel(d)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold">Welke momenten?</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {momenten.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={gekozenMomenten.includes(m)}
                    onClick={() =>
                      setGekozenMomenten((v) =>
                        v.includes(m) ? v.filter((x) => x !== m) || [m] : [...v, m],
                      )
                    }
                    className={
                      gekozenMomenten.includes(m)
                        ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                        : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {eters.leden.length ? (
              <div>
                <h3 id="voorstel-wie" className="text-base font-semibold">
                  Wie eet mee?
                </h3>
                <div
                  role="group"
                  aria-labelledby="voorstel-wie"
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {eters.leden.map((l) => {
                    const aan = eters.eters.some((e) => e.id === l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={aan}
                        onClick={() =>
                          setGekozenEters((v) => {
                            const nu = v ?? eters.leden.map((x) => x.id);
                            return nu.includes(l.id) ? nu.filter((x) => x !== l.id) : [...nu, l.id];
                          })
                        }
                        className={
                          aan
                            ? "inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                            : "inline-flex min-h-12 items-center rounded-xl border border-border px-4 text-base font-semibold"
                        }
                      >
                        {aan ? <Check className="size-4" aria-hidden /> : null}
                        {l.naam}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-base text-muted-foreground">
                  Foodlo stelt niets voor wat niet veilig is voor wie meeeet.
                </p>
              </div>
            ) : null}

            <div>
              <h3 className="text-base font-semibold">Waaruit mag Foodlo kiezen?</h3>
              <div className="mt-2 space-y-2">
                {(
                  [
                    { id: "eigen", label: "Alleen mijn eigen recepten", extra: "gratis" },
                    { id: "ook-extern", label: "Ook nieuwe ideeën", extra: "kost credits" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={bron === o.id}
                    onClick={() => {
                      setBron(o.id);
                      zetInstelling({ bron: o.id });
                    }}
                    className={
                      bron === o.id
                        ? "flex min-h-14 w-full items-center justify-between rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                        : "flex min-h-14 w-full items-center justify-between rounded-xl border border-border px-4 text-base font-semibold"
                    }
                  >
                    <span>{o.id === "eigen" ? "Uit mijn recepten" : "Ook nieuwe ideeën"}</span>
                    <span className="text-base font-normal opacity-80">{o.extra}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={maakVoorstel}
              disabled={
                !dagen.length || !gekozenMomenten.length || !!bezigMet || !ingredientenKlaar
              }
              className="h-16 w-full text-lg"
            >
              {bezigMet || !ingredientenKlaar ? (
                <>
                  <Loader2 className="size-5 animate-spin" />{" "}
                  {bezigMet || "Foodlo bekijkt je recepten…"}
                </>
              ) : (
                <>
                  <Sparkles className="size-5" /> Laat Foodlo kiezen
                </>
              )}
            </Button>
          </div>
        ) : actieveRij && actieveRegel ? (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-base font-semibold text-muted-foreground">
                Dag {actieveStap + 1} van {rijen.length}
              </p>
              {/* Alleen beeld: "Dag x van y" ernaast zegt hetzelfde voor schermlezers.
                  (Een aria-label op een div zonder rol is niet toegestaan; axe.) */}
              <div className="flex items-center gap-1.5" aria-hidden>
                {rijen.map((rij, index) => (
                  <span
                    key={`${rij.datum}|${rij.moment}`}
                    className={
                      index === actieveStap
                        ? "h-2 w-8 rounded-full bg-primary"
                        : rij.aan
                          ? "size-2 rounded-full bg-primary/50"
                          : "size-2 rounded-full bg-border"
                    }
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-3xl capitalize">
                  {new Date(`${actieveRij.datum}T12:00:00`).toLocaleDateString("nl-BE", {
                    weekday: "long",
                  })}
                </h3>
                <p className="mt-1 capitalize text-muted-foreground">
                  {labelVoor(actieveRij.datum)} · {actieveRij.moment}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-12"
                  aria-label="Vorige dag"
                  disabled={actieveStap === 0}
                  onClick={() => {
                    setActieveStap((index) => index - 1);
                    setKeuzeOpen(false);
                  }}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-12"
                  aria-label="Volgende dag"
                  disabled={actieveStap === rijen.length - 1}
                  onClick={() => {
                    setActieveStap((index) => index + 1);
                    setKeuzeOpen(false);
                  }}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
              <VoorstelFoto url={actieveRij.recept?.image_url ?? null} recept={actieveRij.recept} />
              <div className="p-5">
                <p className="text-base font-semibold uppercase text-primary">
                  {actieveRij.idee ? "Nieuw idee" : "Voorstel van Foodlo"}
                </p>
                <h4 className="mt-1 font-display text-2xl leading-tight">
                  {actieveRij.bezet
                    ? "Er staat al iets ingepland"
                    : actieveRegel.over
                      ? "Deze dag is overgeslagen"
                      : (actieveNaam ?? "Geen passend gerecht gevonden")}
                </h4>
                {actieveRij.idee?.waarom ? (
                  <p className="mt-2 text-base text-muted-foreground">{actieveRij.idee.waarom}</p>
                ) : null}
                {redenen.length ? (
                  <p className="mt-2 text-base text-muted-foreground" data-redenen>
                    {redenen.map((r) => r.tekst).join(" · ")}
                  </p>
                ) : null}
                {/* Een nieuw idee van buiten heeft (nog) geen ingrediëntenlijst: zelf nakijken. */}
                {actieveRij.idee && kennis.allergieen.length ? (
                  <p className="mt-2 text-base font-semibold">
                    Kijk de ingrediënten zelf na op je allergieën: Foodlo kent ze voor een nieuw
                    idee nog niet.
                  </p>
                ) : null}
                {actieveRecept && !actieveRij.bezet
                  ? (() => {
                      const etiket = etiketVoorEters(
                        oordelenVoor(
                          {
                            id: actieveRecept.id,
                            title: actieveRecept.title,
                            tags: actieveRecept.tags ?? [],
                            ingredienten: ingredienten[actieveRecept.id] ?? [],
                          },
                          eters,
                        ),
                      );
                      return etiket ? (
                        <p
                          role="note"
                          data-testid="niet-geschikt"
                          className="mt-3 flex items-start gap-2 rounded-xl bg-honing-zacht px-3 py-2 text-base font-semibold text-honing-foreground"
                        >
                          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                          <span className="min-w-0">{etiket}</span>
                        </p>
                      ) : null;
                    })()
                  : null}
                {actieveRij.idee && eters.eters.length ? (
                  <p className="mt-2 text-base text-muted-foreground">
                    Kijk de ingrediënten van een nieuw idee zelf na voor wie meeeet: Foodlo kent ze
                    nog niet.
                  </p>
                ) : null}
                {actieveRecept ? (
                  <div className="mt-3">
                    <AllergieWaarschuwing
                      ingredienten={ingredienten[actieveRecept.id] ?? []}
                      titel={actieveRecept.title}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {!actieveRij.bezet ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-base font-semibold">
                    <Clock3 className="size-4 text-primary" /> Kooktijd
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIJD_KEUZES.map((tijd) => (
                      <Button
                        key={tijd.id}
                        type="button"
                        variant={actieveRegel.maxMinuten === tijd.id ? "default" : "outline"}
                        aria-pressed={actieveRegel.maxMinuten === tijd.id}
                        onClick={() => zetRegel(actieveRij.datum, { maxMinuten: tijd.id })}
                        className="h-12 whitespace-normal px-2 text-base"
                      >
                        {tijd.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-base font-semibold">
                    <Utensils className="size-4 text-primary" /> Type gerecht
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SOORT_KEUZES.map((soort) => (
                      <Button
                        key={soort.label}
                        type="button"
                        variant={actieveRegel.soort === soort.id ? "default" : "outline"}
                        aria-pressed={actieveRegel.soort === soort.id}
                        onClick={() => zetRegel(actieveRij.datum, { soort: soort.id })}
                        className="h-12 text-base"
                      >
                        {soort.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => setKeuzeOpen((open) => !open)}
                  className="h-14 w-full text-base"
                >
                  <RefreshCw className="size-5" /> Ik wil iets anders
                </Button>

                {keuzeOpen ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        wissel(actieveRij.datum, actieveRij.moment);
                        setKeuzeOpen(false);
                      }}
                      disabled={!!bezigMet}
                      className="h-14 w-full justify-start text-base"
                    >
                      <Sparkles className="size-5 text-primary" /> Ander voorstel uit mijn recepten
                    </Button>
                    <div className="rounded-xl border border-border p-3">
                      <p className="flex items-center gap-2 font-semibold">
                        <BookOpen className="size-5 text-primary" /> Zelf een gerecht kiezen
                      </p>
                      <Input
                        value={eigenZoek}
                        onChange={(event) => setEigenZoek(event.target.value)}
                        placeholder="Zoek in mijn recepten"
                        className="mt-3 h-12 text-base"
                      />
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {eigenResultaten.map((recept) => (
                          <GerechtKaart
                            key={recept.id}
                            recept={recept}
                            onKies={() => kiesEigenGerecht(actieveRij, recept)}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void kiesNieuwIdee(actieveRij)}
                      disabled={!!bezigMet}
                      className="h-14 w-full justify-start text-base"
                    >
                      {bezigMet ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <WandSparkles className="size-5 text-primary" />
                      )}{" "}
                      Nieuw idee van Foodlo{" "}
                      <span className="ml-auto text-base font-normal text-muted-foreground">
                        kost credits
                      </span>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className={`${keuzeOpen ? "" : "sticky bottom-0"} -mx-5 mt-6 border-t border-border bg-card px-5 py-4`}
            >
              {actieveStap < rijen.length - 1 ? (
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => gaVerder(false)}
                    className="h-14 text-base"
                  >
                    Overslaan
                  </Button>
                  <Button
                    disabled={!actieveNaam || actieveRij.bezet || !!bezigMet}
                    onClick={() => gaVerder(true)}
                    className="h-14 text-base"
                  >
                    <Check className="size-5" /> Goed, volgende dag
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    disabled={!actieveNaam || actieveRij.bezet || !!bezigMet}
                    onClick={() => gaVerder(true)}
                    variant={actieveRij.aan ? "secondary" : "default"}
                    className="h-14 w-full text-base"
                  >
                    <Check className="size-5" />{" "}
                    {actieveRij.aan ? "Deze dag is gekozen" : "Deze dag kiezen"}
                  </Button>
                  <Button
                    disabled={!aantalAan || !!bezigMet}
                    onClick={async () => {
                      setBezigMet("bezig");
                      try {
                        await onZet(rijen.filter((rij) => rij.aan));
                      } finally {
                        setBezigMet("");
                      }
                    }}
                    className="h-14 w-full text-base"
                  >
                    {bezigMet ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <>
                        Zet {aantalAan} {aantalAan === 1 ? "dag" : "dagen"} in mijn weekmenu
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
