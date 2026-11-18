/**
 * Receptversies (P3): vóór elke aanpassing (assistent "Aanpassen", porties bewaren, aanvullen of
 * opnieuw importeren, zelf bewerken, terugzetten) bewaart Foodlo de vorige stand. Zo blijft het
 * origineel altijd terug te halen; niets wordt stil overschreven.
 *
 * Opslag: de bestaande tabel `recipe_versions` (momentopname jsonb). Een momentopname is de stand
 * VÓÓR een wijziging, met de reden. Deze module is puur: staten, verschillen en de versielijst.
 */

export type VersieReden =
  "assistent" | "porties" | "aanvullen" | "import" | "bewerken" | "terugzetten";

export const REDEN_LABEL: Record<VersieReden, string> = {
  assistent: "Aangepast met de assistent",
  porties: "Porties bewaard",
  aanvullen: "Aangevuld door Foodlo",
  import: "Opnieuw geïmporteerd",
  bewerken: "Zelf bewerkt",
  terugzetten: "Vorige versie teruggezet",
};

export type StaatIngredient = {
  id?: string | undefined;
  name: string;
  quantity: number | null;
  unit: string | null;
  position?: number | null | undefined;
};

/** Wat een versie bewaart (en wat terugzetten terugschrijft). */
export type ReceptStaat = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  category: string;
  tags: string[];
  instructions: string[];
  step_ingredients: unknown;
  ingredienten: StaatIngredient[];
};

/** Velden die terugzetten op `recipes` terugschrijft (geen eigenaar, foto, datums of status). */
export const TERUG_TE_ZETTEN = [
  "title",
  "description",
  "servings",
  "prep_minutes",
  "cook_minutes",
  "difficulty",
  "category",
  "tags",
  "instructions",
  "step_ingredients",
] as const;

export type Momentopname = {
  recept: Record<string, unknown>;
  ingredienten: Record<string, unknown>[];
  reden?: VersieReden;
};

export type VersieRij = { id: string; created_at: string; momentopname: Momentopname };

const tekst = (v: unknown, standaard = "") => (typeof v === "string" ? v : standaard);
const getal = (v: unknown, standaard = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : standaard;
const lijst = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export function staatUit(
  recept: Record<string, unknown>,
  ingredienten: readonly Record<string, unknown>[],
): ReceptStaat {
  return {
    title: tekst(recept["title"]),
    description: tekst(recept["description"]),
    servings: getal(recept["servings"], 4),
    prep_minutes: getal(recept["prep_minutes"]),
    cook_minutes: getal(recept["cook_minutes"]),
    difficulty: tekst(recept["difficulty"]),
    category: tekst(recept["category"]),
    tags: lijst(recept["tags"]),
    instructions: lijst(recept["instructions"]),
    step_ingredients: recept["step_ingredients"] ?? null,
    ingredienten: [...ingredienten]
      .sort((a, b) => getal(a["position"], 1e9) - getal(b["position"], 1e9))
      .map((i) => ({
        id: typeof i["id"] === "string" ? i["id"] : undefined,
        name: tekst(i["name"]),
        quantity: typeof i["quantity"] === "number" ? i["quantity"] : null,
        unit: typeof i["unit"] === "string" ? i["unit"] : null,
        position: typeof i["position"] === "number" ? i["position"] : null,
      })),
  };
}

export function staatVanOpname(m: Momentopname): ReceptStaat {
  return staatUit(m.recept ?? {}, m.ingredienten ?? []);
}

/** De velden voor `recipes.update(...)` bij terugzetten. */
export function receptVelden(s: ReceptStaat): Record<(typeof TERUG_TE_ZETTEN)[number], unknown> {
  return {
    title: s.title,
    description: s.description,
    servings: s.servings,
    prep_minutes: s.prep_minutes,
    cook_minutes: s.cook_minutes,
    difficulty: s.difficulty,
    category: s.category,
    tags: s.tags,
    instructions: s.instructions,
    step_ingredients: s.step_ingredients,
  };
}

function hoeveel(i: StaatIngredient) {
  if (i.quantity == null) return "";
  return `${String(i.quantity).replace(".", ",")}${i.unit ? ` ${i.unit}` : ""}`;
}

const sleutel = (n: string) => n.trim().toLowerCase();

/**
 * Wat er veranderde van `a` naar `b`, in gewone taal ("bloem → rijstmeel", "Porties: 4 → 2").
 * Hooguit `max` regels; de rest als "en nog N wijzigingen".
 */
export function verschillen(a: ReceptStaat, b: ReceptStaat, max = 6): string[] {
  const uit: string[] = [];
  if (a.title !== b.title) uit.push(`Naam: “${a.title}” → “${b.title}”`);
  if (a.servings !== b.servings) uit.push(`Porties: ${a.servings} → ${b.servings}`);

  // Ingrediënten: zelfde naam met andere hoeveelheid, vervangen op dezelfde plaats, erbij, weg.
  const weg = a.ingredienten.filter(
    (x) => !b.ingredienten.some((y) => sleutel(y.name) === sleutel(x.name)),
  );
  const erbij = b.ingredienten.filter(
    (y) => !a.ingredienten.some((x) => sleutel(x.name) === sleutel(y.name)),
  );
  for (const x of a.ingredienten) {
    const y = b.ingredienten.find((z) => sleutel(z.name) === sleutel(x.name));
    if (y && hoeveel(x) !== hoeveel(y))
      uit.push(
        `${x.name}: ${hoeveel(x) || "geen hoeveelheid"} → ${hoeveel(y) || "geen hoeveelheid"}`,
      );
  }
  const vervangen: [StaatIngredient, StaatIngredient][] = [];
  for (const x of weg) {
    const plaats = a.ingredienten.indexOf(x);
    const y = erbij.find(
      (z) => b.ingredienten.indexOf(z) === plaats && !vervangen.some(([, w]) => w === z),
    );
    if (y) vervangen.push([x, y]);
  }
  for (const [x, y] of vervangen) uit.push(`${x.name} → ${y.name}`);
  for (const x of weg) if (!vervangen.some(([w]) => w === x)) uit.push(`Zonder ${x.name}`);
  for (const y of erbij) if (!vervangen.some(([, w]) => w === y)) uit.push(`Met ${y.name}`);

  if (a.instructions.join("\n") !== b.instructions.join("\n"))
    uit.push(
      a.instructions.length !== b.instructions.length
        ? `Stappen: ${a.instructions.length} → ${b.instructions.length}`
        : "Stappen aangepast",
    );
  const tagsErbij = b.tags.filter((t) => !a.tags.includes(t));
  const tagsWeg = a.tags.filter((t) => !b.tags.includes(t));
  if (tagsErbij.length || tagsWeg.length)
    uit.push(
      `Labels: ${[...tagsErbij.map((t) => `+ ${t}`), ...tagsWeg.map((t) => `− ${t}`)].join(", ")}`,
    );
  if (a.prep_minutes + a.cook_minutes !== b.prep_minutes + b.cook_minutes)
    uit.push(`Tijd: ${a.prep_minutes + a.cook_minutes} → ${b.prep_minutes + b.cook_minutes} min`);
  if (a.description !== b.description) uit.push("Beschrijving aangepast");
  if (a.category !== b.category) uit.push(`Soort: ${a.category} → ${b.category}`);
  if (a.difficulty !== b.difficulty) uit.push(`Moeilijkheid: ${a.difficulty} → ${b.difficulty}`);

  if (uit.length > max) {
    const rest = uit.length - (max - 1);
    return [...uit.slice(0, max - 1), `en nog ${rest} wijzigingen`];
  }
  return uit;
}

export function gelijk(a: ReceptStaat, b: ReceptStaat) {
  return verschillen(a, b, 99).length === 0;
}

export type VersieItem = {
  /** Sleutel voor React; de id van de momentopname, of "nu". */
  sleutel: string;
  soort: "huidig" | "origineel" | "oudste" | "versie";
  staat: ReceptStaat;
  /** Sinds wanneer deze stand gold (ISO), of null als onbekend. */
  sinds: string | null;
  /** De wijziging die tot deze stand leidde (niet voor het origineel). */
  wijziging: { reden: VersieReden | null; label: string; wat: string[] } | null;
  /** Id van de momentopname om terug te zetten (null voor de huidige stand). */
  versieId: string | null;
};

/**
 * De versielijst, nieuwste eerst: de huidige stand, dan elke bewaarde stand. Bij `max` of meer
 * bewaarde versies is de oudste niet zeker het origineel (oudere zijn opgeruimd).
 */
export function versieLijst(
  rijen: readonly VersieRij[],
  huidig: ReceptStaat,
  opties: { aangemaakt?: string | null; bijgewerkt?: string | null; max?: number } = {},
): VersieItem[] {
  const max = opties.max ?? 20;
  const oplopend = [...rijen].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const staten = [...oplopend.map((r) => staatVanOpname(r.momentopname)), huidig];
  const items: VersieItem[] = staten.map((staat, k) => {
    const isHuidig = k === staten.length - 1;
    const vorige = k > 0 ? oplopend[k - 1]! : null;
    const reden = vorige?.momentopname.reden ?? null;
    return {
      sleutel: isHuidig ? "nu" : oplopend[k]!.id,
      soort: isHuidig
        ? "huidig"
        : k === 0
          ? oplopend.length >= max
            ? "oudste"
            : "origineel"
          : "versie",
      staat,
      sinds:
        k === 0
          ? ((tekst(oplopend[0]?.momentopname.recept?.["created_at"]) || opties.aangemaakt) ?? null)
          : vorige!.created_at,
      wijziging:
        k === 0
          ? null
          : {
              reden,
              label: reden ? REDEN_LABEL[reden] : "Aangepast",
              wat: verschillen(staten[k - 1]!, staat),
            },
      versieId: isHuidig ? null : oplopend[k]!.id,
    };
  });
  return items.reverse();
}

/** "18 november om 14:05" (Belgische notatie, 24 u). */
export function versieDatum(iso: string | null): string {
  if (!iso) return "datum onbekend";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "datum onbekend";
  const dag = d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
  const uur = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dag} om ${uur}`;
}

/** Porties bewaren (P3): alle hoeveelheden mee schalen, afgerond op 2 decimalen. */
export function schaalStaat(s: ReceptStaat, personen: number): ReceptStaat {
  const factor = s.servings > 0 ? personen / s.servings : 1;
  return {
    ...s,
    servings: personen,
    ingredienten: s.ingredienten.map((i) => ({
      ...i,
      quantity: i.quantity == null ? null : Math.round(i.quantity * factor * 100) / 100,
    })),
  };
}
