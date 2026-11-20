import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Lock, Play, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { RecipePhoto } from "@/components/RecipePhoto";
import { CollectieOmslag } from "@/components/ontdek/CollectieOmslag";
import {
  Geverifieerd,
  MakerAvatar,
  MeldKnop,
  ReceptRaster,
  VolgKnop,
} from "@/components/makers/MakerOnderdelen";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { videoBron } from "@/lib/makers";
import { MakerAbonneren } from "@/components/makers/MakerAbonneren";
import { useMakerRechten } from "@/lib/betalen/useMakerRechten";
import {
  haalGevolgd,
  haalMakerOpHandle,
  haalPubliekeRecepten,
  haalVerzamelingenVan,
} from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";

export const Route = createFileRoute("/makers/$handle")({
  head: () => ({
    meta: [
      { title: "Maker – Foodlo" },
      { name: "description", content: "Recepten, verzamelingen en video's van een Foodlo-maker." },
    ],
  }),
  component: MakerPagina,
});

function MakerPagina() {
  const { handle } = Route.useParams();
  const { beschikbaar, laden } = useModuleBeschikbaar("creators");
  const { user } = useAuth();

  const makerQ = useQuery({
    queryKey: ["maker", handle],
    enabled: beschikbaar,
    queryFn: () => haalMakerOpHandle(handle),
  });
  const maker = makerQ.data ?? null;
  const { data: recepten = [], isLoading: receptenLaden } = useQuery({
    queryKey: ["maker-recepten", maker?.id],
    enabled: !!maker,
    queryFn: () => haalPubliekeRecepten(maker!.id),
  });
  const { data: collecties = [] } = useQuery({
    queryKey: ["maker-collecties", maker?.user_id],
    enabled: !!maker,
    queryFn: () => haalVerzamelingenVan(maker!.user_id, true),
  });
  const { data: gevolgd = new Set<string>() } = useQuery({
    queryKey: ["gevolgd", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalGevolgd(user!.id),
  });
  const rechten = useMakerRechten();

  if (laden || (beschikbaar && makerQ.isLoading)) {
    return (
      <AppShell title="Maker">
        <div className="h-56 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      </AppShell>
    );
  }
  if (!beschikbaar) {
    return (
      <AppShell title="Maker">
        <ModuleNietBeschikbaar
          naam="Makers"
          terugNaar="/inspiratie"
          terugLabel="Terug naar Ontdek"
        />
      </AppShell>
    );
  }
  if (!maker) {
    return (
      <AppShell title="Maker">
        <EmptyState
          title="Deze maker bestaat niet (meer)"
          description="Misschien is de naam veranderd. Zoek de maker in het overzicht."
          action={
            <Button asChild variant="outline" className="h-14 w-full text-base">
              <Link to="/makers">Naar alle makers</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const eigen = maker.user_id === user?.id;
  // Fase 4: exclusieve recepten zonder abonnement blijven zichtbaar als titel en foto (slotje).
  const toegang = eigen || rechten.magMaker(maker.id);
  const exclusieveIds = new Set(
    recepten.filter((r) => r.publicatie.exclusief).map((r) => r.recept.id),
  );
  const opslot = (r: { id: string }) => !toegang && exclusieveIds.has(r.id);
  const videos = recepten.flatMap(({ recept, publicatie }) => {
    const v = videoBron(publicatie.video_url);
    return v && !opslot(recept) ? [{ recept, video: v }] : [];
  });
  // Openbare verzamelingen tonen alleen recepten die zelf openbaar zijn.
  const openbareCollecties = collecties
    .map((c) => ({
      ...c,
      recepten: recepten
        .map((r) => r.recept)
        .filter((r) => (c.collection_recipes ?? []).some((x) => x.recipe_id === r.id)),
    }))
    .filter((c) => c.recepten.length > 0);

  async function deel() {
    const url = `${window.location.origin}/makers/${maker!.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: maker!.naam, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link gekopieerd");
      }
    } catch {
      /* delen geannuleerd */
    }
  }

  return (
    <AppShell title={maker.naam} breed>
      <div className="space-y-6">
        <section aria-label="Profiel" className="overflow-hidden rounded-3xl bg-card shadow-kaart">
          {maker.omslag_url ? (
            <RecipePhoto path={maker.omslag_url} alt="" className="aspect-[3/1] min-h-28 w-full" />
          ) : (
            <div
              aria-hidden
              className="aspect-[3/1] min-h-28 w-full bg-gradient-to-br from-[var(--honing-zacht)] via-secondary to-primary/30"
            />
          )}
          <div className="-mt-10 space-y-3 px-4 pb-5 sm:px-6">
            <MakerAvatar maker={maker} className="size-20 text-2xl" />
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight">{maker.naam}</h2>
              <p className="text-base text-muted-foreground">@{maker.handle}</p>
              <Geverifieerd maker={maker} />
            </div>
            {maker.bio ? (
              <p className="max-w-prose text-base leading-relaxed">{maker.bio}</p>
            ) : null}
            {maker.specialisaties?.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Specialisaties">
                {maker.specialisaties.map((s) => (
                  <li
                    key={s}
                    className="inline-flex min-h-10 items-center rounded-full bg-secondary px-3.5 text-base font-medium text-secondary-foreground"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {eigen ? (
                <Button asChild className="h-auto min-h-14 px-5 text-base">
                  <Link to="/maker">Beheer je makerpagina</Link>
                </Button>
              ) : (
                <VolgKnop maker={maker} gevolgd={gevolgd.has(maker.id)} />
              )}
              <Button
                variant="outline"
                onClick={() => void deel()}
                className="h-auto min-h-14 px-5 text-base"
              >
                <Share2 aria-hidden />
                Delen
              </Button>
              {!eigen ? <MeldKnop soort="maker" doelId={maker.id} /> : null}
            </div>
          </div>
        </section>

        {!eigen ? <MakerAbonneren maker={maker} aantalExclusief={exclusieveIds.size} /> : null}

        <Tabs defaultValue="recepten">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1">
            <TabsTrigger
              value="recepten"
              className="min-h-12 flex-1 basis-auto whitespace-normal text-base"
            >
              Recepten ({recepten.length})
            </TabsTrigger>
            <TabsTrigger
              value="collecties"
              className="min-h-12 flex-1 basis-auto whitespace-normal text-base"
            >
              Collecties ({openbareCollecties.length})
            </TabsTrigger>
            <TabsTrigger
              value="videos"
              className="min-h-12 flex-1 basis-auto whitespace-normal text-base"
            >
              Video's ({videos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recepten" className="mt-4">
            {receptenLaden ? (
              <div className="h-40 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
            ) : recepten.length ? (
              <ReceptRaster
                recepten={recepten.map((r) => r.recept)}
                label={`Recepten van ${maker.naam}`}
                opslot={opslot}
              />
            ) : (
              <EmptyState
                title="Nog geen openbare recepten"
                description={`${maker.naam} heeft nog niets openbaar gedeeld.`}
              />
            )}
          </TabsContent>

          <TabsContent value="collecties" className="mt-4">
            {openbareCollecties.length ? (
              <ul
                className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 md:grid-cols-4"
                aria-label="Collecties"
              >
                {openbareCollecties.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/verzamelingen/$id"
                      params={{ id: c.id }}
                      className="group relative block overflow-hidden rounded-2xl shadow-zacht"
                    >
                      <CollectieOmslag
                        titel={c.naam}
                        recepten={c.recepten}
                        className="aspect-[4/5] w-full"
                      />
                      <span
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                        aria-hidden
                      />
                      {c.exclusief && !toegang ? (
                        <span className="absolute left-2 top-2 inline-flex min-h-8 items-center gap-1 rounded-full bg-black/75 px-2.5 text-[0.9rem] font-semibold text-white">
                          <Lock className="size-4" aria-hidden />
                          Voor abonnees
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                        <span className="block font-display text-xl font-semibold leading-tight">
                          {c.naam}
                        </span>
                        <span className="block text-[0.9rem] text-white/90">
                          {c.recepten.length} {c.recepten.length === 1 ? "recept" : "recepten"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nog geen collecties"
                description="Openbare verzamelingen van deze maker verschijnen hier."
              />
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            {videos.length ? (
              <ul className="grid gap-3 md:grid-cols-2" aria-label="Video's">
                {videos.map(({ recept, video }) => (
                  <li
                    key={recept.id}
                    className="overflow-hidden rounded-[1.25rem] bg-card shadow-zacht"
                  >
                    {/* Geen ingesloten speler: een veilige voorvertoning (receptfoto) en een
                        duidelijke link naar de dienst. Zo laadt Foodlo geen code van derden. */}
                    <div className="relative">
                      <RecipePhoto
                        path={recept.image_url}
                        alt=""
                        recept={recept}
                        opschrift
                        className="aspect-video w-full"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="size-8 translate-x-0.5" />
                        </span>
                      </span>
                    </div>
                    <div className="space-y-2 p-4">
                      <Link
                        to="/recepten/$id"
                        params={{ id: recept.id }}
                        className="font-display text-lg font-semibold underline-offset-4 hover:underline"
                      >
                        {recept.title}
                      </Link>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 items-center gap-2 text-base font-semibold text-primary underline underline-offset-4"
                      >
                        <ExternalLink className="size-5 shrink-0" aria-hidden />
                        Bekijk op {video.platform}
                        <span className="sr-only">(opent buiten Foodlo)</span>
                      </a>
                      <p className="text-[0.9rem] text-muted-foreground">Opent buiten Foodlo.</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nog geen video's"
                description="Kookvideo's bij recepten van deze maker verschijnen hier."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
