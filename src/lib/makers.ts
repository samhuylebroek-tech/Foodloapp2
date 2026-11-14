/**
 * Makers (creators), publiceren en community: pure regels zonder databank, zodat ze getest zijn.
 *
 * Grondregels (COMMERCIAL_ROADMAP §1–2, MODULE_DESIGNS §5–6):
 * - niets wordt openbaar zonder uitdrukkelijke keuze; openbaar gaat eerst langs moderatie;
 * - allergie- en dieetregels gelden ook voor makerrecepten (de schermen gebruiken `veiligheid.ts`);
 * - een maker ziet alleen geaggregeerde cijfers, nooit wie volgt of bewaarde.
 */

export type Zichtbaarheid = "prive" | "vrienden" | "openbaar";
export type PublicatieStatus = "concept" | "gepubliceerd";
export type Moderatie = "wacht" | "goedgekeurd" | "afgewezen" | null;

export type Maker = {
  id: string;
  user_id: string;
  handle: string;
  naam: string;
  bio: string | null;
  specialisaties: string[];
  omslag_url: string | null;
  avatar_url: string | null;
  geverifieerd: boolean;
  created_at?: string;
};

export type Publicatie = {
  id: string;
  recipe_id: string;
  creator_id: string;
  zichtbaarheid: Zichtbaarheid;
  status: PublicatieStatus;
  gepubliceerd_op: string | null;
  video_url: string | null;
  moderatie?: Moderatie;
};

/** Openbare inhoud gaat eerst langs moderatie (C1 vóór elke publieke inhoud). */
export const MODERATIE_VOORAF = true;

export const ZICHTBAARHEDEN: { waarde: Zichtbaarheid; label: string; uitleg: string }[] = [
  { waarde: "prive", label: "Privé", uitleg: "Alleen jij ziet dit recept." },
  {
    waarde: "vrienden",
    label: "Vrienden en gezin",
    uitleg: "Wie jij recepten laat zien (Vrienden en gezin) ziet dit recept.",
  },
  {
    waarde: "openbaar",
    label: "Openbaar",
    uitleg: "Iedereen met Foodlo ziet dit recept op je makerpagina.",
  },
];

export function zichtbaarheidLabel(z: Zichtbaarheid): string {
  return ZICHTBAARHEDEN.find((x) => x.waarde === z)?.label ?? "Privé";
}

/** Woorden die geen handle mogen zijn (verwarring met schermen of met het Foodlo-team). */
const GERESERVEERD = new Set([
  "admin",
  "beheer",
  "foodlo",
  "foodloapp",
  "maker",
  "makers",
  "nieuw",
  "support",
  "hulp",
  "team",
  "moderatie",
  "officieel",
]);

/** "@Lotte Kookt!" → "lotte-kookt": kleine letters, zonder accenten, spaties worden streepjes. */
export function normaliseerHandle(invoer: string): string {
  return invoer
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Foutmelding in gewone taal, of `null` als de handle goed is. `bezet`: handles van andere makers
 * (de databank heeft ook een unieke index; dit is de vriendelijke uitleg vooraf).
 */
export function valideerHandle(handle: string, bezet: readonly string[] = []): string | null {
  if (handle.length < 3) return "Kies minstens 3 tekens.";
  if (handle.length > 30) return "Kies hoogstens 30 tekens.";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle))
    return "Gebruik alleen kleine letters, cijfers en streepjes (niet aan het begin of einde).";
  if (handle.includes("--")) return "Gebruik geen twee streepjes na elkaar.";
  if (GERESERVEERD.has(handle)) return "Deze naam is voorbehouden. Kies een andere.";
  if (bezet.map((b) => b.toLowerCase()).includes(handle))
    return "Deze naam is al in gebruik. Kies een andere.";
  return null;
}

/** Specialisaties uit een vrij veld: "Vegetarisch, soepen" → ["Vegetarisch", "Soepen"] (max 6). */
export function leesSpecialisaties(invoer: string): string[] {
  const gezien = new Set<string>();
  const uit: string[] = [];
  for (const deel of invoer.split(/[,;\n]/)) {
    const s = deel.trim().replace(/\s+/g, " ").slice(0, 30);
    if (!s) continue;
    const sleutel = s.toLowerCase();
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(s.charAt(0).toUpperCase() + s.slice(1));
    if (uit.length === 6) break;
  }
  return uit;
}

/** Mag iedereen (ingelogd) dit recept zien? Openbaar + gepubliceerd + (moderatie goedgekeurd). */
export function isPubliekZichtbaar(
  p: Pick<Publicatie, "zichtbaarheid" | "status" | "moderatie"> | null | undefined,
  moderatieVooraf = MODERATIE_VOORAF,
): boolean {
  if (!p) return false;
  if (p.zichtbaarheid !== "openbaar" || p.status !== "gepubliceerd") return false;
  return !moderatieVooraf || p.moderatie === "goedgekeurd";
}

/** Korte status voor de maker zelf. */
export function publicatieStatusLabel(
  p: Pick<Publicatie, "zichtbaarheid" | "status" | "moderatie"> | null | undefined,
  moderatieVooraf = MODERATIE_VOORAF,
): string {
  if (!p || p.status === "concept") return "Concept";
  if (p.zichtbaarheid === "openbaar" && moderatieVooraf) {
    if (p.moderatie === "afgewezen") return "Niet goedgekeurd";
    if (p.moderatie !== "goedgekeurd") return "Wacht op controle";
  }
  return `Gepubliceerd · ${zichtbaarheidLabel(p.zichtbaarheid)}`;
}

/** Wat verandert er bij publiceren? Openbaar opnieuw publiceren = opnieuw controleren. */
export function naPubliceren(
  zichtbaarheid: Zichtbaarheid,
  nu: Date = new Date(),
  moderatieVooraf = MODERATIE_VOORAF,
): Pick<Publicatie, "zichtbaarheid" | "status" | "gepubliceerd_op" | "moderatie"> {
  return {
    zichtbaarheid,
    status: "gepubliceerd",
    gepubliceerd_op: nu.toISOString(),
    moderatie: zichtbaarheid === "openbaar" && moderatieVooraf ? "wacht" : null,
  };
}

export function naDepubliceren(): Pick<Publicatie, "status" | "moderatie"> {
  return { status: "concept", moderatie: null };
}

export type MakerCijfers = {
  volgers: number;
  gepubliceerd: number;
  openbaar: number;
  bewaard: number | null;
  gepland: number | null;
};

/**
 * Basisstatistiek: alleen wat echt telbaar is. `bewaard`/`gepland` komen uit een geaggregeerde
 * databankfunctie; ontbreekt die, dan `null` (het scherm toont dan niets, geen verzonnen cijfer).
 */
export function telCijfers(
  publicaties: readonly Pick<Publicatie, "zichtbaarheid" | "status" | "moderatie">[],
  extern: { volgers?: unknown; bewaard?: unknown; gepland?: unknown } | null,
): MakerCijfers {
  const getal = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);
  return {
    volgers: getal(extern?.volgers) ?? 0,
    gepubliceerd: publicaties.filter((p) => p.status === "gepubliceerd").length,
    openbaar: publicaties.filter((p) => isPubliekZichtbaar(p)).length,
    bewaard: getal(extern?.bewaard),
    gepland: getal(extern?.gepland),
  };
}

export type VideoBron = { platform: string; url: string };

/** Alleen https-links van bekende videodiensten; anders `null` (geen willekeurige links). */
export function videoBron(invoer: string | null | undefined): VideoBron | null {
  if (!invoer) return null;
  let u: URL;
  try {
    u = new URL(invoer.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const h = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const platform =
    h === "youtube.com" || h === "youtu.be"
      ? "YouTube"
      : h === "tiktok.com" || h === "vm.tiktok.com"
        ? "TikTok"
        : h === "instagram.com"
          ? "Instagram"
          : h === "vimeo.com"
            ? "Vimeo"
            : null;
  return platform ? { platform, url: u.toString() } : null;
}

export const MELD_REDENEN = [
  { waarde: "ongepast", label: "Ongepast of kwetsend" },
  { waarde: "onveilig", label: "Onveilig (bv. allergie of voedselveiligheid)" },
  { waarde: "reclame", label: "Verborgen reclame of spam" },
  { waarde: "auteursrecht", label: "Niet van deze maker (auteursrecht)" },
  { waarde: "anders", label: "Iets anders" },
] as const;
export type MeldReden = (typeof MELD_REDENEN)[number]["waarde"];
export type MeldSoort = "recept" | "bijdrage" | "maker" | "collectie";

/** Eén zin bij "Ik heb dit gekookt": ingekort, zonder lege ruimte, 1–5 sterren. */
export function valideerBijdrage(tekst: string, sterren: number): string | null {
  const t = tekst.trim();
  if (!Number.isInteger(sterren) || sterren < 1 || sterren > 5) return "Kies 1 tot 5 sterren.";
  if (t.length < 2) return "Schrijf één korte zin.";
  if (t.length > 280) return "Houd het kort: hoogstens 280 tekens.";
  return null;
}

/** Initialen voor een maker zonder profielfoto. */
export function initialenVan(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (!delen.length) return "?";
  const a = delen[0]?.[0] ?? "";
  const b = delen.length > 1 ? (delen[delen.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

/** Zoeken in makers op naam, handle, bio en specialisaties (hoofdletter- en accentongevoelig). */
export function filterMakers<T extends Pick<Maker, "naam" | "handle" | "bio" | "specialisaties">>(
  makers: readonly T[],
  zoek: string,
): T[] {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = n(zoek.trim());
  if (!q) return [...makers];
  return makers.filter((m) =>
    n([m.naam, m.handle, m.bio ?? "", ...(m.specialisaties ?? [])].join(" ")).includes(q),
  );
}
