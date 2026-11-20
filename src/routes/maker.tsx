import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, ExternalLink, Flag, Loader2, Pencil, Video } from "lucide-react";
import { toast } from "sonner";
import { MakerAbonnees } from "@/components/makers/MakerAbonnees";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { MakerAvatar } from "@/components/makers/MakerOnderdelen";
import { VideoTijden } from "@/components/makers/VideoTijden";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  leesSpecialisaties,
  MELD_REDENEN,
  MODERATIE_VOORAF,
  naDepubliceren,
  naPubliceren,
  normaliseerHandle,
  publicatieStatusLabel,
  telCijfers,
  valideerHandle,
  videoBron,
  ZICHTBAARHEDEN,
  type Maker,
  type Publicatie,
  type Zichtbaarheid,
} from "@/lib/makers";
import {
  bewaarMaker,
  handleBezet,
  haalMakerStatistiek,
  haalMijnMaker,
  haalMijnMeldingen,
  haalMijnPublicaties,
  zetPublicatie,
} from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/maker")({
  head: () => ({
    meta: [
      { title: "Jouw makerpagina – Foodlo" },
      { name: "description", content: "Beheer je makerprofiel en kies per recept wie het ziet." },
    ],
  }),
  component: MakerBeheer,
});

function MakerBeheer() {
  const { beschikbaar, laden } = useModuleBeschikbaar("creators");
  const { user } = useAuth();
  const [bewerken, setBewerken] = useState(false);

  const makerQ = useQuery({
    queryKey: ["mijn-maker", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalMijnMaker(user!.id),
  });
  const maker = makerQ.data ?? null;

  return (
    <AppShell title="Jouw makerpagina" ondertitel="Deel recepten met wie jij kiest" breed>
      {laden || (beschikbaar && (makerQ.isLoading || !user)) ? (
        <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      ) : !beschikbaar ? (
        <ModuleNietBeschikbaar
          naam="Makerpagina's"
          terugNaar="/meer"
          terugLabel="Terug naar Meer"
        />
      ) : makerQ.isError ? (
        <div className="paneel p-5 text-center">
          <p className="text-base">Je makerprofiel kon niet geladen worden.</p>
          <Button
            variant="outline"
            onClick={() => void makerQ.refetch()}
            className="mt-3 h-14 px-6 text-base"
          >
            Opnieuw proberen
          </Button>
        </div>
      ) : !maker || bewerken ? (
        <ProfielFormulier maker={maker} onKlaar={() => setBewerken(false)} />
      ) : (
        <div className="space-y-8">
          <section aria-label="Profiel" className="paneel flex flex-wrap items-center gap-4 p-4">
            <MakerAvatar maker={maker} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-display text-xl font-semibold leading-tight">{maker.naam}</p>
              <p className="text-base text-muted-foreground">@{maker.handle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setBewerken(true)}
                className="h-14 px-4 text-base"
              >
                <Pencil aria-hidden />
                Profiel bewerken
              </Button>
              <Button asChild variant="outline" className="h-14 px-4 text-base">
                <Link to="/makers/$handle" params={{ handle: maker.handle }}>
                  <ExternalLink aria-hidden />
                  Bekijk je pagina
                </Link>
              </Button>
            </div>
          </section>
          <MijnRecepten maker={maker} />
          <MakerAbonnees />
          <MijnMeldingen />
        </div>
      )}
    </AppShell>
  );
}

function ProfielFormulier({ maker, onKlaar }: { maker: Maker | null; onKlaar: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [handle, setHandle] = useState(maker?.handle ?? "");
  const [naam, setNaam] = useState(maker?.naam ?? "");
  const [bio, setBio] = useState(maker?.bio ?? "");
  const [specialisaties, setSpecialisaties] = useState((maker?.specialisaties ?? []).join(", "));
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const genormaliseerd = normaliseerHandle(handle);

  async function bewaar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const f = valideerHandle(genormaliseerd);
    if (f) return setFout(f);
    if (!naam.trim()) return setFout("Vul je naam in zoals volgers die zien.");
    setBezig(true);
    setFout(null);
    try {
      if (await handleBezet(genormaliseerd, maker?.id)) {
        setFout("Deze naam is al in gebruik. Kies een andere.");
        return;
      }
      await bewaarMaker(
        user.id,
        {
          handle: genormaliseerd,
          naam: naam.trim().slice(0, 60),
          bio: bio.trim().slice(0, 300) || null,
          specialisaties: leesSpecialisaties(specialisaties),
        },
        maker?.id,
      );
      await qc.invalidateQueries({ queryKey: ["mijn-maker"] });
      await qc.invalidateQueries({ queryKey: ["makers"] });
      toast.success(maker ? "Profiel bewaard" : "Je makerpagina is klaar");
      onKlaar();
    } catch {
      setFout("Bewaren lukte niet. Misschien is de naam net door iemand anders gekozen.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <form onSubmit={(e) => void bewaar(e)} className="mx-auto max-w-xl space-y-5" noValidate>
      {!maker ? (
        <div className="paneel space-y-2 p-4">
          <h2 className="text-sectietitel">Word maker</h2>
          <p className="text-base text-muted-foreground">
            Met een makerpagina deel je recepten met vrienden, je gezin of iedereen. Jij kiest per
            recept. Niets wordt openbaar zonder dat je het zelf bevestigt, en openbare recepten
            worden eerst door het Foodlo-team bekeken.
          </p>
        </div>
      ) : (
        <h2 className="text-sectietitel">Profiel bewerken</h2>
      )}
      <div className="space-y-2">
        <Label htmlFor="maker-naam" className="text-base">
          Naam op je pagina
        </Label>
        <Input
          id="maker-naam"
          value={naam}
          maxLength={60}
          onChange={(e) => setNaam(e.target.value)}
          className="h-14 text-base"
          placeholder="Bijvoorbeeld: Marie kookt"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maker-handle" className="text-base">
          Korte naam voor je link
        </Label>
        <Input
          id="maker-handle"
          value={handle}
          maxLength={40}
          onChange={(e) => setHandle(e.target.value)}
          aria-describedby="maker-handle-uitleg"
          className="h-14 text-base"
          placeholder="bijvoorbeeld marie-kookt"
          autoCapitalize="none"
        />
        <p id="maker-handle-uitleg" className="text-[0.95rem] text-muted-foreground break-words">
          Je pagina: foodlo/makers/<strong>{genormaliseerd || "…"}</strong>. Kleine letters, cijfers
          en streepjes.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maker-bio" className="text-base">
          Over jou (mag kort)
        </Label>
        <Textarea
          id="maker-bio"
          value={bio}
          maxLength={300}
          onChange={(e) => setBio(e.target.value)}
          className="min-h-24 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maker-spec" className="text-base">
          Waar kook je graag? (met komma's)
        </Label>
        <Input
          id="maker-spec"
          value={specialisaties}
          onChange={(e) => setSpecialisaties(e.target.value)}
          className="h-14 text-base"
          placeholder="Soepen, Belgisch, vegetarisch"
        />
      </div>
      {fout ? (
        <p
          role="alert"
          className="rounded-2xl bg-destructive/10 p-3 text-base font-semibold text-destructive"
        >
          {fout}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={bezig} className="h-14 flex-1 px-6 text-base">
          {bezig ? <Loader2 className="animate-spin" aria-hidden /> : <ChefHat aria-hidden />}
          {maker ? "Profiel bewaren" : "Maak mijn makerpagina"}
        </Button>
        {maker ? (
          <Button type="button" variant="outline" onClick={onKlaar} className="h-14 px-6 text-base">
            Annuleren
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type EigenRecept = { id: string; title: string; instructions: string[] };

function MijnRecepten({ maker }: { maker: Maker }) {
  const { user } = useAuth();
  const { data: recepten = [], isLoading } = useQuery({
    queryKey: ["maker-eigen-recepten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, instructions")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("title")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EigenRecept[];
    },
  });
  const { data: publicaties = [] } = useQuery({
    queryKey: ["mijn-publicaties", maker.id],
    queryFn: () => haalMijnPublicaties(maker.id),
  });
  const { data: extern = null } = useQuery({
    queryKey: ["maker-statistiek", maker.id],
    queryFn: () => haalMakerStatistiek(maker.id),
  });
  const cijfers = telCijfers(publicaties, extern);
  const perRecept = new Map(publicaties.map((p) => [p.recipe_id, p]));

  const tegels: [string, number][] = [
    ["Volgers", cijfers.volgers],
    ["Gepubliceerd", cijfers.gepubliceerd],
    ["Openbaar te zien", cijfers.openbaar],
    ...(cijfers.bewaard !== null
      ? ([["Keer bewaard", cijfers.bewaard]] as [string, number][])
      : []),
    ...(cijfers.gepland !== null
      ? ([["Keer ingepland", cijfers.gepland]] as [string, number][])
      : []),
  ];

  return (
    <>
      <section aria-labelledby="cijfers-titel" className="space-y-3">
        <h2 id="cijfers-titel" className="text-sectietitel">
          Je cijfers
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {tegels.map(([label, n]) => (
            <li key={label} className="paneel p-4">
              <p className="font-display text-3xl font-semibold">{n.toLocaleString("nl-BE")}</p>
              <p className="text-base text-muted-foreground">{label}</p>
            </li>
          ))}
        </ul>
        <p className="text-[0.95rem] text-muted-foreground">
          Alleen totalen: je ziet nooit wie je volgt of wie iets bewaarde.
        </p>
      </section>

      <section aria-labelledby="recepten-titel" className="space-y-3">
        <h2 id="recepten-titel" className="text-sectietitel">
          Je recepten
        </h2>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
        ) : !recepten.length ? (
          <EmptyState
            icon={<ChefHat />}
            title="Nog geen recepten"
            description="Voeg eerst een recept toe in je Keuken; daarna kan je het hier delen."
            action={
              <Button asChild variant="outline" className="h-14 w-full text-base">
                <Link to="/recepten/nieuw">Recept toevoegen</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {recepten.map((r) => (
              <PublicatieRij
                key={r.id}
                maker={maker}
                recept={r}
                publicatie={perRecept.get(r.id) ?? null}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PublicatieRij({
  maker,
  recept,
  publicatie,
}: {
  maker: Maker;
  recept: EigenRecept;
  publicatie: Publicatie | null;
}) {
  const qc = useQueryClient();
  const gepubliceerd = publicatie?.status === "gepubliceerd";
  const [keuze, setKeuze] = useState<Zichtbaarheid>(publicatie?.zichtbaarheid ?? "prive");
  const [bevestig, setBevestig] = useState(false);
  const [video, setVideo] = useState(publicatie?.video_url ?? "");
  const [videoFout, setVideoFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => setKeuze(publicatie?.zichtbaarheid ?? "prive"), [publicatie?.zichtbaarheid]);

  async function schrijf(
    velden: Partial<Publicatie>,
    melding: string,
    terug?: Partial<Publicatie>,
  ) {
    setBezig(true);
    try {
      await zetPublicatie(maker.id, recept.id, velden);
      await qc.invalidateQueries({ queryKey: ["mijn-publicaties"] });
      await qc.invalidateQueries({ queryKey: ["maker-recepten"] });
      await qc.invalidateQueries({ queryKey: ["recept-bron", recept.id] });
      toast.success(melding, {
        id: `publicatie-${recept.id}`,
        ...(terug
          ? {
              action: { label: "Ongedaan maken", onClick: () => void schrijf(terug, "Teruggezet") },
            }
          : {}),
      });
    } catch {
      toast.error("Dat lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  const vorige: Partial<Publicatie> | undefined = publicatie
    ? {
        zichtbaarheid: publicatie.zichtbaarheid,
        status: publicatie.status,
        gepubliceerd_op: publicatie.gepubliceerd_op,
        moderatie: publicatie.moderatie ?? null,
      }
    : { status: "concept", zichtbaarheid: "prive", moderatie: null };

  function publiceer(z: Zichtbaarheid) {
    if (z === "openbaar") return setBevestig(true);
    void schrijf(naPubliceren(z), `"${recept.title}" is gedeeld met vrienden en gezin`, vorige);
  }

  function kies(z: Zichtbaarheid) {
    setKeuze(z);
    if (!gepubliceerd || z === publicatie?.zichtbaarheid) return;
    if (z === "prive")
      void schrijf({ ...naDepubliceren(), zichtbaarheid: "prive" }, "Weer privé", vorige);
    else publiceer(z);
  }

  async function bewaarVideo() {
    const v = video.trim();
    if (v && !videoBron(v))
      return setVideoFout("Plak een https-link van YouTube, TikTok, Instagram, Facebook of Vimeo.");
    setVideoFout(null);
    await schrijf(
      { video_url: v ? videoBron(v)!.url : null },
      v ? "Video-link bewaard" : "Video-link verwijderd",
    );
  }

  const statusId = `status-${recept.id}`;
  return (
    <li className="paneel space-y-3 p-4" aria-label={recept.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          to="/recepten/$id"
          params={{ id: recept.id }}
          className="min-w-0 flex-1 basis-48 font-display text-lg font-semibold underline-offset-4 hover:underline"
        >
          {recept.title}
        </Link>
        <span
          id={statusId}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full px-3 text-[0.95rem] font-semibold",
            gepubliceerd
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {publicatieStatusLabel(publicatie)}
        </span>
      </div>
      {publicatie?.moderatie === "afgewezen" && publicatie.moderatie_reden ? (
        <p role="note" className="paneel p-3 text-base">
          Reden van het Foodlo-team: {publicatie.moderatie_reden}
        </p>
      ) : null}
      <fieldset>
        <legend className="mb-2 text-base font-semibold">Wie mag dit zien?</legend>
        <div className="flex flex-wrap gap-2">
          {ZICHTBAARHEDEN.map((z) => (
            <Button
              key={z.waarde}
              type="button"
              variant={keuze === z.waarde ? "secondary" : "outline"}
              aria-pressed={keuze === z.waarde}
              disabled={bezig}
              onClick={() => kies(z.waarde)}
              className={cn(
                "h-auto min-h-12 px-4 text-base",
                keuze === z.waarde && "ring-2 ring-primary",
              )}
            >
              {z.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[0.95rem] text-muted-foreground">
          {ZICHTBAARHEDEN.find((z) => z.waarde === keuze)?.uitleg}
        </p>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {gepubliceerd ? (
          <Button
            variant="outline"
            disabled={bezig}
            aria-describedby={statusId}
            onClick={() =>
              void schrijf(naDepubliceren(), `"${recept.title}" is niet meer gepubliceerd`, vorige)
            }
            className="h-14 px-5 text-base"
          >
            Depubliceren
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={bezig || keuze === "prive"}
            aria-describedby={statusId}
            onClick={() => publiceer(keuze)}
            className="h-14 px-5 text-base"
          >
            {bezig ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Publiceren
          </Button>
        )}
      </div>
      <details className="rounded-2xl bg-muted/60 p-3">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold">
          <Video className="size-5" aria-hidden />
          Video en tijden {publicatie?.video_url ? "(ingesteld)" : "(optioneel)"}
        </summary>
        <div className="mt-2 space-y-2">
          <Label htmlFor={`video-${recept.id}`} className="text-base">
            Link naar je kookvideo
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`video-${recept.id}`}
              value={video}
              inputMode="url"
              onChange={(e) => setVideo(e.target.value)}
              placeholder="https://www.youtube.com/…"
              className="h-14 min-w-0 flex-1 basis-56 text-base"
            />
            <Button
              variant="outline"
              disabled={bezig}
              onClick={() => void bewaarVideo()}
              className="h-14 px-5 text-base"
            >
              Video bewaren
            </Button>
          </div>
          {videoFout ? (
            <p role="alert" className="text-base font-semibold text-destructive">
              {videoFout}
            </p>
          ) : null}
          <p className="text-[0.95rem] text-muted-foreground">
            Foodlo bewaart alleen de link: de video blijft bij {videoBron(video)?.platform ?? "de dienst"}{" "}
            en wordt niet gedownload. Je naam staat er als bron bij.
          </p>
          {publicatie?.video_url ? (
            <VideoTijden
              recept={{ ...recept, instructions: recept.instructions ?? [] }}
              videoUrl={publicatie.video_url}
            />
          ) : null}
        </div>
      </details>

      <AlertDialog open={bevestig} onOpenChange={setBevestig}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Openbaar publiceren?</AlertDialogTitle>
            <AlertDialogDescription>
              Iedereen met Foodlo kan "{recept.title}" dan zien op je makerpagina, met jouw naam
              erbij.
              {MODERATIE_VOORAF
                ? " Het Foodlo-team bekijkt het recept eerst; pas daarna is het openbaar te zien."
                : ""}{" "}
              Je kan het altijd weer depubliceren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-14 text-base">Nee, nog niet</AlertDialogCancel>
            <AlertDialogAction
              className="h-14 text-base"
              onClick={() =>
                void schrijf(
                  naPubliceren("openbaar"),
                  MODERATIE_VOORAF
                    ? "Verstuurd: het Foodlo-team bekijkt je recept"
                    : "Openbaar gepubliceerd",
                  vorige,
                )
              }
            >
              Ja, openbaar publiceren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function MijnMeldingen() {
  const { user } = useAuth();
  const { beschikbaar } = useModuleBeschikbaar("content_meldingen");
  const { data: meldingen = [] } = useQuery({
    queryKey: ["mijn-meldingen", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalMijnMeldingen(user!.id),
  });
  if (!beschikbaar || !meldingen.length) return null;
  const redenLabel = (r: string) => MELD_REDENEN.find((x) => x.waarde === r)?.label ?? r;
  const statusLabel = {
    open: "Wordt bekeken",
    behandeld: "Behandeld",
    afgewezen: "Geen inbreuk gevonden",
  } as const;
  return (
    <section aria-labelledby="meldingen-titel" className="space-y-3">
      <h2 id="meldingen-titel" className="text-sectietitel">
        Je meldingen
      </h2>
      <ul className="space-y-2">
        {meldingen.map((m) => (
          <li key={m.id} className="paneel flex flex-wrap items-center gap-3 p-4 text-base">
            <Flag className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 basis-48">
              {redenLabel(m.reden)} <span className="text-muted-foreground">({m.soort})</span>
            </span>
            <span className="font-semibold">{statusLabel[m.status] ?? m.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
