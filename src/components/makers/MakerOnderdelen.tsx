/**
 * Kleine bouwstenen voor makers: profielfoto/initialen, volgknop, meldknop, bronvermelding en
 * een receptraster met allergielabel (dezelfde regels als Ontdek).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Flag, Loader2, Lock, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecipePhoto } from "@/components/RecipePhoto";
import { leesKennismaking } from "@/lib/kennismaking";
import { allergieOordeel, type AllergieOordeel } from "@/lib/veiligheid";
import {
  initialenVan,
  MELD_REDENEN,
  type Maker,
  type MeldReden,
  type MeldSoort,
} from "@/lib/makers";
import { meld, ontvolg, volg, type ReceptKaart } from "@/lib/makers-db";
import { tijdLabel } from "@/lib/tijd";
import { cn } from "@/lib/utils";

const KLEUREN = [
  "bg-emerald-100 text-emerald-900",
  "bg-sky-100 text-sky-900",
  "bg-amber-100 text-amber-950",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
];

export function MakerAvatar({
  maker,
  className,
}: {
  maker: Pick<Maker, "naam" | "handle">;
  className?: string;
}) {
  let som = 0;
  for (const c of maker.handle) som += c.charCodeAt(0);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-16 shrink-0 items-center justify-center rounded-full font-display text-xl font-semibold ring-4 ring-card",
        KLEUREN[som % KLEUREN.length],
        className,
      )}
    >
      {initialenVan(maker.naam)}
    </span>
  );
}

export function Geverifieerd({ maker }: { maker: Pick<Maker, "geverifieerd"> }) {
  if (!maker.geverifieerd) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[0.9rem] font-semibold text-primary">
      <BadgeCheck className="size-4" aria-hidden />
      Geverifieerd
    </span>
  );
}

/** Volgen / Volgend, met "Ongedaan maken" in de melding. */
export function VolgKnop({
  maker,
  gevolgd,
  className,
}: {
  maker: Pick<Maker, "id" | "naam">;
  gevolgd: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);

  async function wissel(naar: boolean, stil = false) {
    if (!user) return;
    setBezig(true);
    try {
      if (naar) await volg(user.id, maker.id);
      else await ontvolg(user.id, maker.id);
      await qc.invalidateQueries({ queryKey: ["gevolgd"] });
      // Niet wachten: de feed ververst op de achtergrond, de melding komt meteen.
      void qc.invalidateQueries({ queryKey: ["volgend-feed"] });
      if (!stil)
        toast.success(naar ? `Je volgt ${maker.naam}` : `Je volgt ${maker.naam} niet meer`, {
          // Eén melding per maker: snel na elkaar tikken stapelt geen meldingen op.
          id: `volg-${maker.id}`,
          action: { label: "Ongedaan maken", onClick: () => void wissel(!naar, true) },
        });
    } catch {
      toast.error("Dat lukte niet. Probeer het zo meteen opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Button
      variant={gevolgd ? "outline" : "default"}
      aria-pressed={gevolgd}
      disabled={bezig || !user}
      onClick={() => void wissel(!gevolgd)}
      className={cn("h-auto min-h-14 px-5 text-base", className)}
    >
      {bezig ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : gevolgd ? (
        <Check aria-hidden />
      ) : (
        <UserPlus aria-hidden />
      )}
      {gevolgd ? "Volgend" : "Volgen"}
      <span className="sr-only"> {maker.naam}</span>
    </Button>
  );
}

/** "Van <naam>" met link naar de makerpagina. */
export function MakerBron({
  maker,
  className,
}: {
  maker: Pick<Maker, "naam" | "handle">;
  className?: string;
}) {
  return (
    <Link
      to="/makers/$handle"
      params={{ handle: maker.handle }}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      Van {maker.naam}
    </Link>
  );
}

/** Meldknop voor openbare inhoud (recept, bijdrage, maker, collectie). */
export function MeldKnop({
  soort,
  doelId,
  label = "Melden",
  klein = false,
}: {
  soort: MeldSoort;
  doelId: string;
  label?: string;
  klein?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState<MeldReden | null>(null);
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);

  async function verstuur() {
    if (!user || !reden) return;
    setBezig(true);
    try {
      await meld(user.id, { soort, doel_id: doelId, reden, toelichting });
      await qc.invalidateQueries({ queryKey: ["mijn-meldingen"] });
      setOpen(false);
      setReden(null);
      setToelichting("");
      toast.success("Bedankt. Het Foodlo-team bekijkt je melding.");
    } catch {
      toast.error("Je melding kon niet verstuurd worden. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          "h-auto min-h-12 px-3 text-base text-muted-foreground",
          klein && "min-h-11 px-2",
        )}
      >
        <Flag aria-hidden className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wat is er mis?</DialogTitle>
            <DialogDescription>
              Je melding gaat naar het Foodlo-team. De maker ziet niet wie meldde.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Reden</legend>
            {MELD_REDENEN.map((r) => (
              <label
                key={r.waarde}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 text-base",
                  reden === r.waarde && "border-primary bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name={`reden-${doelId}`}
                  value={r.waarde}
                  checked={reden === r.waarde}
                  onChange={() => setReden(r.waarde)}
                  className="size-5 accent-[var(--primary)]"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={`toelichting-${doelId}`} className="text-base">
              Toelichting (mag leeg blijven)
            </Label>
            <Textarea
              id={`toelichting-${doelId}`}
              value={toelichting}
              maxLength={500}
              onChange={(e) => setToelichting(e.target.value)}
              className="min-h-24 text-base"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="h-14 text-base">
              Annuleren
            </Button>
            <Button
              onClick={() => void verstuur()}
              disabled={!reden || bezig}
              className="h-14 text-base"
            >
              {bezig ? <Loader2 className="animate-spin" aria-hidden /> : <Flag aria-hidden />}
              Melding versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Allergie-oordelen voor een lijst recepten (alleen als er allergieën zijn ingesteld). */
export function useAllergieOordelen(recepten: ReceptKaart[]) {
  const { user } = useAuth();
  const kennis = leesKennismaking(user?.id);
  const ids = recepten.map((r) => r.id);
  const { data: namen } = useQuery({
    queryKey: ["maker-ingredient-namen", ids.join(",")],
    enabled: kennis.allergieen.length > 0 && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ids);
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const r of data ?? []) m.set(r.recipe_id, [...(m.get(r.recipe_id) ?? []), r.name]);
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });
  return (r: ReceptKaart): AllergieOordeel | null =>
    kennis.allergieen.length && namen
      ? allergieOordeel(
          { title: r.title, tags: r.tags ?? [], ingredienten: namen.get(r.id) ?? [] },
          kennis.allergieen,
        )
      : null;
}

export function AllergieLabel({ oordeel }: { oordeel: AllergieOordeel | null }) {
  if (!oordeel || (oordeel.status !== "allergeen" && oordeel.status !== "onbekend")) return null;
  const tekst =
    oordeel.status === "allergeen"
      ? `Mogelijk ${oordeel.treffers.map((t) => t.naam.toLowerCase()).join(", ")}`
      : "Niet gecontroleerd op allergieën";
  return (
    <p className="flex items-start gap-1 text-[0.9rem] font-semibold text-[oklch(0.42_0.1_55)] dark:text-[oklch(0.85_0.09_75)]">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{tekst}</span>
    </p>
  );
}

/** Raster met receptkaarten (foto, titel, tijd, allergielabel, optionele bronregel). */
export function ReceptRaster({
  recepten,
  label,
  bron,
  opslot,
}: {
  recepten: ReceptKaart[];
  label: string;
  bron?: (r: ReceptKaart) => Pick<Maker, "naam" | "handle"> | null | undefined;
  /** Fase 4: exclusief recept zonder abonnement — titel en foto, met een slotje. */
  opslot?: (r: ReceptKaart) => boolean;
}) {
  const oordeelVan = useAllergieOordelen(recepten);
  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 md:grid-cols-3 xl:grid-cols-4"
      aria-label={label}
    >
      {recepten.map((r) => {
        const b = bron?.(r);
        const tijd = tijdLabel(r.prep_minutes, r.cook_minutes);
        return (
          <li key={r.id} className="overflow-hidden rounded-[1.25rem] bg-card shadow-zacht">
            <Link
              to="/recepten/$id"
              params={{ id: r.id }}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative block">
                <RecipePhoto
                  path={r.image_url}
                  alt=""
                  recept={r}
                  opschrift
                  className="aspect-[4/3] w-full"
                />
                {opslot?.(r) ? (
                  <span className="absolute left-2 top-2 inline-flex min-h-8 items-center gap-1 rounded-full bg-black/75 px-2.5 text-[0.9rem] font-semibold text-white">
                    <Lock className="size-4" aria-hidden />
                    Voor abonnees
                  </span>
                ) : null}
              </span>
              <div className="space-y-1 p-3">
                <p className="font-display text-lg font-semibold leading-snug break-words hyphens-auto">
                  {r.title}
                </p>
                {tijd ? <p className="text-[0.95rem] text-muted-foreground">{tijd}</p> : null}
                <AllergieLabel oordeel={oordeelVan(r)} />
              </div>
            </Link>
            {b ? (
              <div className="px-3 pb-2">
                <MakerBron maker={b} className="text-[0.95rem]" />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
