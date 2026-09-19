import { useEffect, useMemo, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Share2, ListPlus, Pencil, Package, MoreHorizontal } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import {
  CATEGORIE_LABEL,
  CATEGORIE_VOLGORDE,
  bewaarCorrectie,
  categorieVan,
  leesCorrecties,
  type CategorieId,
} from "@/lib/categorie";
import { normaliseerTekst } from "@/lib/zoeken";

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
  const [bewerkItem, setBewerkItem] = useState<Item | null>(null);
  const [bewerkNaam, setBewerkNaam] = useState("");
  const [bewerkAantal, setBewerkAantal] = useState("");
  const [bewerkEenheid, setBewerkEenheid] = useState("");
  const [wisVraag, setWisVraag] = useState<"afgevinkt" | "alles" | null>(null);

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

  // Wat al in je voorraadkast staat, hoort ook bij "heb je waarschijnlijk al".
  const { data: voorraad = [] } = useQuery({
    queryKey: ["pantry-namen", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("pantry_items").select("naam").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => (r.naam as string).trim().toLowerCase()).filter(Boolean);
    },
  });

  const [correcties, setCorrecties] = useState<Record<string, CategorieId>>({});
  useEffect(() => {
    setCorrecties(leesCorrecties());
  }, []);

  function zetCategorie(naam: string, categorie: CategorieId) {
    setCorrecties(bewaarCorrectie(naam, categorie));
  }

  const groepen = useMemo(() => {
    const per = new Map<CategorieId, Item[]>();
    for (const item of items.filter((rij) => !rij.checked)) {
      const naam = item.name.trim().toLowerCase();
      const handmatig = correcties[normaliseerTekst(item.name)];
      const thuis = voorraad.some((v) => naam.includes(v) || v.includes(naam));
      const id: CategorieId = handmatig ?? (thuis ? "voorraadkast" : categorieVan(item.name, correcties));
      const lijst = per.get(id) ?? [];
      lijst.push(item);
      per.set(id, lijst);
    }
    return CATEGORIE_VOLGORDE.filter((id) => (per.get(id)?.length ?? 0) > 0).map((id) => ({
      id,
      lijst: per.get(id)!,
    }));
  }, [items, voorraad, correcties]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  const refreshLijsten = () => qc.invalidateQueries({ queryKey: ["shopping-lists"] });
  const [vraagVerwijder, setVraagVerwijder] = useState(false);
  const actieveLijst = lijsten.find((l) => l.id === actief);
  const actieveNaam = actieveLijst?.name ?? "";
  const openAantal = items.filter((item) => !item.checked).length;
  const klaar = items.filter((item) => item.checked);

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

  function openBewerken(item: Item) {
    setBewerkItem(item);
    setBewerkNaam(item.name);
    setBewerkAantal(item.quantity == null ? "" : String(item.quantity));
    setBewerkEenheid(item.unit);
  }

  async function bewaarItem() {
    if (!bewerkItem || !bewerkNaam.trim()) return;
    const hoeveelheid = bewerkAantal.trim() ? Number(bewerkAantal.replace(",", ".")) : null;
    if (hoeveelheid !== null && (!Number.isFinite(hoeveelheid) || hoeveelheid < 0)) {
      toast.error("Vul een geldig aantal in");
      return;
    }
    const { error } = await supabase
      .from("shopping_items")
      .update({ name: bewerkNaam.trim(), quantity: hoeveelheid, unit: bewerkEenheid.trim() })
      .eq("id", bewerkItem.id);
    if (error) {
      toast.error("Aanpassen lukte niet");
      return;
    }
    setBewerkItem(null);
    refresh();
    toast.success("Boodschap aangepast");
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
    const { error } = await supabase.from("shopping_items").delete().eq("checked", true).eq("list_id", actief);
    if (error) {
      toast.error("Opruimen lukte niet");
      return;
    }
    setWisVraag(null);
    refresh();
    toast.success("Afgevinkte boodschappen verwijderd");
  }

  async function wisAlles() {
    if (!actief) return;
    const { error } = await supabase.from("shopping_items").delete().eq("list_id", actief);
    if (error) {
      toast.error("Lijst leegmaken lukte niet");
      return;
    }
    setWisVraag(null);
    refresh();
    toast.success("Boodschappenlijst leeggemaakt");
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

        {items.length === 0 ? (
          <EmptyState title="Je lijst is leeg" description="Voeg hierboven toe wat je nog nodig hebt." />
        ) : (
          <div className="space-y-3">
            <div className="flex min-h-11 items-center justify-between gap-3 px-1">
              <p className="text-sm font-semibold text-muted-foreground">
                {openAantal === 1 ? "Nog 1 boodschap" : `Nog ${openAantal} boodschappen`}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" aria-label="Boodschappen opruimen">
                    <Trash2 className="size-4" /> Opruimen
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-2">
                  {klaar.length > 0 ? (
                    <DropdownMenuItem onSelect={() => setWisVraag("afgevinkt")} className="min-h-11 text-base">
                      <Trash2 /> Afgevinkte verwijderen ({klaar.length})
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => setWisVraag("alles")} className="min-h-11 text-base text-destructive">
                    <Trash2 /> Hele lijst leegmaken
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {groepen.map(({ id, lijst }) =>
              id === "voorraadkast" ? (
                <Accordion key={id} type="single" collapsible className="rounded-2xl bg-card px-4 ring-1 ring-border/60">
                  <AccordionItem value={id} className="border-0">
                    <AccordionTrigger className="min-h-14 text-base no-underline hover:no-underline">
                      {CATEGORIE_LABEL[id]} ({lijst.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4">
                      <p className="text-sm text-muted-foreground">
                        Basisproducten die je meestal al in huis hebt.
                      </p>
                      {lijst.map((item) => (
                        <ItemRij
                          key={item.id}
                          item={item}
                          onVink={() => vink(item)}
                           onBewerk={() => openBewerken(item)}
                          onVerwijder={() => verwijder(item.id)}
                          onCategorie={(c) => zetCategorie(item.name, c)}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <section key={id} aria-label={CATEGORIE_LABEL[id]}>
                  <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORIE_LABEL[id]}
                  </h2>
                  <ul className="space-y-2">
                    {lijst.map((item) => (
                      <li key={item.id}>
                        <ItemRij
                          item={item}
                          onVink={() => vink(item)}
                          onBewerk={() => openBewerken(item)}
                          onVerwijder={() => verwijder(item.id)}
                          onCategorie={(c) => zetCategorie(item.name, c)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
            {klaar.length > 0 ? (
              <Accordion type="single" collapsible className="border-t border-border">
                <AccordionItem value="klaar" className="border-0">
                  <AccordionTrigger className="min-h-12 px-1 text-sm font-semibold text-muted-foreground no-underline hover:no-underline">
                    Afgevinkt ({klaar.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    {klaar.map((item) => (
                      <ItemRij
                        key={item.id}
                        item={item}
                        onVink={() => vink(item)}
                        onBewerk={() => openBewerken(item)}
                        onVerwijder={() => verwijder(item.id)}
                        onCategorie={(c) => zetCategorie(item.name, c)}
                      />
                    ))}
                    <Button variant="ghost" onClick={() => setWisVraag("afgevinkt")} className="mt-2 w-full justify-center text-destructive">
                      <Trash2 /> Wis afgevinkte boodschappen
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
          </div>
        )}

        <Accordion type="single" collapsible className="rounded-2xl bg-card px-4 ring-1 ring-border/60">
          <AccordionItem value="handig" className="border-0">
            <AccordionTrigger className="min-h-14 text-base no-underline hover:no-underline">Meer voor deze lijst</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Button variant="outline" onClick={vinkVoorraadAf} className="w-full justify-start"><Package />Vink af wat ik al in huis heb</Button>
              <Button variant="outline" onClick={deel} className="w-full justify-start"><Share2 />Lijst delen</Button>
              {klaar.length > 0 ? <Button variant="ghost" onClick={() => setWisVraag("afgevinkt")} className="w-full justify-start"><Trash2 />Afgevinkte wissen</Button> : null}
              {items.length > 0 ? <Button variant="ghost" onClick={() => setWisVraag("alles")} className="w-full justify-start text-destructive"><Trash2 />Hele lijst leegmaken</Button> : null}
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

      <Dialog open={bewerkItem !== null} onOpenChange={(open) => { if (!open) setBewerkItem(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Boodschap aanpassen</DialogTitle>
            <DialogDescription>Pas de naam, hoeveelheid of eenheid aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus aria-label="Naam" value={bewerkNaam} onChange={(event) => setBewerkNaam(event.target.value)} className="h-14 text-base" />
            <div className="grid grid-cols-2 gap-3">
              <Input inputMode="decimal" aria-label="Hoeveelheid" placeholder="Hoeveelheid" value={bewerkAantal} onChange={(event) => setBewerkAantal(event.target.value)} className="h-14 text-base" />
              <Input aria-label="Eenheid" placeholder="Eenheid" value={bewerkEenheid} onChange={(event) => setBewerkEenheid(event.target.value)} className="h-14 text-base" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBewerkItem(null)}>Annuleren</Button>
            <Button onClick={() => void bewaarItem()}>Bewaren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={wisVraag !== null} onOpenChange={(open) => { if (!open) setWisVraag(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{wisVraag === "alles" ? "Hele lijst leegmaken?" : "Afgevinkte boodschappen wissen?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {wisVraag === "alles"
                ? `Alle ${items.length} boodschappen verdwijnen uit “${actieveNaam}”.`
                : `${klaar.length} afgevinkte boodschappen verdwijnen uit de lijst.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => void (wisVraag === "alles" ? wisAlles() : wisAfgevinkt())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 /> Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function ItemRij({
  item,
  onVink,
  onBewerk,
  onVerwijder,
  onCategorie,
}: {
  item: Item;
  onVink: () => void;
  onBewerk: () => void;
  onVerwijder: () => void;
  onCategorie: (categorie: CategorieId) => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2 border-b border-border/70 bg-card px-2 py-1.5 last:border-b-0">
      <Checkbox checked={item.checked} onCheckedChange={onVink} className="size-6" aria-label={item.name} />
      <button type="button" onClick={onBewerk} className={item.checked ? "min-w-0 flex-1 text-left text-base text-muted-foreground line-through" : "min-w-0 flex-1 text-left text-base"}>
        {[item.quantity ?? "", item.unit, item.name].join(" ").replace(/\s+/g, " ").trim()}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label={`Opties voor ${item.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-2">
          <DropdownMenuItem onSelect={onBewerk} className="min-h-11 text-base">
            <Pencil /> Aanpassen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {CATEGORIE_VOLGORDE.map((c) => (
            <DropdownMenuItem key={c} onSelect={() => onCategorie(c)} className="min-h-11 text-base">
              Zet bij {CATEGORIE_LABEL[c]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onVerwijder} className="min-h-11 text-base text-destructive">
            <Trash2 />
            Verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
