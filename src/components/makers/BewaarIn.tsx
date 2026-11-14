/** "Bewaar in…": blad met je verzamelingen om aan te vinken, en een nieuwe maken. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  haalUitVerzameling,
  haalVerzamelingenVan,
  maakVerzameling,
  zetInVerzameling,
} from "@/lib/makers-db";
import { cn } from "@/lib/utils";

export function BewaarIn({ receptId }: { receptId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nieuw, setNieuw] = useState("");
  const [bezig, setBezig] = useState<string | null>(null);

  const {
    data: lijst = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["verzamelingen", user?.id],
    enabled: !!user,
    queryFn: () => haalVerzamelingenVan(user!.id),
  });
  const zitIn = (id: string) =>
    lijst.find((v) => v.id === id)?.collection_recipes?.some((r) => r.recipe_id === receptId) ??
    false;
  const aantal = lijst.filter((v) => zitIn(v.id)).length;

  async function wissel(id: string, naam: string) {
    setBezig(id);
    try {
      if (zitIn(id)) {
        await haalUitVerzameling(id, receptId);
        toast.success(`Uit "${naam}" gehaald`);
      } else {
        const positie = lijst.find((v) => v.id === id)?.collection_recipes?.length ?? 0;
        await zetInVerzameling(id, receptId, positie);
        toast.success(`Bewaard in "${naam}"`);
      }
      await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
      await qc.invalidateQueries({ queryKey: ["verzameling"] });
    } catch {
      toast.error("Dat lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(null);
    }
  }

  async function maak() {
    const naam = nieuw.trim();
    if (!user || !naam) return;
    setBezig("nieuw");
    try {
      const v = await maakVerzameling(user.id, naam);
      await zetInVerzameling(v.id, receptId, 0);
      setNieuw("");
      await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
      toast.success(`Verzameling "${v.naam}" gemaakt en recept bewaard`);
    } catch {
      toast.error("De verzameling kon niet gemaakt worden.");
    } finally {
      setBezig(null);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-auto min-h-14 px-4 text-base"
      >
        <Bookmark aria-hidden className={cn(aantal > 0 && "fill-primary text-primary")} />
        {aantal > 0 ? `Bewaard in ${aantal}` : "Bewaar in…"}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
            <SheetTitle>Bewaar in een verzameling</SheetTitle>
            <SheetDescription>Een recept kan in meerdere verzamelingen zitten.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {isLoading ? (
              <Loader2 className="mx-auto size-6 animate-spin" aria-label="Laden" />
            ) : isError ? (
              <div className="text-center">
                <p className="text-base">Je verzamelingen konden niet geladen worden.</p>
                <Button variant="outline" onClick={() => void refetch()} className="mt-2 h-12">
                  Opnieuw proberen
                </Button>
              </div>
            ) : lijst.length ? (
              <ul className="space-y-2" aria-label="Je verzamelingen">
                {lijst.map((v) => {
                  const aan = zitIn(v.id);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={aan}
                        disabled={bezig !== null}
                        onClick={() => void wissel(v.id, v.naam)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border px-4 text-left text-base",
                          aan && "border-primary bg-secondary",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-primary",
                            aan && "bg-primary text-primary-foreground",
                          )}
                        >
                          {aan ? <Check className="size-4" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{v.naam}</span>
                        {bezig === v.id ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-base text-muted-foreground">
                Je hebt nog geen verzamelingen. Maak er hieronder een, bijvoorbeeld "Zondag" of
                "Kinderen".
              </p>
            )}
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void maak();
              }}
            >
              <Label htmlFor="nieuwe-verzameling" className="text-base">
                Nieuwe verzameling
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="nieuwe-verzameling"
                  value={nieuw}
                  maxLength={60}
                  onChange={(e) => setNieuw(e.target.value)}
                  placeholder="Bijvoorbeeld: Kerst"
                  className="h-14 min-w-0 flex-1 basis-48 text-base"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!nieuw.trim() || bezig !== null}
                  className="h-14 px-5 text-base"
                >
                  <Plus aria-hidden />
                  Maken en bewaren
                </Button>
              </div>
            </form>
          </div>
          <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="h-14 w-full text-base" onClick={() => setOpen(false)}>
              Klaar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
