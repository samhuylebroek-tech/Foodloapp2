import { useEffect, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Share2, ListPlus, Pencil, Package, MoreHorizontal, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Klantenkaarten } from "@/components/Klantenkaarten";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { zorgVoorLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { parseIngredientLine } from "@/lib/ingredienten";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/boodschappen")({
  head: () => ({
    meta: [
      { title: "Boodschappenlijst – Foodlo" },
      {
        name: "description",
        content:
          "Maak meerdere boodschappenlijstjes met alle ingrediënten van je recepten, af te vinken in de winkel.",
      },
      { property: "og:title", content: "Boodschappenlijst – Foodlo" },
      { property: "og:description", content: "Vink af terwijl je winkelt en deel de lijst." },
    ],
  }),
  component: BoodschappenPage,
});

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  checked: boolean;
};

function BoodschappenPage() {
  useEffect(() => {
    void meet("boodschappen.bekeken");
  }, []);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nieuw, setNieuw] = useState("");
  const [actief, setActief] = useState<string | null>(null);
  const [naamVenster, setNaamVenster] = useState<"nieuw" | "hernoem" | null>(null);
  const [lijstNaam, setLijstNaam] = useState("");

  const { data: lijsten = [] } = useQuery({
    queryKey: ["shopping-lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      await zorgVoorLijst(user.id);
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, name, created_at, group_id")
        .order("created_at");
      if (error) throw error;
      return data as ShoppingList[];
    },
  });

  // De gezamenlijke gezinslijst ververst mee als een gezinslid iets aanpast.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("boodschappen-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, () => {
        qc.invalidateQueries({ queryKey: ["shopping"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

  useEffect(() => {
    if (!actief && lijsten.length) setActief(lijsten[0]!.id);
    if (actief && lijsten.length && !lijsten.some((l) => l.id === actief))
      setActief(lijsten[0]!.id);
  }, [lijsten, actief]);

  const { data: items = [] } = useQuery({
    queryKey: ["shopping", actief],
    enabled: !!actief,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, unit, checked")
        .eq("list_id", actief!)
        .order("checked")
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  const refreshLijsten = () => qc.invalidateQueries({ queryKey: ["shopping-lists"] });
  const [vraagVerwijder, setVraagVerwijder] = useState(false);
  const actieveLijst = lijsten.find((l) => l.id === actief);
  const actieveNaam = actieveLijst?.name ?? "";

  async function nieuwLijstje() {
    if (!user) return;
    const naam = lijstNaam.trim();
    if (!naam) return;
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: naam.trim() })
      .select("id")
      .single();
    if (error) {
      toast.error("Lijstje maken lukte niet");
      return;
    }
    setActief(data.id);
    setNaamVenster(null);
    setLijstNaam("");
    refreshLijsten();
  }

  async function hernoem() {
    const huidig = lijsten.find((l) => l.id === actief);
    if (!huidig) return;
    const naam = lijstNaam.trim();
    if (!naam) return;
    await supabase.from("shopping_lists").update({ name: naam }).eq("id", huidig.id);
    setNaamVenster(null);
    setLijstNaam("");
    refreshLijsten();
  }

  async function verwijderLijst() {
    const huidig = lijsten.find((l) => l.id === actief);
    if (!huidig) return;
    await supabase.from("shopping_lists").delete().eq("id", huidig.id);
    setVraagVerwijder(false);
    setActief(null);
    refreshLijsten();
    refresh();
    toast.success("Lijstje verwijderd");
  }

  async function voegToe() {
    if (!user || !nieuw.trim() || !actief) return;
    const geparsed = parseIngredientLine(nieuw);
    if (!geparsed) return;
    try {
      await voegToeAanLijst(user.id, actief, [geparsed]);
    } catch {
      toast.error("Toevoegen lukte niet");
      return;
    }
    setNieuw("");
    refresh();
  }

  async function vink(item: Item) {
    await supabase.from("shopping_items").update({ checked: !item.checked }).eq("id", item.id);
    void meet("boodschappen.afgevinkt");
    refresh();
  }

  async function verwijder(id: string) {
    await supabase.from("shopping_items").delete().eq("id", id);
    refresh();
  }

  // Alles wat al in de voorraadkast staat in één tik afvinken.
  async function vinkVoorraadAf() {
    if (!user || !actief) return;
    const { data } = await supabase.from("pantry_items").select("naam").eq("user_id", user.id);
    const thuis = (data ?? []).map((r) => r.naam.trim().toLowerCase()).filter(Boolean);
    if (thuis.length === 0) {
      toast.info("Je voorraadkast is nog leeg.");
      return;
    }
    const raak = items.filter((i) => {
      const n = i.name.trim().toLowerCase();
      return !i.checked && thuis.some((v) => n.includes(v) || v.includes(n));
    });
    if (raak.length === 0) {
      toast.info("Niets op deze lijst staat al in je voorraadkast.");
      return;
    }
    await supabase
      .from("shopping_items")
      .update({ checked: true })
      .in(
        "id",
        raak.map((i) => i.id),
      );
    toast.success(`${raak.length} afgevinkt — je hebt ze al in huis.`);
    refresh();
  }

  async function wisAfgevinkt() {
    if (!actief) return;
    await supabase.from("shopping_items").delete().eq("checked", true).eq("list_id", actief);
    refresh();
  }

  async function deel() {
    const tekst = items
      .filter((i) => !i.checked)
      .map((i) => `- ${i.quantity ?? ""} ${i.unit} ${i.name}`.replace(/\s+/g, " ").trim())
      .join("\n");
    if (!tekst) {
      toast.error("Je lijst is leeg");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Boodschappenlijst", text: tekst });
    } else {
      await navigator.clipboard.writeText(tekst);
      toast.success("Lijst gekopieerd");
    }
  }

  return (
    <AppShell title="Boodschappen">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Je lijstjes">
          {lijsten.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === actief}
              onClick={() => setActief(l.id)}
              className={
                l.id === actief
                  ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                  : "min-h-12 rounded-xl border border-border bg-card px-4 text-base font-semibold"
              }
            >
              {l.name}
              {l.group_id ? (
                <span
                  className={
                    l.id === actief
                      ? "ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold"
                      : "ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
                  }
                >
                  gezin
                </span>
              ) : null}
            </button>
          ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Lijsten beheren"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-2">
              <DropdownMenuItem onSelect={() => { setLijstNaam(""); setNaamVenster("nieuw"); }} className="min-h-12 text-base"><ListPlus />Nieuw lijstje</DropdownMenuItem>
              {actieveLijst && !actieveLijst.group_id ? <DropdownMenuItem onSelect={() => { setLijstNaam(actieveNaam); setNaamVenster("hernoem"); }} className="min-h-12 text-base"><Pencil />Naam wijzigen</DropdownMenuItem> : null}
              {lijsten.length > 1 && !actieveLijst?.group_id ? <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setVraagVerwijder(true)} className="min-h-12 text-base text-destructive"><Trash2 />Lijst verwijderen</DropdownMenuItem></> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {actieveLijst?.group_id && (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            Gezinslijst · iedereen kan aanvullen en afvinken
          </p>
        )}

        <div className="flex gap-2">
          <Input
            value={nieuw}
            onChange={(e) => setNieuw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && voegToe()}
            placeholder="Zelf iets toevoegen"
            className="h-14 text-base"
          />
          <Button onClick={voegToe} className="h-14 px-6" aria-label="Toevoegen">
            <Plus className="size-6" />
          </Button>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => vink(item)}
                className="size-7"
                aria-label={item.name}
              />
              <span
                className={
                  item.checked ? "flex-1 text-lg text-muted-foreground line-through" : "flex-1 text-lg"
                }
              >
                {[item.quantity ?? "", item.unit, item.name].join(" ").replace(/\s+/g, " ").trim()}
              </span>
              <Button
                variant="ghost"
                onClick={() => verwijder(item.id)}
                aria-label="Verwijderen"
                className="size-12"
              >
                <Trash2 className="size-5" />
              </Button>
            </li>
          ))}
          {items.length === 0 && (
            <li><EmptyState title="Je lijst is leeg" description="Voeg hierboven toe wat je nog nodig hebt." /></li>
          )}
        </ul>

        <Accordion type="single" collapsible className="rounded-2xl bg-card px-4 ring-1 ring-border/60">
          <AccordionItem value="handig" className="border-0">
            <AccordionTrigger className="min-h-14 text-base no-underline hover:no-underline">Meer voor deze lijst</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Button variant="outline" onClick={vinkVoorraadAf} className="w-full justify-start"><Package />Vink af wat ik al in huis heb</Button>
              <Button variant="outline" onClick={deel} className="w-full justify-start"><Share2 />Lijst delen</Button>
              <Button variant="ghost" onClick={wisAfgevinkt} className="w-full justify-start">Afgevinkte wissen</Button>
              <div className="pt-2"><Klantenkaarten /></div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Dialog open={naamVenster !== null} onOpenChange={(open) => { if (!open) setNaamVenster(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>{naamVenster === "nieuw" ? "Nieuw lijstje" : "Naam wijzigen"}</DialogTitle><DialogDescription>Geef dit lijstje een herkenbare naam.</DialogDescription></DialogHeader>
          <Input autoFocus value={lijstNaam} onChange={(event) => setLijstNaam(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void (naamVenster === "nieuw" ? nieuwLijstje() : hernoem()); }} className="h-14 text-base" />
          <DialogFooter><Button variant="outline" onClick={() => setNaamVenster(null)}>Annuleren</Button><Button onClick={() => void (naamVenster === "nieuw" ? nieuwLijstje() : hernoem())}>Bewaren</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {vraagVerwijder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">Lijstje verwijderen?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Je verwijdert “{actieveNaam}” met alles wat erop staat.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setVraagVerwijder(false)}
                className="h-14 flex-1 text-base"
              >
                Annuleren
              </Button>
              <Button
                variant="destructive"
                onClick={verwijderLijst}
                className="h-14 flex-1 text-base"
              >
                <Trash2 className="size-5" /> Verwijderen
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
