/**
 * B4 — afdelingen in de volgorde van jouw winkel. Met knoppen (geen slepen): werkt met één
 * vinger, met het toetsenbord en met een schermlezer.
 */
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORIE_LABEL, CATEGORIE_VOLGORDE, type CategorieId } from "@/lib/categorie";
import { isStandaard, verschuif } from "@/lib/winkelvolgorde";

export function WinkelvolgordeSheet({
  open,
  volgorde,
  onVolgorde,
  onSluit,
}: {
  open: boolean;
  volgorde: CategorieId[];
  onVolgorde: (v: CategorieId[]) => void;
  onSluit: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onSluit()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Volgorde van je winkel</SheetTitle>
          <SheetDescription>
            Zet de afdelingen in de volgorde waarin je door de winkel loopt. Je lijst en de
            winkelmodus volgen die volgorde.
          </SheetDescription>
        </SheetHeader>
        <ol className="mt-4 space-y-2 pb-2" aria-label="Afdelingen in winkelvolgorde">
          {volgorde.map((id, i) => (
            <li key={id} className="paneel flex min-h-16 items-center gap-2 pl-4 pr-2">
              <span className="w-7 shrink-0 text-lg font-bold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-lg font-semibold">{CATEGORIE_LABEL[id]}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-12"
                disabled={i === 0}
                aria-label={`${CATEGORIE_LABEL[id]} hoger`}
                onClick={() => onVolgorde(verschuif(volgorde, id, -1))}
              >
                <ArrowUp className="size-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-12"
                disabled={i === volgorde.length - 1}
                aria-label={`${CATEGORIE_LABEL[id]} lager`}
                onClick={() => onVolgorde(verschuif(volgorde, id, 1))}
              >
                <ArrowDown className="size-6" />
              </Button>
            </li>
          ))}
        </ol>
        <div className="grid gap-2 pb-4 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-14 text-base"
            disabled={isStandaard(volgorde)}
            onClick={() => onVolgorde([...CATEGORIE_VOLGORDE])}
          >
            <RotateCcw /> Standaardvolgorde
          </Button>
          <Button className="h-14 text-base" onClick={onSluit}>
            Klaar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
