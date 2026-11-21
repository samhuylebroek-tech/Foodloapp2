/**
 * Fase 4 — Feed "Volgend" op Ontdek en de melding "nieuw van een maker die je volgt".
 * Pure regels (getest in makers-feed.test.ts); de databank zit in makers-db.ts.
 *
 * - Alleen wat openbaar, gepubliceerd en goedgekeurd is (isPubliekZichtbaar) komt erin.
 * - Chronologisch, nieuwste eerst; geen algoritme dat iets voortrekt.
 * - Volgen blijft privé: de maker ziet niet wie volgt, en de melding wordt op het toestel van
 *   de volger afgeleid (er gaat niets naar de maker of naar buiten).
 */
import { isPubliekZichtbaar, type Maker, type Publicatie } from "@/lib/makers";

export type FeedRecept = {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  tags?: string[] | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  user_id?: string;
};

export type FeedItem =
  | {
      soort: "recept";
      sleutel: string;
      op: string;
      maker: Maker;
      recept: FeedRecept;
      /** Alleen voor abonnees van deze maker (fase 4, testmodus). */
      exclusief: boolean;
      heeftVideo: boolean;
    }
  | {
      soort: "collectie";
      sleutel: string;
      op: string;
      maker: Maker;
      collectie: { id: string; naam: string; aantal: number };
      exclusief: boolean;
    };

export type Volg = { creator_id: string; created_at?: string | null };

type FeedCollectie = {
  id: string;
  user_id: string;
  naam: string;
  openbaar: boolean;
  exclusief?: boolean | null;
  created_at?: string | null;
  collection_recipes?: { recipe_id: string }[];
};

/**
 * Bouwt de feed: recepten en openbare collecties van gevolgde makers, nieuwste eerst.
 * Een collectie telt alleen mee als er minstens één openbaar recept in zit.
 */
export function bouwFeed(i: {
  gevolgd: ReadonlySet<string>;
  makers: readonly Maker[];
  publicaties: readonly (Publicatie & { exclusief?: boolean | null })[];
  recepten: readonly FeedRecept[];
  collecties?: readonly FeedCollectie[];
  max?: number;
}): FeedItem[] {
  const makerPerId = new Map(i.makers.map((m) => [m.id, m]));
  const makerPerUser = new Map(i.makers.map((m) => [m.user_id, m]));
  const receptPerId = new Map(i.recepten.map((r) => [r.id, r]));
  const openbareRecepten = new Set<string>();
  const uit: FeedItem[] = [];
  for (const p of i.publicaties) {
    if (!i.gevolgd.has(p.creator_id) || !isPubliekZichtbaar(p)) continue;
    const maker = makerPerId.get(p.creator_id);
    const recept = receptPerId.get(p.recipe_id);
    if (!maker || !recept || !p.gepubliceerd_op) continue;
    openbareRecepten.add(p.recipe_id);
    uit.push({
      soort: "recept",
      sleutel: `recept:${p.recipe_id}`,
      op: p.gepubliceerd_op,
      maker,
      recept,
      exclusief: !!p.exclusief,
      heeftVideo: !!p.video_url,
    });
  }
  for (const c of i.collecties ?? []) {
    const maker = makerPerUser.get(c.user_id);
    if (!maker || !i.gevolgd.has(maker.id) || !c.openbaar || !c.created_at) continue;
    const aantal = (c.collection_recipes ?? []).filter((r) =>
      openbareRecepten.has(r.recipe_id),
    ).length;
    if (!aantal) continue;
    uit.push({
      soort: "collectie",
      sleutel: `collectie:${c.id}`,
      op: c.created_at,
      maker,
      collectie: { id: c.id, naam: c.naam, aantal },
      exclusief: !!c.exclusief,
    });
  }
  return uit
    .sort((a, b) => (a.op < b.op ? 1 : a.op > b.op ? -1 : a.sleutel.localeCompare(b.sleutel)))
    .slice(0, i.max ?? 30);
}

/** "vandaag", "gisteren", "3 dagen geleden", anders "12 oktober". */
export function feedWanneer(iso: string, nu: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dag = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const verschil = Math.round((dag(nu) - dag(d)) / 86_400_000);
  if (verschil <= 0) return "vandaag";
  if (verschil === 1) return "gisteren";
  if (verschil < 7) return `${verschil} dagen geleden`;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}

export type MakerMelding = {
  id: string;
  tekst: string;
  link: string;
  op: string;
};

/**
 * Meldingen "nieuw recept van een maker die je volgt": alleen recepten die verschenen NA het
 * volgen (wat al bestond toen je begon te volgen, is geen nieuws) en niet ouder dan `dagen`.
 */
export function nieuwVanGevolgden(
  feed: readonly FeedItem[],
  volgt: readonly Volg[],
  nu: Date = new Date(),
  dagen = 14,
): MakerMelding[] {
  const sinds = new Map(volgt.map((v) => [v.creator_id, v.created_at ?? null]));
  const grens = nu.getTime() - dagen * 86_400_000;
  return feed.flatMap((f) => {
    if (f.soort !== "recept") return [];
    const t = new Date(f.op).getTime();
    if (Number.isNaN(t) || t < grens || t > nu.getTime() + 60_000) return [];
    const begon = sinds.get(f.maker.id);
    if (begon === undefined) return [];
    if (begon && t < new Date(begon).getTime()) return [];
    return [
      {
        id: `maker:${f.recept.id}`,
        tekst: `${f.maker.naam} deelde een nieuw recept: ${f.recept.title}`.slice(0, 200),
        link: `/recepten/${f.recept.id}`,
        op: f.op,
      },
    ];
  });
}
