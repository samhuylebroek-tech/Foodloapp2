/**
 * Onderdelen van het nakijkscherm (fase 2): bron, veiligheid (jij + huishouden), "Dit lijkt op
 * je recept X", velden om zeker na te kijken, en een vriendelijke foutmelding met alternatieven.
 * Niets hiervan bewaart iets; dat doet pas de knop "Bewaren" in het scherm zelf.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Camera,
  Pencil,
  Video,
  Link2,
} from "lucide-react";
import { AllergieWaarschuwing } from "@/components/AllergieWaarschuwing";
import { NieuwReceptControle } from "@/components/veiligheid/EtersOordeel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { vindDubbel, type Dubbel, type DubbelKandidaat } from "@/lib/nakijken";
import type { Onzeker } from "@/lib/recept-tekst";
import { herkenVideoLink, videoLinkTekst } from "@/lib/video-link";

/** Waar het recept vandaan komt, zoals het nakijkscherm het toont. */
export type NakijkBron = {
  soort: "link" | "tekst" | "foto" | "gerecht" | "video" | "zoek";
  /** Ingelezen zonder AI (gestructureerde pagina of tekst-parser): 0 credits. */
  zonderAi?: boolean;
  platform?: string | null;
  maker?: string | null;
  url?: string | null;
};

export function bronTekst(b: NakijkBron): string {
  switch (b.soort) {
    case "video":
      return b.maker
        ? `Video van ${b.maker} op ${b.platform ?? "het platform"}`
        : `Video op ${b.platform ?? "het platform"}`;
    case "link":
      return `Ingelezen van ${b.platform && b.platform !== "website" ? b.platform : "de website"}${b.zonderAi ? " — zonder credits" : ""}`;
    case "tekst":
      return b.zonderAi
        ? "Uit je tekst gehaald zonder slimme hulp. Kijk alles goed na."
        : "Uit je tekst gehaald";
    case "foto":
      return "Gelezen van je foto";
    case "gerecht":
      return "Voorstel op basis van een foto van een gerecht";
    default:
      return "Gevonden recept";
  }
}

export function BronRegel({ bron }: { bron: NakijkBron }) {
  const video = bron.soort === "video" ? herkenVideoLink(bron.url) : null;
  return (
    <div className="rounded-2xl bg-secondary p-3 text-base" data-testid="nakijk-bron">
      <p className="flex items-start gap-2 font-semibold">
        {bron.soort === "video" ? (
          <Video className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        )}
        <span className="min-w-0">{bronTekst(bron)}</span>
      </p>
      {video ? (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 pl-7 font-semibold text-primary underline underline-offset-4"
        >
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          {videoLinkTekst(video)}
          <span className="sr-only">(opent buiten Foodlo)</span>
        </a>
      ) : bron.url && bron.soort !== "video" ? (
        <p className="mt-1 break-words pl-7 text-muted-foreground">Bron: {bron.url}</p>
      ) : null}
    </div>
  );
}

/** Jouw allergieën (kennismaking) én die van wie in je huishouden meeëet: de centrale controle. */
export function NakijkVeiligheid({
  titel,
  ingredienten,
}: {
  titel: string;
  ingredienten: readonly string[];
}) {
  return (
    <div className="space-y-2" data-testid="nakijk-veiligheid">
      <AllergieWaarschuwing titel={titel} ingredienten={[...ingredienten]} />
      <NieuwReceptControle titel={titel} ingredienten={ingredienten} />
    </div>
  );
}

const VELD_LABEL: Record<Onzeker["veld"], string> = {
  naam: "Naam",
  ingredienten: "Ingrediënten",
  hoeveelheden: "Hoeveelheden",
  stappen: "Bereiding",
  personen: "Personen",
  gok: "Voorstel",
};

export function OnzekerLijst({ items }: { items: readonly Onzeker[] }) {
  if (!items.length) return null;
  return (
    <section
      aria-labelledby="nakijk-onzeker"
      data-testid="nakijk-onzeker"
      className="rounded-2xl border-l-4 border-dashed border-honing bg-honing-zacht px-3 py-2.5"
    >
      <h3 id="nakijk-onzeker" className="flex items-start gap-2 text-base font-bold">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        Kijk dit zeker na
      </h3>
      <ul className="mt-1 space-y-1 pl-7 text-[0.95rem] leading-snug">
        {items.map((o) => (
          <li key={o.veld}>
            <span className="font-semibold">{VELD_LABEL[o.veld]}:</span> {o.uitleg}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Klein label naast een veld dat de gebruiker moet nakijken. */
export function NakijkLabel({ toon }: { toon: boolean }) {
  if (!toon) return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-honing-zacht px-2.5 py-0.5 text-[0.9rem] font-semibold text-[var(--honing-foreground)]">
      Nakijken
    </span>
  );
}

/**
 * Je eigen bewaarde recepten (zonder concepten) met hun ingrediënten, voor de dubbelcheck.
 * Pas geladen als het nakijkscherm open is.
 */
export function useEigenReceptenVoorDubbel(userId: string | undefined, actief: boolean) {
  return useQuery({
    queryKey: ["eigen-recepten-dubbel", userId],
    enabled: !!userId && actief,
    staleTime: 60_000,
    queryFn: async (): Promise<DubbelKandidaat[]> => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, source_url")
        .eq("user_id", userId!)
        .eq("is_concept", false)
        .is("deleted_at", null)
        .limit(500);
      if (error) throw error;
      const recepten = data ?? [];
      const namen = new Map<string, string[]>();
      for (let i = 0; i < recepten.length; i += 80) {
        const ids = recepten.slice(i, i + 80).map((r) => r.id);
        const { data: ing } = await supabase
          .from("recipe_ingredients")
          .select("recipe_id, name")
          .in("recipe_id", ids);
        for (const rij of ing ?? [])
          namen.set(rij.recipe_id, [...(namen.get(rij.recipe_id) ?? []), rij.name]);
      }
      return recepten.map((r) => ({ ...r, ingredienten: namen.get(r.id) ?? [] }));
    },
  });
}

export function dubbelVoor(
  kandidaten: readonly DubbelKandidaat[] | undefined,
  nieuw: { title: string; ingredienten: readonly string[]; source_url?: string | null },
  uitsluiten: readonly (string | null | undefined)[] = [],
): Dubbel | null {
  if (!kandidaten?.length || (!nieuw.title.trim() && !nieuw.ingredienten.length)) return null;
  const weg = new Set(uitsluiten.filter(Boolean));
  return vindDubbel(
    nieuw,
    kandidaten.filter((k) => !weg.has(k.id)),
  );
}

export function DubbelMelding({ dubbel, onOpen }: { dubbel: Dubbel; onOpen: () => void }) {
  return (
    <section
      aria-labelledby="nakijk-dubbel"
      data-testid="nakijk-dubbel"
      className="rounded-2xl border-2 border-primary/40 bg-card p-3"
    >
      <h3 id="nakijk-dubbel" className="flex items-start gap-2 text-base font-bold">
        <Copy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">Dit lijkt op je recept “{dubbel.recept.title}”</span>
      </h3>
      <p className="mt-1 pl-7 text-[0.95rem] leading-snug text-muted-foreground">
        {dubbel.reden === "bron"
          ? "Je bewaarde al een recept van dezelfde link."
          : dubbel.reden === "ingredienten"
            ? "De ingrediënten zijn bijna dezelfde."
            : "De naam lijkt erg op elkaar."}{" "}
        Open het bestaande recept, of bewaar dit toch als nieuw recept.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        className="mt-2 h-14 w-full text-base"
      >
        Open bestaande
      </Button>
    </section>
  );
}

// ---------- Foutmelding met alternatieven ----------

export type Alternatief = "tekst" | "foto" | "zelf" | "video" | "link";

export type ImportFoutInfo = {
  titel: string;
  uitleg: string;
  alternatieven: Alternatief[];
  bestaand?: { id: string; title: string } | null;
};

const ALTERNATIEF: Record<Alternatief, { label: string; icon: typeof FileText }> = {
  tekst: { label: "Plak de tekst", icon: FileText },
  foto: { label: "Neem een foto", icon: Camera },
  zelf: { label: "Typ het zelf", icon: Pencil },
  video: { label: "Bewaar als video-link", icon: Video },
  link: { label: "Plak een link", icon: Link2 },
};

export function ImportFout({
  fout,
  onKies,
}: {
  fout: ImportFoutInfo;
  onKies: (a: Alternatief) => void;
}) {
  return (
    <div
      role="alert"
      data-testid="import-fout"
      className="mt-4 rounded-2xl border-l-4 border-terracotta bg-terracotta-zacht p-3 text-foreground sm:p-4"
    >
      <p className="flex items-start gap-2 text-base font-bold">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-terracotta" aria-hidden />
        <span className="min-w-0">{fout.titel}</span>
      </p>
      <p className="mt-1 text-base leading-snug">{fout.uitleg}</p>
      {fout.bestaand ? (
        <Button asChild className="mt-3 h-14 w-full text-base">
          <Link to="/recepten/$id" params={{ id: fout.bestaand.id }}>
            Open “{fout.bestaand.title}”
          </Link>
        </Button>
      ) : null}
      {fout.alternatieven.length ? (
        <>
          <p className="mt-3 text-base font-semibold">Probeer het zo:</p>
          <div className="mt-2 grid gap-2 min-[400px]:grid-cols-2">
            {fout.alternatieven.map((a) => {
              const { label, icon: Icon } = ALTERNATIEF[a];
              return (
                <Button
                  key={a}
                  type="button"
                  variant="outline"
                  onClick={() => onKies(a)}
                  className="h-auto min-h-14 bg-card text-base"
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </Button>
              );
            })}
          </div>
        </>
      ) : null}
      <p className="mt-3 text-[0.95rem]">Wat je al invulde, blijft staan.</p>
    </div>
  );
}
