/**
 * "Versies" op het recept (P3): het origineel en elke aangepaste versie, met datum en wat er
 * veranderde. Terugzetten vraagt eerst een bevestiging; daarna "Ongedaan maken". De huidige stand
 * wordt vóór het terugzetten zelf een versie, zodat niets verloren gaat.
 * Ook bruikbaar als lijst zonder knop (`inline`, bv. onder het bewerkformulier).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { laadVersies, zetVersieTerug } from "@/lib/recept-versies-db";
import {
  staatUit,
  versieDatum,
  versieLijst,
  type VersieItem,
  type VersieRij,
} from "@/lib/recept-versies";
import { meet } from "@/lib/meten";
import { cn } from "@/lib/utils";

type Props = {
  recept: { id: string; created_at?: string | null; updated_at?: string | null };
  ingredienten: readonly object[];
  inline?: boolean;
};

function titelVan(v: VersieItem) {
  if (v.soort === "huidig") return "Huidige versie";
  if (v.soort === "origineel") return "Origineel";
  if (v.soort === "oudste") return "Oudste bewaarde versie";
  return v.wijziging?.label ?? "Aangepaste versie";
}

export function ReceptVersies({ recept, ingredienten, inline = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vraag, setVraag] = useState<VersieItem | null>(null);
  const [bezig, setBezig] = useState(false);
  const { data: rijen = [] } = useQuery({
    queryKey: ["recept-versies", recept.id],
    queryFn: () => laadVersies(recept.id),
    staleTime: 30_000,
  });
  const items = useMemo(
    () =>
      versieLijst(
        rijen,
        staatUit(
          recept as unknown as Record<string, unknown>,
          ingredienten as unknown as Record<string, unknown>[],
        ),
        { aangemaakt: recept.created_at ?? null, bijgewerkt: recept.updated_at ?? null },
      ),
    [rijen, recept, ingredienten],
  );
  if (!rijen.length) return null;

  const ververs = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["recipe", recept.id] }),
      qc.invalidateQueries({ queryKey: ["recipe-edit", recept.id] }),
      qc.invalidateQueries({ queryKey: ["recept-versies", recept.id] }),
      qc.invalidateQueries({ queryKey: ["recipes"] }),
    ]);
  };

  async function zetTerug(v: VersieItem) {
    const rij = rijen.find((r) => r.id === v.versieId) as VersieRij | undefined;
    if (!user || !rij) return;
    setBezig(true);
    try {
      const { herstel } = await zetVersieTerug({
        receptId: recept.id,
        userId: user.id,
        versie: rij,
      });
      void meet("recept.versie_terug", undefined, { soort: v.soort });
      await ververs();
      setVraag(null);
      setOpen(false);
      toast.success(`${titelVan(v)} staat terug`, {
        description: "De versie van daarnet staat bij Versies.",
        duration: 10000,
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void herstel()
              .then(ververs)
              .then(() => toast("Teruggezet zoals het was"))
              .catch(() =>
                toast.error("Terugzetten lukte niet helemaal. Kijk het recept even na."),
              ),
        },
      });
    } catch {
      toast.error("Terugzetten lukte niet. Er is niets veranderd.");
    } finally {
      setBezig(false);
    }
  }

  const lijst = (
    <ol className="space-y-3" aria-label="Versies van dit recept">
      {items.map((v) => (
        <li
          key={v.sleutel}
          data-versie={v.soort}
          className={cn(
            "rounded-2xl border p-4",
            v.soort === "huidig" ? "border-primary bg-secondary" : "border-border bg-card",
          )}
        >
          <p className="text-lg font-semibold">{titelVan(v)}</p>
          <p className="text-base text-muted-foreground">
            {v.soort === "origineel" || v.soort === "oudste" ? "Sinds" : "Op"}{" "}
            {versieDatum(v.sinds)}
            {" · "}
            {v.staat.servings} {v.staat.servings === 1 ? "persoon" : "personen"}
          </p>
          {v.wijziging?.wat.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-6 text-base">
              {v.wijziging.wat.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {v.versieId ? (
            <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => setVraag(v)}>
              <Undo2 className="size-5" aria-hidden /> Zet deze versie terug
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {inline ? (
        <section className="paneel mt-8 p-5" aria-labelledby="versies-titel">
          <h2 id="versies-titel" className="flex items-center gap-2 text-sectietitel">
            <History className="size-6" aria-hidden /> Versies
          </h2>
          <p className="mb-4 mt-1 text-base text-muted-foreground">
            Iets verkeerd aangepast? Zet gerust een vorige versie terug.
          </p>
          {lijst}
        </section>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
          <History className="size-5" aria-hidden />
          Versies ({items.length})
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto"
        >
          <SheetHeader className="pr-12">
            <SheetTitle className="text-sectietitel">Versies</SheetTitle>
            <SheetDescription className="text-base">
              Foodlo bewaart het origineel en elke aanpassing. Terugzetten kan altijd, en ook dat
              kan je ongedaan maken.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{lijst}</div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!vraag} onOpenChange={(o) => !o && setVraag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deze versie terugzetten?</AlertDialogTitle>
            <AlertDialogDescription>
              “{vraag ? titelVan(vraag) : ""}” van {versieDatum(vraag?.sinds ?? null)} wordt weer je
              recept. De huidige versie blijft bewaard bij Versies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={bezig} onClick={() => vraag && void zetTerug(vraag)}>
              Terugzetten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
