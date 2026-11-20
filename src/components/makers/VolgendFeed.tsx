/**
 * Fase 4 — "Volgend" op Ontdek: nieuwe recepten en collecties van makers die je volgt,
 * chronologisch (nieuwste eerst). Lege toestand met uitleg; ontvolgen kan hier meteen.
 * Toont niets zolang de makermodule ontbreekt (productie vóór migratie 0008).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lock, Play, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RecipePhoto } from "@/components/RecipePhoto";
import { feedWanneer, type FeedItem } from "@/lib/makers-feed";
import { haalVolgendFeed } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { VolgKnop } from "./MakerOnderdelen";

const EERST = 4;

export function VolgendFeed() {
  const { beschikbaar } = useModuleBeschikbaar("follows");
  const { user } = useAuth();
  const [alles, setAlles] = useState(false);
  const q = useQuery({
    queryKey: ["volgend-feed", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalVolgendFeed(user!.id),
    staleTime: 60 * 1000,
  });
  if (!beschikbaar || !user) return null;

  const feed = q.data?.feed ?? [];
  const makers = [...new Map(feed.map((f) => [f.maker.id, f.maker] as const)).values()].sort(
    (a, b) => a.naam.localeCompare(b.naam, "nl"),
  );
  const zichtbaar = alles ? feed : feed.slice(0, EERST);

  return (
    <section aria-labelledby="volgend-titel" className="space-y-3" data-testid="volgend-feed">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="volgend-titel" className="text-sectietitel">
          Volgend
        </h2>
        <Link
          to="/makers"
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary underline-offset-4 hover:underline"
        >
          Makers ontdekken
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>

      {q.isLoading ? (
        <div className="h-28 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      ) : q.isError ? (
        <div className="paneel space-y-3 p-4">
          <p className="text-base">Wat je volgt, kon niet geladen worden.</p>
          <Button
            variant="outline"
            onClick={() => void q.refetch()}
            className="h-14 px-5 text-base"
          >
            Opnieuw proberen
          </Button>
        </div>
      ) : !q.data?.volgt.length ? (
        <div className="paneel flex flex-wrap items-start gap-3 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
            <UserPlus className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-56 space-y-1">
            <p className="text-base font-semibold">Je volgt nog niemand</p>
            <p className="text-base text-muted-foreground">
              Volg een maker die je graag ziet koken. Hun nieuwe recepten en collecties verschijnen
              dan hier, de nieuwste bovenaan. Ontvolgen kan altijd.
            </p>
          </div>
        </div>
      ) : !feed.length ? (
        <p className="paneel p-4 text-base text-muted-foreground">
          Nog niets nieuws van wie je volgt. Zodra ze iets delen, zie je het hier.
        </p>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Nieuw van makers die je volgt">
            {zichtbaar.map((f) => (
              <FeedRij key={f.sleutel} item={f} />
            ))}
          </ul>
          {feed.length > EERST ? (
            <Button
              variant="outline"
              onClick={() => setAlles((a) => !a)}
              aria-expanded={alles}
              className="h-14 px-5 text-base"
            >
              {alles ? "Minder tonen" : `Alles tonen (${feed.length})`}
            </Button>
          ) : null}
        </>
      )}

      {makers.length ? (
        <details className="rounded-2xl bg-muted/60 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold">
            Wie je volgt ({makers.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {makers.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/makers/$handle"
                  params={{ handle: m.handle }}
                  className="min-w-0 flex-1 basis-40 text-base font-semibold underline-offset-4 hover:underline"
                >
                  {m.naam}
                </Link>
                <VolgKnop maker={m} gevolgd />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function FeedRij({ item }: { item: FeedItem }) {
  const wanneer = feedWanneer(item.op);
  const kop =
    item.soort === "recept"
      ? `${item.maker.naam} deelde een recept`
      : `${item.maker.naam} maakte een collectie`;
  const inhoud = (
    <>
      {item.soort === "recept" ? (
        <RecipePhoto
          path={item.recept.image_url}
          alt=""
          recept={item.recept}
          className="size-20 shrink-0 rounded-xl"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-[var(--honing-zacht)] font-display text-2xl font-semibold text-[var(--honing-foreground)]"
        >
          {item.collectie.aantal}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] text-muted-foreground">
          {kop}
          {wanneer ? ` · ${wanneer}` : ""}
        </span>
        <span className="block font-display text-lg font-semibold leading-snug break-words hyphens-auto">
          {item.soort === "recept" ? item.recept.title : item.collectie.naam}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {item.soort === "collectie" ? (
            <Kenmerk>
              {item.collectie.aantal} {item.collectie.aantal === 1 ? "recept" : "recepten"}
            </Kenmerk>
          ) : null}
          {item.soort === "recept" && item.heeftVideo ? (
            <Kenmerk>
              <Play className="size-4" aria-hidden /> Met video
            </Kenmerk>
          ) : null}
          {item.exclusief ? (
            <Kenmerk>
              <Lock className="size-4" aria-hidden /> Voor abonnees
            </Kenmerk>
          ) : null}
        </span>
      </span>
    </>
  );
  const klasse =
    "paneel flex min-h-24 items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <li>
      {item.soort === "recept" ? (
        <Link to="/recepten/$id" params={{ id: item.recept.id }} className={klasse}>
          {inhoud}
        </Link>
      ) : (
        <Link to="/verzamelingen/$id" params={{ id: item.collectie.id }} className={klasse}>
          {inhoud}
        </Link>
      )}
    </li>
  );
}

function Kenmerk({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-secondary px-2.5 text-[0.9rem] font-semibold text-secondary-foreground">
      {children}
    </span>
  );
}
