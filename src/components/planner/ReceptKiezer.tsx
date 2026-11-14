/** WP6 — recept kiezen voor een maaltijd (uit routes/planner.tsx, ongewijzigd). */
import { hintVoorAI, voorAI } from "@/lib/ai/privacy";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  Type,
  Pencil,
  RefreshCw,
  Lightbulb,
  Globe,
  CalendarDays,
  Clock3,
  BookOpen,
  Search,
  Heart,
  SlidersHorizontal,
  ChevronDown,
  UtensilsCrossed,
  Minus,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";
import { useAuth } from "@/hooks/useAuth";
import { ingredientToLine } from "@/lib/ingredienten";
import { ideeTitelToegelaten } from "@/lib/veiligheid";
import { leesKennismaking, standaardPersonen } from "@/lib/kennismaking";
import { AllergieWaarschuwing } from "@/components/AllergieWaarschuwing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORIES, type Recipe } from "@/lib/types";
import {
  importRecipeFromText,
  importRecipeFromUrl,
  receptVanNaam,
  weekmenuIdeeen,
  zoekReceptenOpWeb,
  type WeekmenuIdee,
  type WebResultaat,
} from "@/lib/ai.functions";
import { useVoorkeuren, type WeekmenuInstelling } from "@/lib/voorkeuren";
import { tijdLabel } from "@/lib/tijd";
import { datumTekst, labelVoor, type NieuwExtra, type Basis } from "./gedeeld";
import {
  EtersWaarschuwing,
  WieEetMee,
  oordeelVoorGerecht,
  useMeeEters,
  useVeiligheidVoorEters,
} from "./WieEetMee";

export function GerechtKaart({
  recept,
  onKies,
  waarschuwing,
}: {
  recept: Recipe;
  onKies: () => void;
  /** "Niet veilig voor Lotte" (mee-eters); nooit de reden zonder toestemming. */
  waarschuwing?: string | null;
}) {
  const [fout, setFout] = useState(false);
  const info = [tijdLabel(recept.prep_minutes, recept.cook_minutes), recept.category]
    .filter(Boolean)
    .join(" · ");
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onKies}
      className="h-auto min-h-20 w-full items-center justify-start gap-3 whitespace-normal rounded-xl bg-card p-2 text-left active:bg-secondary"
    >
      {recept.image_url && !fout ? (
        <img
          src={recept.image_url}
          alt=""
          loading="lazy"
          onError={() => setFout(true)}
          className="size-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xl text-primary"
        >
          {recept.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-base font-semibold leading-snug">
          {recept.title}
        </span>
        {info && (
          <span className="mt-0.5 block text-base font-normal text-muted-foreground">{info}</span>
        )}
        {waarschuwing ? (
          <span className="mt-1 flex items-start gap-1.5 text-base font-semibold text-honing-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{waarschuwing}</span>
          </span>
        ) : null}
      </span>
      <Plus className="size-5 shrink-0 text-primary" aria-hidden />
    </Button>
  );
}

export function ReceptKiezer({
  week,
  momenten,
  instelling,
  start,
  onSluit,
  onKies,
  onNieuw,
  gezinId = null,
}: {
  week: string[];
  momenten: string[];
  instelling: WeekmenuInstelling;
  start: { datum: string; moment: string; vraagDag?: boolean };
  onSluit: () => void;
  onKies: (
    id: string,
    datum: string,
    moment: string,
    titel: string,
    personen: number,
    eters?: string[],
  ) => void;
  onNieuw: (
    naam: string,
    basis: Basis | null,
    datum: string,
    moment: string,
    extra?: NieuwExtra,
    personen?: number,
    eters?: string[],
  ) => void;
  /** Gezin voor "Wie eet mee?" (voorstel 0010); zonder gezin blijft de personenteller. */
  gezinId?: string | null;
}) {
  const { user } = useAuth();
  const { taal } = useVoorkeuren();
  const [zoek, setZoek] = useState("");
  const [datum, setDatum] = useState(start.datum);
  const [moment, setMoment] = useState(start.moment);
  const [dagKiezen, setDagKiezen] = useState(!!start.vraagDag);
  const [aiBezig, setAiBezig] = useState(false);
  // Voor hoeveel personen kook je dit gerecht? Eén keer gevraagd bij het inplannen.
  // Standaard: je gezinsgrootte uit de kennismaking (ronde 3), anders 4.
  const [eigenPersonen, setPersonen] = useState(() =>
    standaardPersonen(leesKennismaking(user?.id)),
  );
  // Met gezinsleden volgt het aantal personen de mee-eters (+ gasten).
  const mee = useMeeEters(gezinId);
  const personen = mee.actief ? mee.personen : eigenPersonen;
  const eters = mee.actief ? mee.gekozen : undefined;
  const [voorstel, setVoorstel] = useState<Basis | null>(null);
  const [voorstelNaam, setVoorstelNaam] = useState("");
  const [ideeen, setIdeeen] = useState<WeekmenuIdee[] | null>(null);
  const kennis = leesKennismaking(user?.id);
  const allergieen = kennis.allergieen;
  const [ideeenBezig, setIdeeenBezig] = useState(false);
  const [webTerm, setWebTerm] = useState("");
  const [webBezig, setWebBezig] = useState(false);
  const [webResultaten, setWebResultaten] = useState<WebResultaat[] | null>(null);
  const [bron, setBron] = useState<"recepten" | "inspiratie" | "nieuw">("recepten");
  const [receptFilter, setReceptFilter] = useState<"voor-jou" | "favorieten" | "recent" | "alles">(
    "alles",
  );
  const [soortFilter, setSoortFilter] = useState<string | null>(null);

  /** Zet een AI- of webrecept klaar in het bevestigscherm. */
  function toonVoorstel(
    naam: string,
    r: {
      title: string;
      description?: string | null;
      servings?: number;
      prep_minutes?: number;
      cook_minutes?: number;
      category?: string;
      difficulty?: string;
      tags?: string[];
      instructions?: string[];
      image_url?: string | null;
      source_url?: string | null;
      ingredients?: { name: string; quantity: number | null; unit: string }[];
    },
  ) {
    setVoorstelNaam(r.title || naam);
    setVoorstel({
      title: r.title || naam,
      description: r.description ?? "",
      servings: r.servings ?? 4,
      prep_minutes: r.prep_minutes ?? 0,
      cook_minutes: r.cook_minutes ?? 0,
      category: r.category ?? "hoofdgerecht",
      difficulty: r.difficulty ?? "makkelijk",
      tags: r.tags ?? [],
      instructions: r.instructions ?? [],
      image_url: r.image_url ?? null,
      source_url: r.source_url ?? null,
      ingredienten: (r.ingredients ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit ?? "",
      })),
    });
  }

  /** Drie passende AI-ideeën voor deze dag, met je weekvoorkeuren. */
  async function laadIdeeen() {
    setIdeeenBezig(true);
    try {
      const dagIdx = (new Date(`${datum}T12:00:00`).getDay() + 6) % 7;
      const dagVoorkeur = instelling.perDag[String(dagIdx)];
      const wensen = [
        instelling.vlees ? `vlees: ${instelling.vlees}` : "",
        instelling.vis ? `vis: ${instelling.vis}` : "",
        instelling.vega ? `vega: ${instelling.vega}` : "",
        dagVoorkeur?.soort ? `deze dag liefst ${dagVoorkeur.soort}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const res = await weekmenuIdeeen({
        data: {
          aantal: 3,
          wensen,
          vermijd: voorAI(instelling.vermijd).tekst,
          maxMinuten: dagVoorkeur?.maxMinuten ?? instelling.maxMinuten,
          bekend: recipes.map((r) => r.title).slice(0, 60),
        },
      });
      // Je allergieën en dieet gaan nooit naar de AI. Wat al in de titel een allergeen of iets
      // buiten je dieet noemt, valt hier af;
      // de rest wordt nagekeken zodra het recept met ingrediënten gemaakt is.
      const veilig = res.filter((i) => ideeTitelToegelaten(i.title, kennis));
      setIdeeen(veilig);
      if (!veilig.length) toast.error("De AI vond nu geen ideeën. Probeer later opnieuw.");
    } catch {
      toast.error("Ideeën ophalen lukte niet");
    } finally {
      setIdeeenBezig(false);
    }
  }

  /** Maakt van een gekozen idee meteen een volledig recept om te bevestigen. */
  async function maakReceptVanIdee(titel: string) {
    setAiBezig(true);
    try {
      const r = await receptVanNaam({
        data: {
          titel,
          hint: hintVoorAI(instelling.vermijd ? `Vermijd: ${instelling.vermijd}` : ""),
        },
      });
      toonVoorstel(titel, r);
    } catch {
      toast.error("De AI kon geen recept maken. Probeer opnieuw.");
    } finally {
      setAiBezig(false);
    }
  }

  /** Zoekt echte receptpagina's op het web (gratis). */
  async function zoekWeb(zoekterm: string) {
    const opgekuist = zoekterm.trim();
    if (opgekuist.length < 3) return;
    setWebBezig(true);
    try {
      const taalkeuze = (["nl", "en", "fr", "de"].includes(taal) ? taal : "nl") as
        "nl" | "en" | "fr" | "de";
      const res = await zoekReceptenOpWeb({ data: { term: opgekuist, taal: taalkeuze } });
      setWebResultaten(res);
      if (!res.length) toast.error("Geen receptpagina's gevonden. Probeer een andere naam.");
    } catch {
      toast.error("Zoeken op het web lukte niet");
    } finally {
      setWebBezig(false);
    }
  }

  /** Leest het gekozen webrecept in en toont het ter bevestiging. */
  async function kiesWeb(r: WebResultaat) {
    setWebBezig(true);
    try {
      const imp = await importRecipeFromUrl({ data: { url: r.url } });
      if (!imp.title || imp.fout) {
        toast.error(imp.fout || "Op die pagina staat geen leesbaar recept");
        return;
      }
      toonVoorstel(imp.title, imp);
    } catch {
      toast.error("Recept inlezen lukte niet");
    } finally {
      setWebBezig(false);
    }
  }

  async function maakVoorstel(naam: string) {
    setAiBezig(true);
    setVoorstelNaam(naam);
    try {
      const ai = await importRecipeFromText({
        data: { text: `Maak een volledig recept voor: ${naam}` },
      });
      setVoorstel({
        title: ai.title || naam,
        description: ai.description,
        servings: ai.servings || 4,
        prep_minutes: ai.prep_minutes || 0,
        cook_minutes: ai.cook_minutes || 0,
        category: ai.category || "hoofdgerecht",
        difficulty: ai.difficulty || "makkelijk",
        tags: ai.tags ?? [],
        instructions: ai.instructions ?? [],
        ingredienten: (ai.ingredients ?? []).map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit ?? "",
        })),
      });
    } catch {
      toast.error("De AI kon geen recept maken. Probeer opnieuw of kies gewone tekst.");
    } finally {
      setAiBezig(false);
    }
  }

  const {
    data: recipes = [],
    isLoading: receptenLaden,
    isError: receptenFout,
    refetch: herlaadRecepten,
  } = useQuery({
    queryKey: ["recipes"],
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });

  const { data: favorieten = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("recipe_id");
      if (error) throw error;
      return data.map((f) => f.recipe_id as string);
    },
  });

  // Wanneer stond een gerecht voor het laatst (of eerstkomend) in de planning?
  const { data: laatst = {} } = useQuery({
    queryKey: ["planner-laatst", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date")
        .not("recipe_id", "is", null)
        .order("plan_date", { ascending: false })
        .limit(400);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data) {
        const id = r.recipe_id as string;
        if (!map[id]) map[id] = r.plan_date as string;
      }
      return map;
    },
  });

  const term = zoek.trim();
  const dezeWeek = new Set(
    Object.entries(laatst)
      .filter(([, d]) => d >= week[0]! && d <= week[6]!)
      .map(([id]) => id),
  );
  const favorietenLijst = recipes.filter((r) => favorieten.includes(r.id));
  const voorgesteld = recipes
    .filter((r) => !dezeWeek.has(r.id))
    .sort((a, b) => (laatst[a.id] ?? "").localeCompare(laatst[b.id] ?? ""))
    .slice(0, 6);
  const recent = recipes
    .filter((r) => laatst[r.id])
    .sort((a, b) => (laatst[b.id] ?? "").localeCompare(laatst[a.id] ?? ""))
    .slice(0, 12);
  const alles = [...recipes].sort((a, b) => a.title.localeCompare(b.title, "nl"));

  const filterOpties = [
    { id: "alles", label: "Alle recepten", uitleg: "Alfabetisch", icon: BookOpen },
    { id: "voor-jou", label: "Aanraders", uitleg: "Past bij deze week", icon: Sparkles },
    { id: "favorieten", label: "Favorieten", uitleg: "Door jou bewaard", icon: Heart },
    { id: "recent", label: "Recent gebruikt", uitleg: "Onlangs ingepland", icon: Clock3 },
  ] as const;
  const actiefFilter = filterOpties.find((optie) => optie.id === receptFilter) ?? filterOpties[0];
  const receptenVoorFilter =
    receptFilter === "favorieten"
      ? favorietenLijst
      : receptFilter === "recent"
        ? recent
        : receptFilter === "alles"
          ? alles
          : voorgesteld;
  const receptenMetSoort = soortFilter
    ? receptenVoorFilter.filter((r) => (r.category ?? "hoofdgerecht") === soortFilter)
    : receptenVoorFilter;
  const gefilterdeRecepten = term
    ? receptenMetSoort.filter((r) => r.title.toLowerCase().includes(term.toLowerCase()))
    : receptenMetSoort;
  const waarschuwingVoor = useVeiligheidVoorEters(mee, gefilterdeRecepten, user?.id);
  const actieveSoortLabel = soortFilter
    ? soortFilter.charAt(0).toUpperCase() + soortFilter.slice(1)
    : null;

  if (voorstel) {
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) setVoorstel(null);
        }}
      >
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0">
          <SheetHeader className="text-left">
            <SheetTitle>Controleer het recept</SheetTitle>
            <SheetDescription>Bekijk de gegevens voor je het bewaart en inplant.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            <p className="text-xl font-semibold">{voorstel.title}</p>
            {voorstel.description && (
              <p className="text-base text-muted-foreground">{voorstel.description}</p>
            )}
            <p className="text-base text-muted-foreground">
              {[
                `${voorstel.servings} personen`,
                tijdLabel(voorstel.prep_minutes, voorstel.cook_minutes),
                voorstel.category,
                voorstel.difficulty,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <AllergieWaarschuwing
              ingredienten={voorstel.ingredienten.map((i) => i.name)}
              titel={voorstel.title}
            />
            <EtersWaarschuwing
              tekst={oordeelVoorGerecht(
                mee,
                { title: voorstel.title, ingredienten: voorstel.ingredienten.map((i) => i.name) },
                user?.id,
              )}
            />
            {voorstel.ingredienten.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Ingrediënten</h3>
                <ul className="mt-1 list-inside list-disc text-base">
                  {voorstel.ingredienten.map((i, idx) => (
                    <li key={idx}>{ingredientToLine(i)}</li>
                  ))}
                </ul>
              </div>
            )}
            {voorstel.instructions.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Zo maak je het</h3>
                <ol className="mt-1 list-inside list-decimal text-base">
                  {voorstel.instructions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setVoorstel(null)}
              className="h-14 flex-1 text-base"
            >
              Terug
            </Button>
            <Button
              onClick={() =>
                onNieuw(
                  voorstelNaam || voorstel.title,
                  voorstel,
                  datum,
                  moment,
                  undefined,
                  personen,
                  eters,
                )
              }
              className="mt-0 h-14 flex-[2] text-base"
            >
              <Check className="size-5" /> Bevestigen
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const dagKeuze = (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Kies een dag">
        {week.map((d) => (
          <Button
            key={d}
            type="button"
            onClick={() => setDatum(d)}
            aria-pressed={d === datum}
            variant={d === datum ? "default" : "outline"}
            className="h-14 min-w-20 shrink-0 flex-col gap-0 px-3 capitalize"
          >
            <span className="text-base font-medium">
              {new Date(`${d}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "short" })}
            </span>
            <span className="text-base font-semibold">{new Date(`${d}T12:00:00`).getDate()}</span>
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-14 w-full justify-start text-base">
            <CalendarDays className="size-5" /> {labelVoor(datum)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={new Date(`${datum}T12:00:00`)}
            onSelect={(keuze) => {
              if (keuze) setDatum(datumTekst(keuze));
            }}
          />
        </PopoverContent>
      </Popover>

      {momenten.length > 1 && (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Kies een moment">
          {momenten.map((m) => (
            <Button
              key={m}
              type="button"
              onClick={() => setMoment(m)}
              aria-pressed={m === moment}
              variant={m === moment ? "default" : "outline"}
              className="h-14 px-2 text-base capitalize"
            >
              {m}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  // Stap 1 (enkel bij de algemene knop): eerst de dag kiezen.
  if (dagKiezen) {
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onSluit();
        }}
      >
        <SheetContent side="bottom" className="space-y-5">
          <SheetHeader className="text-left">
            <SheetTitle>Wanneer wil je iets plannen?</SheetTitle>
            <SheetDescription>Kies een dag en een maaltijdmoment.</SheetDescription>
          </SheetHeader>
          {dagKeuze}
          <Button onClick={() => setDagKiezen(false)} className="mt-4 h-14 w-full text-base">
            Verder naar maaltijd <ChevronRight className="size-5" />
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onSluit();
      }}
    >
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
          <SheetTitle>Kies een maaltijd</SheetTitle>
          <SheetDescription asChild>
            <Button
              variant="ghost"
              onClick={() => setDagKiezen(true)}
              className="h-auto min-h-0 w-fit justify-start p-0 text-base font-semibold capitalize text-primary"
            >
              {labelVoor(datum)}
              {moment && moment !== "maaltijd" ? ` · ${moment}` : ""}{" "}
              <span className="font-normal underline underline-offset-4">Wijzig</span>
            </Button>
          </SheetDescription>
        </SheetHeader>

        {mee.actief ? (
          <WieEetMee mee={mee} />
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className="text-base font-medium">Voor hoeveel personen?</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPersonen(Math.max(1, eigenPersonen - 1))}
                aria-label="Minder personen"
                className="size-12 bg-card"
              >
                <Minus className="size-5" />
              </Button>
              <span className="min-w-8 text-center text-lg font-semibold">{personen}</span>
              <Button
                variant="secondary"
                onClick={() => setPersonen(Math.min(50, eigenPersonen + 1))}
                aria-label="Meer personen"
                className="size-12 bg-card"
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>
        )}

        <div className="border-b border-border px-4 py-3">
          <div
            className="grid grid-cols-3 rounded-lg bg-secondary p-1"
            role="tablist"
            aria-label="Kies hoe je een maaltijd toevoegt"
          >
            {(
              [
                ["recepten", "Recepten"],
                ["inspiratie", "Inspiratie"],
                ["nieuw", "Nieuw"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                role="tab"
                aria-selected={bron === id}
                variant={bron === id ? "default" : "ghost"}
                onClick={() => setBron(id)}
                className="h-12 min-w-0 px-2 text-base"
              >
                <span className="truncate">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {bron === "recepten" ? (
          <>
            <div className="px-4 pt-4">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={zoek}
                    onChange={(e) => setZoek(e.target.value)}
                    placeholder="Wat wil je eten?"
                    aria-label="Wat wil je eten?"
                    className="h-14 w-full pl-12 text-base"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-14 shrink-0 px-3"
                      aria-label={`Filter recepten: ${actiefFilter.label}`}
                    >
                      <SlidersHorizontal className="size-5" />
                      <span className="hidden min-[360px]:inline">Filter</span>
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-64 rounded-xl bg-card p-2 shadow-xl"
                  >
                    <DropdownMenuLabel className="px-3 py-1 text-base font-semibold uppercase tracking-wide text-muted-foreground">
                      Welke recepten
                    </DropdownMenuLabel>
                    {filterOpties.map(({ id, label, uitleg, icon: Icon }) => (
                      <DropdownMenuItem
                        key={id}
                        onSelect={() => setReceptFilter(id)}
                        className="min-h-14 rounded-lg px-3 text-base"
                      >
                        <Icon className="size-5 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{label}</span>
                          <span className="block text-base text-muted-foreground">{uitleg}</span>
                        </span>
                        {receptFilter === id ? (
                          <Check className="size-5 text-primary" aria-hidden />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuLabel className="px-3 py-1 text-base font-semibold uppercase tracking-wide text-muted-foreground">
                      Type gerecht
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={() => setSoortFilter(null)}
                      className="min-h-12 rounded-lg px-3 text-base"
                    >
                      <UtensilsCrossed className="size-5 text-primary" />
                      <span className="min-w-0 flex-1 font-semibold">Alle types</span>
                      {soortFilter === null ? (
                        <Check className="size-5 text-primary" aria-hidden />
                      ) : null}
                    </DropdownMenuItem>
                    {CATEGORIES.map((soort) => (
                      <DropdownMenuItem
                        key={soort}
                        onSelect={() => setSoortFilter(soort)}
                        className="min-h-12 rounded-lg px-3 text-base"
                      >
                        <span className="size-5" aria-hidden />
                        <span className="min-w-0 flex-1 capitalize">{soort}</span>
                        {soortFilter === soort ? (
                          <Check className="size-5 text-primary" aria-hidden />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-base font-semibold">
                  {actiefFilter.label}
                  {actieveSoortLabel ? ` · ${actieveSoortLabel}` : ""}
                </p>
                <p className="text-base text-muted-foreground">
                  {gefilterdeRecepten.length}{" "}
                  {gefilterdeRecepten.length === 1 ? "recept" : "recepten"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {receptenLaden ? (
                <div className="grid min-h-40 place-items-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  <span>Recepten laden…</span>
                </div>
              ) : receptenFout ? (
                <div className="py-8 text-center">
                  <p className="text-base text-muted-foreground">Je recepten konden niet laden.</p>
                  <Button variant="outline" onClick={() => void herlaadRecepten()} className="mt-3">
                    <RefreshCw className="size-5" /> Opnieuw proberen
                  </Button>
                </div>
              ) : gefilterdeRecepten.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-base text-muted-foreground">
                    {term
                      ? `Geen resultaat binnen ${actiefFilter.label.toLowerCase()}${actieveSoortLabel ? ` · ${actieveSoortLabel.toLowerCase()}` : ""}.`
                      : `Nog niets bij ${actiefFilter.label.toLowerCase()}${actieveSoortLabel ? ` · ${actieveSoortLabel.toLowerCase()}` : ""}.`}
                  </p>
                  {term ? (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setReceptFilter("alles");
                          setSoortFilter(null);
                        }}
                      >
                        <BookOpen className="size-5" /> Zoek in alle recepten
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setBron("nieuw");
                        }}
                      >
                        <Plus className="size-5" /> Voeg “{term}” toe
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReceptFilter("alles");
                        setSoortFilter(null);
                      }}
                      className="mt-3"
                    >
                      <BookOpen className="size-5" /> Toon alle recepten
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {gefilterdeRecepten.map((r) => (
                    <li key={r.id}>
                      <GerechtKaart
                        recept={r}
                        onKies={() => onKies(r.id, datum, moment, r.title, personen, eters)}
                        waarschuwing={waarschuwingVoor(r)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {term ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onNieuw(term, null, datum, moment, undefined, personen, eters)}
                      className="h-auto min-h-14 w-full justify-start whitespace-normal text-left text-base"
                    >
                      <Type className="size-5" /> “{term}” inplannen zonder recept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        onNieuw(term, null, datum, moment, { maakRecept: true }, personen, eters)
                      }
                      className="h-auto min-h-14 w-full justify-start whitespace-normal text-left text-base"
                    >
                      <Plus className="size-5" /> Inplannen en recept maken of importeren
                    </Button>
                  </>
                ) : null}
                <p className="px-1 pt-1 text-base font-semibold text-muted-foreground">
                  Snel kiezen
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["Restjes", "restjes"],
                      ["Uit eten", "uit_eten"],
                      ["Later bepalen", "later"],
                    ] as const
                  ).map(([label, soort]) => (
                    <Button
                      key={soort}
                      variant="secondary"
                      onClick={() =>
                        onNieuw(label, null, datum, moment, { soort }, personen, eters)
                      }
                      className="h-14 min-w-0 whitespace-normal px-2 text-base leading-tight"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setBron("inspiratie")}
                  className="h-14 w-full justify-start text-base"
                >
                  <Lightbulb className="size-5" /> Inspiratie nodig?
                </Button>
              </div>
            </div>
          </>
        ) : bron === "inspiratie" ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 size-5 text-primary" />
                <div>
                  <p className="font-semibold">Laat Foodlo voorstellen</p>
                  <p className="text-base text-muted-foreground">
                    Past bij je voorkeuren en kooktijd · kost credits
                  </p>
                </div>
              </div>
              <Button
                disabled={ideeenBezig || aiBezig}
                onClick={() => void laadIdeeen()}
                className="mt-3 h-14 w-full text-base"
              >
                {ideeenBezig ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Sparkles className="size-5" />
                )}
                {ideeenBezig ? "Foodlo denkt…" : "Toon drie voorstellen"}
              </Button>
              {ideeen && ideeen.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {ideeen.map((idee) => (
                    <li key={idee.title}>
                      <Button
                        variant="outline"
                        disabled={aiBezig}
                        onClick={() => void maakReceptVanIdee(idee.title)}
                        className="h-auto min-h-16 w-full justify-start whitespace-normal py-3 text-left"
                      >
                        <span>
                          <span className="block font-semibold">{idee.title}</span>
                          <span className="block text-base font-normal text-muted-foreground">
                            {[idee.waarom, `±${idee.minuten} min`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {ideeen && ideeen.length > 0 && allergieen.length > 0 ? (
                <p className="mt-3 text-base text-muted-foreground">
                  Deze ideeën zijn nog niet nagekeken op je allergieën. Kies je er een, dan kijkt
                  Foodlo de ingrediënten na voor je het bewaart.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Globe className="mt-1 size-5 text-primary" />
                <div>
                  <p className="font-semibold">Zoek op het web</p>
                  <p className="text-base text-muted-foreground">
                    Vind een bestaand recept van een echte website · gratis
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={webTerm}
                  onChange={(e) => setWebTerm(e.target.value)}
                  placeholder="Bijv. pasta Jeroen Meus"
                  aria-label="Zoek een gerecht op het web"
                  className="h-14 text-base"
                />
                <Button
                  disabled={webBezig || webTerm.trim().length < 3}
                  onClick={() => void zoekWeb(webTerm)}
                  className="h-14 shrink-0 px-4"
                >
                  {webBezig ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Search className="size-5" />
                  )}
                  <span className="sr-only">Zoek</span>
                </Button>
              </div>
              {webResultaten && webResultaten.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {webResultaten.map((r) => (
                    <li key={r.url}>
                      <Button
                        variant="outline"
                        disabled={webBezig}
                        onClick={() => void kiesWeb(r)}
                        className="h-auto min-h-16 w-full justify-start whitespace-normal py-3 text-left"
                      >
                        <span>
                          <span className="block font-semibold">{r.titel}</span>
                          <span className="block text-base font-normal text-muted-foreground">
                            {[r.site, r.minuten ? `±${r.minuten} min` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            <div>
              <label htmlFor="nieuwe-maaltijd" className="text-base font-semibold">
                Hoe heet de maaltijd?
              </label>
              <Input
                id="nieuwe-maaltijd"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Bijv. soep met brood"
                className="mt-2 h-14 text-base"
              />
            </div>
            {term ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => onNieuw(term, null, datum, moment, undefined, personen, eters)}
                  className="h-14 w-full justify-start text-base"
                >
                  <Type className="size-5" /> Alleen als naam inplannen
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    onNieuw(term, null, datum, moment, { maakRecept: true }, personen, eters)
                  }
                  className="h-14 w-full justify-start text-base"
                >
                  <Pencil className="size-5" /> Zelf een recept maken of importeren
                </Button>
                <Button
                  disabled={aiBezig}
                  onClick={() => void maakVoorstel(term)}
                  className="h-14 w-full justify-start text-base"
                >
                  {aiBezig ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}{" "}
                  {aiBezig ? "Foodlo maakt het recept…" : "Maak er een volledig recept van"}
                </Button>
                <p className="px-1 text-base text-muted-foreground">
                  Een volledig recept maken kost credits. Je controleert het eerst.
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-secondary p-4 text-base text-muted-foreground">
                Typ een naam. Daarna kies je of alleen de naam genoeg is, of Foodlo een volledig
                recept maakt.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
