/** WP6 — verplaatsen en koppelen (uit routes/planner.tsx, ongewijzigd). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type Recipe } from "@/lib/types";
import { normaliseerTekst } from "@/lib/zoeken";
import { type PlanRow, labelVoor } from "./gedeeld";
import { GerechtKaart } from "./ReceptKiezer";

export function VerplaatsSheet({
  rij,
  kopie,
  momenten,
  onSluit,
  onKies,
}: {
  rij: PlanRow;
  kopie: boolean;
  momenten: string[];
  onSluit: () => void;
  onKies: (datum: string, moment: string) => void;
}) {
  const [datum, setDatum] = useState(rij.plan_date);
  const [moment, setMoment] = useState(rij.meal_type);
  const opties = momenten.length ? momenten : [rij.meal_type];
  const titel = rij.recipes?.title ?? rij.custom_title ?? "Maaltijd";
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onSluit();
      }}
    >
      <SheetContent side="bottom" className="space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>{kopie ? "Ook op een andere dag" : "Verplaatsen"}</SheetTitle>
          <SheetDescription>{titel}</SheetDescription>
        </SheetHeader>
        <div>
          <label htmlFor="verplaats-datum" className="text-base font-semibold">
            Dag
          </label>
          <Input
            id="verplaats-datum"
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="mt-2 h-14 text-base"
          />
          <p className="mt-1 text-base capitalize text-muted-foreground">
            {datum ? labelVoor(datum) : ""}
          </p>
        </div>
        {opties.length > 1 ? (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Moment">
            {opties.map((m) => (
              <Button
                key={m}
                role="radio"
                aria-checked={moment === m}
                variant={moment === m ? "default" : "secondary"}
                onClick={() => setMoment(m)}
                className="h-14 capitalize"
              >
                {m}
              </Button>
            ))}
          </div>
        ) : null}
        <Button
          disabled={!datum}
          onClick={() => onKies(datum, moment)}
          className="h-14 w-full text-base"
        >
          {kopie ? "Dupliceren" : "Verplaatsen"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

export function KoppelSheet({
  rij,
  onSluit,
  onKies,
  onNieuw,
  titel = "Recept koppelen",
  uitleg,
  beginZoek,
  zonder,
}: {
  rij: PlanRow;
  onSluit: () => void;
  onKies: (r: Recipe) => void;
  onNieuw?: () => void;
  titel?: string;
  uitleg?: string;
  beginZoek?: string;
  /** Recept dat niet in de keuze hoort (bij vervangen: het huidige gerecht). */
  zonder?: string | null;
}) {
  const naam = rij.custom_title ?? "";
  const [zoek, setZoek] = useState(beginZoek ?? naam);
  const { data: recepten = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      // Tweede laag naast RLS (BUG-105): nooit recepten van onbekenden.
      const eigenaren = await zichtbareEigenaren();
      if (!eigenaren.length) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .in("user_id", eigenaren)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });
  const woorden = normaliseerTekst(zoek)
    .split(" ")
    .filter((w) => w.length > 1);
  const score = (r: Recipe) => {
    const t = normaliseerTekst(r.title);
    return woorden.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  };
  const lijst = recepten
    .filter((r) => r.id !== zonder)
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => !woorden.length || x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 30)
    .map((x) => x.r);
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onSluit();
      }}
    >
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
          <SheetTitle>{titel}</SheetTitle>
          <SheetDescription>{uitleg ?? `Welk recept hoort bij “${naam}”?`}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pt-3">
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek in je recepten"
            aria-label="Zoek in je recepten"
            className="h-14 text-base"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {isLoading ? (
            <div className="grid min-h-32 place-items-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : lijst.length === 0 ? (
            <p className="py-6 text-center text-base text-muted-foreground">
              Geen recept gevonden met deze naam.
            </p>
          ) : (
            <ul className="space-y-2">
              {lijst.map((r) => (
                <li key={r.id}>
                  <GerechtKaart recept={r} onKies={() => onKies(r)} />
                </li>
              ))}
            </ul>
          )}
          {onNieuw ? (
            <Button variant="outline" onClick={onNieuw} className="mt-4 h-14 w-full text-base">
              <Plus className="size-5" /> Nieuw recept maken of importeren
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
