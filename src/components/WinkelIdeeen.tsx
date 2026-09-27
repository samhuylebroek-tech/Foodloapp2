import { useMemo, useState } from "react";
import { Check, Plus, Search, Star } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AFDELINGEN } from "@/lib/winkel-afdelingen";
import { CATEGORIE_LABEL, CATEGORIE_VOLGORDE, bewaarCorrectie, categorieVan, leesCorrecties, type CategorieId } from "@/lib/categorie";
import { zelfdeProduct } from "@/lib/product-herkenning";
import { normaliseerTekst } from "@/lib/zoeken";
import { cn } from "@/lib/utils";

export type WinkelKeuze = { name: string; quantity: number | null; unit: string; note: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opLijst: string[];
  vaakNamen: string[];
  onVoegToe: (keuze: WinkelKeuze) => Promise<void>;
};

const EENHEDEN = ["", "stuks", "g", "kg", "ml", "cl", "l", "zak", "pak", "fles", "blik", "doos", "bos"];

/** "Winkelideeën": afdeling per afdeling ideeën; een tik opent een keuzevenster. */
export function WinkelIdeeen({ open, onOpenChange, opLijst, vaakNamen, onVoegToe }: Props) {
  const [afdeling, setAfdeling] = useState(AFDELINGEN[0]!.id);
  const [zoek, setZoek] = useState("");
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);

  // Keuzevenster: hoeveelheid, nota en categorie vóór het op de lijst gaat.
  const [keuze, setKeuze] = useState<string | null>(null);
  const [aantal, setAantal] = useState("");
  const [eenheid, setEenheid] = useState("");
  const [nota, setNota] = useState("");
  const [categorie, setCategorie] = useState<CategorieId>("overige");

  const staatOpLijst = (naam: string) => opLijst.some((n) => zelfdeProduct(n, naam));
  const isVaak = (naam: string) => vaakNamen.some((n) => zelfdeProduct(n, naam));

  const producten = useMemo(() => {
    const t = normaliseerTekst(zoek);
    if (t.length >= 2) {
      const alle = AFDELINGEN.flatMap((a) => a.producten);
      const lijst = alle.filter((p, i) => alle.indexOf(p) === i && normaliseerTekst(p).includes(t));
      if (!lijst.some((p) => normaliseerTekst(p) === t)) lijst.push(zoek.trim());
      return lijst;
    }
    const a = AFDELINGEN.find((x) => x.id === afdeling) ?? AFDELINGEN[0]!;
    return [...a.producten].sort((x, y) => Number(isVaak(y)) - Number(isVaak(x)));
  }, [afdeling, zoek, vaakNamen]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Categorie van de afdeling waar het product gevonden werd (of de geraden categorie bij zoeken). */
  function categorieVoor(naam: string): CategorieId {
    const gevonden = AFDELINGEN.find((a) => a.producten.includes(naam));
    if (gevonden) return gevonden.categorie;
    return categorieVan(naam, leesCorrecties());
  }

  function openKeuze(naam: string) {
    if (bezig || staatOpLijst(naam)) return;
    setKeuze(naam);
    setAantal("");
    setEenheid("");
    setNota("");
    setCategorie(categorieVoor(naam));
  }

  async function bevestig() {
    if (!keuze || bezig) return;
    const naam = keuze;
    const hoeveel = aantal.trim() ? Number(aantal.replace(",", ".")) : null;
    if (hoeveel !== null && (!Number.isFinite(hoeveel) || hoeveel < 0)) return;
    setBezig(true);
    try {
      // Kiest de gebruiker bewust een andere categorie, dan onthouden we dat voor dit product.
      if (categorie !== categorieVoor(naam)) bewaarCorrectie(naam, categorie);
      await onVoegToe({ name: naam, quantity: hoeveel, unit: eenheid, note: nota.trim() ? nota.trim().slice(0, 100) : null });
      setToegevoegd((t) => [...t, naam]);
      setKeuze(null);
    } finally {
      setBezig(false);
    }
  }

  function sluit(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setZoek("");
      setToegevoegd([]);
      setKeuze(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={sluit}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-3xl p-0">
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle className="font-display text-2xl">Winkelideeën</SheetTitle>
          <SheetDescription className="text-base">Loop de afdelingen langs en tik op wat je nodig hebt.</SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek in de winkel"
              className="h-14 pl-12 text-lg"
              aria-label="Zoek in de winkel"
            />
          </div>
        </div>

        {zoek.trim().length < 2 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none]" role="tablist" aria-label="Afdelingen">
            {AFDELINGEN.map((a) => {
              const Icoon = a.icoon;
              const actief = a.id === afdeling;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={actief}
                  onClick={() => setAfdeling(a.id)}
                  className={cn(
                    "flex min-h-24 w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center text-sm font-semibold leading-tight ring-1 transition-all",
                    actief
                      ? "bg-primary text-primary-foreground ring-primary shadow-md"
                      : "bg-card text-foreground ring-border/70 hover:bg-secondary",
                  )}
                >
                  <Icoon className="size-7" />
                  {a.naam}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto border-t border-border/60 bg-secondary/40 px-5 py-4">
          <ul className="flex flex-wrap gap-2">
            {producten.map((p) => {
              const al = staatOpLijst(p);
              const vaak = isVaak(p);
              return (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => openKeuze(p)}
                    disabled={al}
                    aria-label={al ? `${p} staat al op je lijst` : `${p} toevoegen`}
                    className={cn(
                      "flex min-h-14 items-center gap-2 rounded-full px-4 text-lg ring-1 transition-all active:scale-95",
                      al
                        ? "bg-primary/10 text-primary ring-primary/40"
                        : "bg-card text-foreground ring-border hover:ring-primary",
                    )}
                  >
                    {al ? <Check className="size-5 animate-in zoom-in" /> : <Plus className="size-5 text-muted-foreground" />}
                    <span className="first-letter:uppercase">{p}</span>
                    {vaak && !al ? <Star className="size-4 fill-current text-accent-foreground" aria-label="vaak gekocht" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-background px-5 py-4">
          <p className="flex-1 text-base text-muted-foreground" role="status">
            {toegevoegd.length === 0 ? "Nog niets toegevoegd" : `${toegevoegd.length} toegevoegd`}
          </p>
          <Button className="h-14 px-8 text-lg" onClick={() => sluit(false)}>Klaar</Button>
        </div>

        <Dialog open={keuze !== null} onOpenChange={(v) => { if (!v && !bezig) setKeuze(null); }}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="first-letter:uppercase">{keuze}</DialogTitle>
              <DialogDescription>Vul in wat je wilt — alles mag ook leeg blijven.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold">Hoeveel
                  <Input
                    autoFocus
                    inputMode="decimal"
                    placeholder="bv. 2"
                    value={aantal}
                    onChange={(e) => setAantal(e.target.value)}
                    className="mt-1 h-14 text-base"
                  />
                </label>
                <label className="block text-sm font-semibold">Eenheid
                  <select
                    value={eenheid}
                    onChange={(e) => setEenheid(e.target.value)}
                    className="mt-1 h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
                  >
                    {EENHEDEN.map((e) => <option key={e} value={e}>{e || "—"}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold">Nota
                <Input
                  placeholder="bv. de biologische"
                  value={nota}
                  maxLength={100}
                  onChange={(e) => setNota(e.target.value)}
                  className="mt-1 h-14 text-base"
                />
              </label>
              <label className="block text-sm font-semibold">Afdeling
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value as CategorieId)}
                  className="mt-1 h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
                >
                  {CATEGORIE_VOLGORDE.map((c) => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
                </select>
              </label>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="h-14 text-base" onClick={() => setKeuze(null)} disabled={bezig}>Terug</Button>
              <Button className="h-14 text-base" onClick={() => void bevestig()} disabled={bezig}>
                {bezig ? "Even geduld…" : "Zet op mijn lijst"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
