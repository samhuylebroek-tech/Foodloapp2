import { useEffect, useMemo, useRef, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Share2,
  ListPlus,
  Pencil,
  Package,
  MoreHorizontal,
  ShoppingCart,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Link2,
  MessageSquare,
  X,
  Users,
  Star,
  History,
  Sparkles,
  CalendarDays,
  WifiOff,
  Settings2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Klantenkaarten } from "@/components/Klantenkaarten";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { zorgVoorLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { zelfdeProduct } from "@/lib/product-herkenning";
import { belgischeMaat, parseIngredientLine, toonBelgischeMaat } from "@/lib/ingredienten";
import { appOrigin } from "@/lib/app-url";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { WinkelIdeeen } from "@/components/WinkelIdeeen";
import {
  CATEGORIE_LABEL,
  CATEGORIE_VOLGORDE,
  bewaarCorrectie,
  categorieVan,
  leesCorrecties,
  type CategorieId,
} from "@/lib/categorie";
import { normaliseerTekst } from "@/lib/zoeken";
import {
  bewaarGekocht,
  leegWachtrij,
  leesGeschiedenis,
  leesWachtrij,
  maakSuggesties,
  perBeurt,
  vaakGekocht,
  vaakLosGekocht,
  zetInWachtrij,
  type Vast,
} from "@/lib/boodschappen-geheugen";

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
  recipe_id?: string | null;
  recept?: string | null;
  note?: string | null;
};

function itemTekst(item: Item) {
  return [toonBelgischeMaat(item.quantity, item.unit), item.name].filter(Boolean).join(" ").trim();
}

function maatTekst(item: Item) {
  return toonBelgischeMaat(item.quantity, item.unit);
}

function datumLabel(dag: string) {
  const d = new Date(`${dag}T12:00:00`);
  const vandaag = new Date().toISOString().slice(0, 10);
  if (dag === vandaag) return "Vandaag";
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

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
  const [bewerkNota, setBewerkNota] = useState("");
  const [wisVraag, setWisVraag] = useState<"afgevinkt" | "alles" | null>(null);
  const [dicht, setDicht] = useState<Record<string, boolean>>({});
  const [kiesModus, setKiesModus] = useState(false);
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [winkel, setWinkel] = useState(false);
  const [deelOpen, setDeelOpen] = useState(false);
  const [deelLink, setDeelLink] = useState<string | null>(null);
  const [winkelIdeeen, setWinkelIdeeen] = useState(false);
  const [vaakAlles, setVaakAlles] = useState(false);
  // Wanneer werd iets afgevinkt (deze sessie) — het laatst afgevinkte staat bovenaan "In je kar".
  const [afvinkTijd, setAfvinkTijd] = useState<Record<string, number>>({});
  // Terugknop: de laatste acties, elk met een manier om ze om te keren.
  const terugStapel = useRef<{ label: string; draaiOm: () => Promise<void> }[]>([]);
  const [terugAantal, setTerugAantal] = useState(0);
  function onthoud(label: string, draaiOm: () => Promise<void>) {
    terugStapel.current = [...terugStapel.current, { label, draaiOm }].slice(-20);
    setTerugAantal(terugStapel.current.length);
  }
  async function zetTerug() {
    const stap = terugStapel.current.pop();
    setTerugAantal(terugStapel.current.length);
    if (!stap) return;
    try {
      await stap.draaiOm();
      toast.success(stap.label);
      void meet("boodschappen.terug");
    } catch {
      toast.error("Terugzetten lukte niet.");
    }
    qc.invalidateQueries({ queryKey: ["shopping"] });
  }
  /** Momentopname vóór een toevoeging, zodat we exact kunnen terugkeren. */
  function snapshotToevoegen(namen: string[]) {
    const lijstId = actief;
    const start = new Date(Date.now() - 2000).toISOString();
    const voor = items.filter((i) => namen.some((n) => zelfdeProduct(i.name, n)));
    return async () => {
      if (!lijstId) return;
      await supabase.from("shopping_items").delete().eq("list_id", lijstId).gte("created_at", start);
      await Promise.all(
        voor.map((b) =>
          supabase.from("shopping_items").update({ quantity: b.quantity, unit: b.unit, checked: b.checked }).eq("id", b.id),
        ),
      );
    };
  }

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
        .select("id, name, quantity, unit, checked, recipe_id, note, recipes(title)")
        .eq("list_id", actief!)
        .order("checked")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        checked: r.checked,
        recipe_id: r.recipe_id,
        note: r.note,
        recept: (r.recipes as { title?: string } | null)?.title ?? null,
      })) as Item[];
    },
  });

  const [geheugenOpen, setGeheugenOpen] = useState(false);
  const [meerOpen, setMeerOpen] = useState(false);
  const [bewerkCategorie, setBewerkCategorie] = useState<CategorieId | "">("");
  const [online, setOnline] = useState(true);

  const { data: geschiedenis = [] } = useQuery({
    queryKey: ["shopping-history", user?.id],
    enabled: !!user,
    queryFn: () => leesGeschiedenis(user!.id),
  });

  const { data: vaste = [] } = useQuery({
    queryKey: ["shopping-staples", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_staples").select("id, name, quantity, unit").order("name");
      if (error) throw error;
      return (data ?? []) as Vast[];
    },
  });

  // Geplande gerechten van de komende 7 dagen.
  const { data: weekGerechten = [] } = useQuery({
    queryKey: ["shopping-weekmenu", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const van = new Date().toISOString().slice(0, 10);
      const tot = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date, recipes(title)")
        .not("recipe_id", "is", null)
        .gte("plan_date", van)
        .lte("plan_date", tot)
        .order("plan_date");
      const gezien = new Set<string>();
      return (data ?? [])
        .filter((r) => r.recipe_id && !gezien.has(r.recipe_id) && gezien.add(r.recipe_id))
        .map((r) => ({
          recipe_id: r.recipe_id as string,
          dag: r.plan_date as string,
          titel: (r.recipes as { title?: string } | null)?.title ?? "Gerecht",
        }));
    },
  });

  // Offline: werk verder, en bewaar alles zodra er weer verbinding is.
  useEffect(() => {
    const zet = () => setOnline(navigator.onLine);
    zet();
    async function verwerk() {
      const acties = leesWachtrij();
      if (!acties.length) return;
      leegWachtrij();
      for (const a of acties) {
        if (a.soort === "vink") await supabase.from("shopping_items").update({ checked: a.checked }).eq("id", a.id);
        else {
          const p = parseIngredientLine(a.tekst);
          if (p) await voegToeAanLijst(a.userId, a.listId, [p]).catch(() => {});
        }
      }
      qc.invalidateQueries({ queryKey: ["shopping"] });
      toast.success("Je wijzigingen zijn bewaard");
    }
    const aan = () => { zet(); void verwerk(); };
    window.addEventListener("online", aan);
    window.addEventListener("offline", zet);
    if (navigator.onLine) void verwerk();
    return () => {
      window.removeEventListener("online", aan);
      window.removeEventListener("offline", zet);
    };
  }, [qc]);

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

  // Wie mag er meekijken op jouw boodschappen?
  const { data: meekijkers = [] } = useQuery({
    queryKey: ["boodschappen-delers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("shares")
        .select("id, invited_name, status, member_id, shopping_view, shopping_edit")
        .eq("owner_id", user!.id);
      return (data ?? []).filter((s) => s.shopping_view || s.shopping_edit) as {
        id: string;
        invited_name: string;
        status: string;
        member_id: string | null;
      }[];
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
  const klaar = items
    .filter((item) => item.checked)
    .sort((a, b) => (afvinkTijd[b.id] ?? 0) - (afvinkTijd[a.id] ?? 0));
  const totaal = items.length;
  const procent = totaal ? Math.round((klaar.length / totaal) * 100) : 0;

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

  const opLijstNamen = items.filter((i) => !i.checked).map((i) => i.name);
  const suggesties = useMemo(() => maakSuggesties(geschiedenis, opLijstNamen), [geschiedenis, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const vaak = useMemo(() => vaakGekocht(geschiedenis).slice(0, 12), [geschiedenis]);
  const vaakLos = useMemo(() => vaakLosGekocht(geschiedenis), [geschiedenis]);
  const vaakLosOpen = useMemo(
    () => vaakLos.filter((e) => !opLijstNamen.some((n) => zelfdeProduct(n, e.name))),
    [vaakLos, items], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const beurten = useMemo(() => perBeurt(geschiedenis).slice(0, 10), [geschiedenis]);
  const weekOpen = useMemo(() => {
    const opLijst = new Set(items.map((i) => i.recipe_id).filter(Boolean));
    return weekGerechten.filter((g) => !opLijst.has(g.recipe_id)).slice(0, 3);
  }, [weekGerechten, items]);
  const typSuggesties = useMemo(() => {
    const t = normaliseerTekst(nieuw);
    if (t.length < 2) return [];
    const op = new Set(opLijstNamen.map(normaliseerTekst));
    return vaakGekocht(geschiedenis)
      .map((e) => e.name)
      .concat(vaste.map((v) => v.name))
      .filter((n, i, a) => a.indexOf(n) === i && normaliseerTekst(n).startsWith(t) && !op.has(normaliseerTekst(n)))
      .slice(0, 4);
  }, [nieuw, geschiedenis, vaste, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const isVast = (naam: string) => vaste.some((v) => normaliseerTekst(v.name) === normaliseerTekst(naam));

  async function voegTekstToe(tekst: string) {
    if (!user || !actief || !tekst.trim()) return;
    const geparsed = parseIngredientLine(tekst);
    if (!geparsed) return;
    if (!online) {
      zetInWachtrij({ soort: "toevoegen", userId: user.id, listId: actief, tekst });
      toast.info("Je bent offline — we bewaren het straks");
      return;
    }
    // Zelfde product herkennen, ook met synoniemen: "knoflook" = "look".
    // Varianten ("rode ui" vs "ui") blijven bewust apart.
    const bestaand = items.find((i) => zelfdeProduct(i.name, geparsed.name));
    const start = new Date(Date.now() - 2000).toISOString();
    const draaiOm = snapshotToevoegen([geparsed.name]);
    try {
      await voegToeAanLijst(user.id, actief, [geparsed]);
    } catch {
      toast.error("Het lukte niet om dit toe te voegen. Probeer het opnieuw.");
      return;
    }
    refresh();
    void meet("boodschappen.toegevoegd");
    onthoud(`${geparsed.name} is weer van je lijst`, draaiOm);
    const lijstId = actief;
    toast.success(
      bestaand ? `${bestaand.name} stond al op je lijst — samengeteld` : `${geparsed.name} staat op je lijst`,
      {
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void (async () => {
              if (bestaand) {
                await supabase
                  .from("shopping_items")
                  .update({ quantity: bestaand.quantity, unit: bestaand.unit, checked: bestaand.checked })
                  .eq("id", bestaand.id);
              } else {
                await supabase
                  .from("shopping_items")
                  .delete()
                  .eq("list_id", lijstId)
                  .ilike("name", geparsed.name.trim())
                  .gte("created_at", start);
              }
              refresh();
            })();
          },
        },
      },
    );
  }

  async function voegToe() {
    const tekst = nieuw;
    setNieuw("");
    await voegTekstToe(tekst);
  }

  async function voegMeerdereToe(lijst: { name: string; quantity: number | null; unit: string; note?: string | null }[], melding: string) {
    if (!user || !actief || !lijst.length) return;
    const draaiOm = snapshotToevoegen(lijst.map((l) => l.name));
    try {
      await voegToeAanLijst(user.id, actief, lijst);
    } catch {
      toast.error("Het lukte niet om dit toe te voegen. Probeer het opnieuw.");
      return;
    }
    refresh();
    onthoud(lijst.length === 1 ? `${lijst[0]!.name} is weer van je lijst` : "Toevoeging teruggedraaid", draaiOm);
    if (melding) toast.success(melding);
  }

  async function zetGerechtOpLijst(recipeId: string, titel: string) {
    if (!user || !actief) return;
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit")
      .eq("recipe_id", recipeId)
      .order("position");
    const lijst = (data ?? []).map((i) => ({ ...i, recipe_id: recipeId }));
    if (!lijst.length) {
      toast.info("Dit gerecht heeft nog geen ingrediënten.");
      return;
    }
    await voegToeAanLijst(user.id, actief, lijst);
    refresh();
    toast.success(`Ingrediënten van ${titel} staan op je lijst`);
  }

  async function wisselVast(item: { name: string; quantity: number | null; unit: string }) {
    if (!user) return;
    const al = vaste.find((v) => normaliseerTekst(v.name) === normaliseerTekst(item.name));
    if (al) {
      await supabase.from("shopping_staples").delete().eq("id", al.id);
      toast.success(`${item.name} is geen vaste boodschap meer`);
    } else {
      await supabase
        .from("shopping_staples")
        .insert({ user_id: user.id, name: item.name, quantity: item.quantity, unit: item.unit ?? "" });
      toast.success(`${item.name} is nu een vaste boodschap`);
    }
    qc.invalidateQueries({ queryKey: ["shopping-staples"] });
  }

  async function vink(item: Item) {
    const nieuwWaarde = !item.checked;
    if (!online) {
      zetInWachtrij({ soort: "vink", id: item.id, checked: nieuwWaarde });
      qc.setQueryData<Item[]>(["shopping", actief], (oud) =>
        (oud ?? []).map((i) => (i.id === item.id ? { ...i, checked: nieuwWaarde } : i)),
      );
      return;
    }
    await supabase.from("shopping_items").update({ checked: nieuwWaarde }).eq("id", item.id);
    void meet("boodschappen.afgevinkt");
    if (nieuwWaarde) setAfvinkTijd((t) => ({ ...t, [item.id]: Date.now() }));
    onthoud(
      nieuwWaarde ? `${item.name} staat weer op je lijst` : `${item.name} zit weer in je kar`,
      async () => {
        await supabase.from("shopping_items").update({ checked: !nieuwWaarde }).eq("id", item.id);
      },
    );
    refresh();
    if (nieuwWaarde) {
      toast.success(`${item.name} gekocht`, {
        duration: 3000,
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void supabase.from("shopping_items").update({ checked: false }).eq("id", item.id).then(refresh);
          },
        },
      });
    }
  }

  /** Verwijderen met "Ongedaan maken": we zetten hetzelfde item dan gewoon terug. */
  async function verwijder(item: Item) {
    if (!user || !actief) return;
    await supabase.from("shopping_items").delete().eq("id", item.id);
    refresh();
    const lijstId = actief;
    onthoud(`${item.name} staat terug op je lijst`, async () => {
      await supabase.from("shopping_items").insert({
        user_id: user.id, list_id: lijstId, name: item.name, quantity: item.quantity, unit: item.unit, checked: item.checked, recipe_id: item.recipe_id ?? null, note: item.note ?? null,
      });
    });
    toast.success(`${item.name} verwijderd`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void (async () => {
            await supabase.from("shopping_items").insert({
              user_id: user.id,
              list_id: actief,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              checked: item.checked,
              note: item.note ?? null,
            });
            refresh();
          })();
        },
      },
    });
  }

  async function vinkCategorieAf(lijst: Item[]) {
    const open = lijst.filter((i) => !i.checked);
    if (!open.length) return;
    await supabase
      .from("shopping_items")
      .update({ checked: true })
      .in(
        "id",
        open.map((i) => i.id),
      );
    const nu = Date.now();
    setAfvinkTijd((t) => ({ ...t, ...Object.fromEntries(open.map((i) => [i.id, nu])) }));
    onthoud(`${open.length} terug op je lijst`, async () => {
      await supabase.from("shopping_items").update({ checked: false }).in("id", open.map((i) => i.id));
    });
    refresh();
  }

  function kies(id: string) {
    setGekozen((oud) => {
      const nieuwSet = new Set(oud);
      if (nieuwSet.has(id)) nieuwSet.delete(id);
      else nieuwSet.add(id);
      return nieuwSet;
    });
  }

  async function verwijderGekozen() {
    if (!gekozen.size) return;
    await supabase.from("shopping_items").delete().in("id", [...gekozen]);
    toast.success(`${gekozen.size} verwijderd`);
    setGekozen(new Set());
    setKiesModus(false);
    refresh();
  }

  async function verplaatsGekozen(naarLijst: string) {
    if (!gekozen.size) return;
    await supabase.from("shopping_items").update({ list_id: naarLijst }).in("id", [...gekozen]);
    toast.success("Verplaatst naar het andere lijstje");
    setGekozen(new Set());
    setKiesModus(false);
    refresh();
  }

  function openBewerken(item: Item) {
    setBewerkItem(item);
    setBewerkNaam(item.name);
    setBewerkAantal(item.quantity == null ? "" : String(item.quantity));
    setBewerkEenheid(item.unit);
    setBewerkNota(item.note ?? "");
    setBewerkCategorie(categorieVan(item.name, correcties));
  }

  async function bewaarItem() {
    if (!bewerkItem || !bewerkNaam.trim()) return;
    const hoeveelheid = bewerkAantal.trim() ? Number(bewerkAantal.replace(",", ".")) : null;
    if (hoeveelheid !== null && (!Number.isFinite(hoeveelheid) || hoeveelheid < 0)) {
      toast.error("Vul een geldig aantal in");
      return;
    }
    const maat = belgischeMaat(hoeveelheid, bewerkEenheid);
    const vorig = bewerkItem;
    const { error } = await supabase
      .from("shopping_items")
      .update({ name: bewerkNaam.trim(), quantity: maat.quantity, unit: maat.unit, note: bewerkNota.trim() ? bewerkNota.trim().slice(0, 100) : null })
      .eq("id", bewerkItem.id);
    if (error) {
      toast.error("Het lukte niet om op te slaan. Probeer het opnieuw.");
      return;
    }
    if (bewerkCategorie && bewerkCategorie !== categorieVan(bewerkNaam.trim(), correcties)) {
      zetCategorie(bewerkNaam.trim(), bewerkCategorie);
    }
    setBewerkItem(null);
    onthoud(`${vorig.name} teruggezet zoals het was`, async () => {
      await supabase.from("shopping_items").update({ name: vorig.name, quantity: vorig.quantity, unit: vorig.unit, note: vorig.note ?? null }).eq("id", vorig.id);
    });
    refresh();
    toast.success("Opgeslagen");
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
    if (!actief || !user || !actieveLijst) return;
    await bewaarGekocht(user.id, actieveLijst, klaar).catch(() => {});
    const { error } = await supabase.from("shopping_items").delete().eq("checked", true).eq("list_id", actief);
    if (error) {
      toast.error("Opruimen lukte niet. Probeer het opnieuw.");
      return;
    }
    setWisVraag(null);
    refresh();
    qc.invalidateQueries({ queryKey: ["shopping-history"] });
    toast.success("Gekochte boodschappen opgeruimd — je vindt ze terug bij Vorige boodschappen");
  }

  async function wisAlles() {
    if (!actief || !user || !actieveLijst) return;
    await bewaarGekocht(user.id, actieveLijst, klaar).catch(() => {});
    const { error } = await supabase.from("shopping_items").delete().eq("list_id", actief);
    if (error) {
      toast.error("Lijst leegmaken lukte niet. Probeer het opnieuw.");
      return;
    }
    setWisVraag(null);
    refresh();
    qc.invalidateQueries({ queryKey: ["shopping-history"] });
    toast.success("Boodschappenlijst leeggemaakt");
  }

  /** De lijst netjes per afdeling als tekst, om door te sturen. */
  function lijstAlsTekst() {
    return groepen
      .map(({ id, lijst }) => `${CATEGORIE_LABEL[id]}:\n${lijst.map((i) => `- ${itemTekst(i)}`).join("\n")}`)
      .join("\n\n");
  }

  async function deelTekst() {
    const tekst = lijstAlsTekst();
    if (!tekst) {
      toast.error("Je lijst is leeg");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `Boodschappen – ${actieveNaam}`, text: tekst });
    } else {
      await navigator.clipboard.writeText(tekst);
      toast.success("Lijst gekopieerd");
    }
  }

  /** Maakt een uitnodigingslink die enkel toegang geeft tot je boodschappen. */
  async function maakDeelLink() {
    if (!user) return;
    const { data, error } = await supabase
      .from("shares")
      .insert({
        owner_id: user.id,
        invited_name: `Boodschappen · ${actieveNaam || "lijst"}`,
        recipes_view: false,
        recipes_edit: false,
        planner_view: false,
        planner_edit: false,
        shopping_view: true,
        shopping_edit: true,
      })
      .select("token")
      .single();
    if (error) {
      toast.error("De link maken lukte niet");
      return;
    }
    const link = `${appOrigin()}/uitnodiging?code=${data.token}`;
    setDeelLink(link);
    qc.invalidateQueries({ queryKey: ["boodschappen-delers"] });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Foodlo boodschappen", text: "Kijk mee op mijn boodschappenlijst", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success("Link gekopieerd — plak hem in een bericht.");
    } catch {
      toast.info("De link staat hieronder klaar.");
    }
  }

  async function stopDelen(id: string) {
    await supabase.from("shares").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["boodschappen-delers"] });
    toast.success("Deze persoon kijkt niet meer mee");
  }

  return (
    <AppShell title="Boodschappen">
      <div className="space-y-5">
        {!online && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-base text-secondary-foreground">
            <WifiOff className="size-5 shrink-0" /> Je bent offline — we bewaren alles straks.
          </p>
        )}

        <div className="sticky top-2 z-30 flex justify-end">
          <Button
            variant="outline"
            onClick={() => void zetTerug()}
            disabled={terugAantal === 0}
            className="h-12 rounded-xl bg-card px-4 text-base shadow-sm"
            aria-label="Laatste actie terugzetten"
          >
            <Undo2 className="size-5" /> Ongedaan maken
          </Button>
        </div>

        {/* 1. Wat moet ik kopen? */}
        <section aria-label="Overzicht" className="rounded-3xl bg-card p-5 ring-1 ring-border/60">
          {lijsten.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex min-h-12 items-center gap-1 text-base font-semibold text-muted-foreground">
                  {actieveNaam}{actieveLijst?.group_id ? " · gezin" : ""} <ChevronDown className="size-5" />
                  <span className="sr-only">— andere lijst kiezen</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56 rounded-xl p-2">
                {lijsten.map((l) => (
                  <DropdownMenuItem key={l.id} onSelect={() => setActief(l.id)} className="min-h-12 text-base">
                    {l.id === actief ? <Check /> : <span className="size-4" />} {l.name}{l.group_id ? " · gezin" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <p className="text-base font-semibold text-muted-foreground">{actieveNaam}{actieveLijst?.group_id ? " · gezin" : ""}</p>
          )}
          <p className="mt-1 font-display text-3xl font-semibold leading-tight">
            {openAantal === 0
              ? items.length ? "Alles gekocht!" : "Je lijst is leeg"
              : `${openAantal} ${openAantal === 1 ? "ding" : "dingen"} nog te kopen`}
          </p>
          {totaal > 0 ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${procent}%` }} />
            </div>
          ) : null}
          {actieveLijst?.group_id ? (
            <p className="mt-2 text-base text-muted-foreground">Iedereen in je gezin kan aanvullen en afvinken.</p>
          ) : null}
          {openAantal > 0 ? (
            <Button onClick={() => setWinkel(true)} className="mt-4 h-16 w-full text-lg">
              <ShoppingCart className="size-6" /> Ik ga boodschappen doen
            </Button>
          ) : null}
        </section>

        {/* 2. Snel toevoegen */}
        <section aria-label="Iets toevoegen" className="space-y-2">
          <label htmlFor="toevoegen" className="px-1 text-lg font-semibold">Iets toevoegen</label>
          <div className="flex gap-2">
            <Input
              id="toevoegen"
              value={nieuw}
              onChange={(e) => setNieuw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void voegToe()}
              placeholder="Bv. melk, 6 eieren of wasmiddel"
              className="h-16 text-lg"
              autoComplete="off"
              enterKeyHint="done"
            />
            <Button onClick={() => void voegToe()} className="h-16 px-5 text-base">
              <Plus className="size-6" /> Voeg toe
            </Button>
          </div>
          <Button variant="secondary" className="h-14 w-full justify-start gap-3 text-base" onClick={() => setWinkelIdeeen(true)}>
            <ShoppingCart className="size-5" />
            <span className="flex-1 text-left">Winkelideeën — ideeën per afdeling</span>
            <ChevronRight className="size-5" />
          </Button>
          {typSuggesties.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Eerder gekocht">
              {typSuggesties.map((s) => (
                <Button key={s} variant="outline" className="h-12 rounded-xl text-base" onClick={() => { setNieuw(""); void voegTekstToe(s); }}>
                  <Plus className="size-4" /> {s}
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        {/* 3. Vaak gekocht — alleen echte losse aankopen, nooit verzonnen */}
        {vaakLosOpen.length > 0 && (
          <section aria-label="Vaak gekocht" className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Star className="size-5 text-primary" /> Vaak gekocht</h2>
            <p className="text-base text-muted-foreground">Wat je vaak los meeneemt. Tik om toe te voegen.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(vaakAlles ? vaakLosOpen : vaakLosOpen.slice(0, 8)).map((e) => (
                <Button
                  key={e.name}
                  variant="outline"
                  className="h-12 rounded-xl text-base"
                  onClick={() => { void meet("boodschappen.vaak_gekocht"); void voegMeerdereToe([{ name: e.name, quantity: e.quantity, unit: e.unit }], `${e.name} staat op je lijst`); }}
                >
                  <Plus className="size-4" /> {e.name}
                </Button>
              ))}
            </div>
            {vaakLosOpen.length > 8 ? (
              <Button variant="ghost" className="mt-2 h-11 text-base" onClick={() => setVaakAlles((v) => !v)}>
                {vaakAlles ? "Minder tonen" : `Alles tonen (${vaakLosOpen.length})`}
              </Button>
            ) : null}
          </section>
        )}

        {weekOpen.length > 0 && (
          <section aria-label="Uit je weekmenu" className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5 text-primary" /> Uit je weekmenu</h2>
            <ul className="mt-2 divide-y divide-border/70">
              {weekOpen.map((g) => (
                <li key={g.recipe_id} className="flex min-h-16 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg">{g.titel}</span>
                    <span className="block text-base capitalize text-muted-foreground">{datumLabel(g.dag)}</span>
                  </span>
                  <Button variant="outline" className="h-12 shrink-0" onClick={() => void zetGerechtOpLijst(g.recipe_id, g.titel)}>
                    <Plus /> Zet op lijst
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-14 text-base" onClick={() => setGeheugenOpen(true)}>
            <History className="size-5" /> Eerder gekocht
          </Button>
          <Button variant="outline" className="h-14 text-base" onClick={() => setMeerOpen(true)}>
            <Settings2 className="size-5" /> Meer opties
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nog niets op je lijst" description="Typ hierboven wat je nodig hebt, of kies iets dat je eerder kocht." />
        ) : (
          <div className="space-y-3">
            <h2 className="px-1 text-lg font-semibold">Je lijst</h2>


            {kiesModus && (
              <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-primary p-3 text-primary-foreground">
                <p className="flex-1 text-base font-semibold">{gekozen.size} gekozen</p>
                <Button variant="secondary" className="h-11" onClick={() => { setKiesModus(false); setGekozen(new Set()); }}>Stoppen</Button>
                {lijsten.filter((l) => l.id !== actief).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="h-11">Verplaatsen</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-2">
                      {lijsten.filter((l) => l.id !== actief).map((l) => (
                        <DropdownMenuItem key={l.id} onSelect={() => void verplaatsGekozen(l.id)} className="min-h-11 text-base">
                          {l.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button variant="destructive" className="h-11" onClick={() => void verwijderGekozen()} disabled={!gekozen.size}>
                  <Trash2 /> Verwijderen
                </Button>
              </div>
            )}

            {groepen.map(({ id, lijst }) => {
              const open = !dicht[id];
              return (
                <section key={id} aria-label={CATEGORIE_LABEL[id]} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
                  <div className="flex items-center gap-1 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setDicht((d) => ({ ...d, [id]: open }))}
                      aria-expanded={open}
                      className="flex min-h-12 flex-1 items-center gap-2 px-1 text-left"
                    >
                      {open ? <ChevronDown className="size-5 text-muted-foreground" /> : <ChevronRight className="size-5 text-muted-foreground" />}
                      <span className="text-base font-semibold">{CATEGORIE_LABEL[id]}</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-base font-semibold text-secondary-foreground">
                        {lijst.length}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label={`Alles in ${CATEGORIE_LABEL[id]} afvinken`}
                      onClick={() => void vinkCategorieAf(lijst)}
                    >
                      <CheckCheck className="size-5" />
                    </Button>
                  </div>
                  {open ? (
                    <ul>
                      {lijst.map((item) => (
                        <li key={item.id}>
                          <ItemRij
                            item={item}
                            kiesModus={kiesModus}
                            gekozen={gekozen.has(item.id)}
                            onKies={() => kies(item.id)}
                            onVink={() => vink(item)}
                            onBewerk={() => openBewerken(item)}
                            onVerwijder={() => verwijder(item)}
                            onCategorie={(c) => zetCategorie(item.name, c)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
            {klaar.length > 0 ? (
              <Accordion type="single" collapsible defaultValue="klaar" className="rounded-2xl bg-secondary/50 px-3 ring-1 ring-border/60">
                <AccordionItem value="klaar" className="border-0">
                  <AccordionTrigger className="min-h-12 px-1 text-base font-semibold text-muted-foreground no-underline hover:no-underline">
                    <span className="flex items-center gap-2"><ShoppingCart className="size-5" /> In je kar ({klaar.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    {klaar.map((item) => (
                      <ItemRij
                        key={item.id}
                        item={item}
                        kiesModus={kiesModus}
                        gekozen={gekozen.has(item.id)}
                        onKies={() => kies(item.id)}
                        onVink={() => vink(item)}
                        onBewerk={() => openBewerken(item)}
                        onVerwijder={() => verwijder(item)}
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
          <AccordionItem value="kaarten" className="border-0">
            <AccordionTrigger className="min-h-14 text-base no-underline hover:no-underline">Klantenkaarten</AccordionTrigger>
            <AccordionContent><Klantenkaarten /></AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <WinkelIdeeen
        open={winkelIdeeen}
        onOpenChange={setWinkelIdeeen}
        opLijst={opLijstNamen}
        vaakNamen={vaakLos.map((e) => e.name)}
        onVoegToe={async (keuze) => {
          void meet("boodschappen.winkel_idee");
          await voegMeerdereToe([keuze], "");
        }}
      />

      <Sheet open={meerOpen} onOpenChange={setMeerOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Meer opties</SheetTitle>
            <SheetDescription>Alles voor “{actieveNaam}”.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 pb-4">
            <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); setDeelOpen(true); }}><Share2 /> Lijst delen</Button>
            <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); void vinkVoorraadAf(); }}><Package /> Vink af wat ik al in huis heb</Button>
            {items.length > 0 ? <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); setKiesModus(true); setGekozen(new Set()); }}><CheckCheck /> Meerdere tegelijk kiezen</Button> : null}
            <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); setLijstNaam(""); setNaamVenster("nieuw"); }}><ListPlus /> Nieuw lijstje maken</Button>
            {actieveLijst && !actieveLijst.group_id ? <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); setLijstNaam(actieveNaam); setNaamVenster("hernoem"); }}><Pencil /> Naam van de lijst wijzigen</Button> : null}
            {klaar.length > 0 ? <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => { setMeerOpen(false); setWisVraag("afgevinkt"); }}><Trash2 /> Gekochte opruimen ({klaar.length})</Button> : null}
            {items.length > 0 ? <Button variant="outline" className="h-14 w-full justify-start text-base text-destructive" onClick={() => { setMeerOpen(false); setWisVraag("alles"); }}><Trash2 /> Hele lijst leegmaken</Button> : null}
            {lijsten.length > 1 && !actieveLijst?.group_id ? <Button variant="outline" className="h-14 w-full justify-start text-base text-destructive" onClick={() => { setMeerOpen(false); setVraagVerwijder(true); }}><Trash2 /> Dit lijstje verwijderen</Button> : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={geheugenOpen} onOpenChange={setGeheugenOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Eerder gekocht</SheetTitle>
            <SheetDescription>Tik op + om iets opnieuw op je lijst te zetten.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-6 pb-4">
            <section aria-label="Vaste boodschappen">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold"><Star className="size-5 text-accent-foreground" /> Vaste boodschappen</h3>
                {vaste.length > 0 ? (
                  <Button className="h-12" onClick={() => void voegMeerdereToe(vaste, "Je vaste boodschappen staan op je lijst")}>Alles toevoegen</Button>
                ) : null}
              </div>
              {vaste.length === 0 ? (
                <p className="mt-1 text-base text-muted-foreground">Tik op het sterretje bij een product om het een vaste boodschap te maken.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/70">
                  {vaste.map((v) => (
                    <GeheugenRij key={v.id} naam={v.name} sub={toonBelgischeMaat(v.quantity, v.unit)} vast onVast={() => void wisselVast(v)} onPlus={() => void voegMeerdereToe([v], `${v.name} staat op je lijst`)} />
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Wat koop ik vaak">
              <h3 className="text-lg font-semibold">Wat koop je vaak?</h3>
              {vaak.length === 0 ? (
                <p className="mt-1 text-base text-muted-foreground">Dit vult zich vanzelf: wat je afvinkt en opruimt, onthoudt Foodlo hier.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/70">
                  {vaak.map((e) => (
                    <GeheugenRij key={e.name} naam={e.name} sub={`${e.keer} keer gekocht`} vast={isVast(e.name)} onVast={() => void wisselVast(e)} onPlus={() => void voegMeerdereToe([e], `${e.name} staat op je lijst`)} />
                  ))}
                </ul>
              )}
            </section>

            {beurten.length > 0 ? (
              <section aria-label="Vorige boodschappen">
                <h3 className="text-lg font-semibold">Vorige boodschappen</h3>
                <Accordion type="single" collapsible>
                  {beurten.map((b) => (
                    <AccordionItem key={b.dag} value={b.dag}>
                      <AccordionTrigger className="min-h-14 text-base capitalize no-underline hover:no-underline">
                        {datumLabel(b.dag)} · {b.lijst.length} {b.lijst.length === 1 ? "product" : "producten"}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Button variant="outline" className="mb-2 h-12 w-full" onClick={() => void voegMeerdereToe(b.lijst, "Alles staat weer op je lijst")}>
                          <Plus /> Alles opnieuw op de lijst
                        </Button>
                        <ul className="divide-y divide-border/70">
                          {b.lijst.map((r) => (
                            <GeheugenRij key={r.id} naam={r.name} sub={toonBelgischeMaat(r.quantity, r.unit)} vast={isVast(r.name)} onVast={() => void wisselVast(r)} onPlus={() => void voegMeerdereToe([r], `${r.name} staat op je lijst`)} />
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {winkel && (
        <Winkelmodus
          groepen={groepen}
          openAantal={openAantal}
          aantalGekocht={klaar.length}
          onVink={(item) => void vink(item)}
          onSluit={() => setWinkel(false)}
          onOpruimen={() => { setWinkel(false); void wisAfgevinkt(); }}
        />
      )}

      <Dialog open={deelOpen} onOpenChange={(open) => { if (!open) { setDeelOpen(false); setDeelLink(null); } }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lijst delen</DialogTitle>
            <DialogDescription>Stuur de lijst door of laat iemand meekijken in Foodlo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => void deelTekst()}>
              <MessageSquare /> Stuur als tekst
            </Button>
            <Button className="h-14 w-full justify-start text-base" onClick={() => void maakDeelLink()}>
              <Link2 /> Deel met een link
            </Button>
            <p className="px-1 text-sm text-muted-foreground">
              Wie de link opent, maakt eerst een gratis Foodlo-account. Daarna kan die mee aanvullen en afvinken.
            </p>
            {deelLink ? (
              <div className="rounded-xl bg-secondary p-3">
                <p className="break-all text-sm">{deelLink}</p>
                <Button
                  variant="ghost"
                  className="mt-1 h-11"
                  onClick={() => { void navigator.clipboard.writeText(deelLink); toast.success("Link gekopieerd"); }}
                >
                  Kopieer link
                </Button>
              </div>
            ) : null}
            {meekijkers.length > 0 ? (
              <div className="space-y-1 pt-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Users className="size-4" /> Kijkt mee
                </p>
                {meekijkers.map((m) => (
                  <div key={m.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-secondary px-3">
                    <span className="flex-1 text-base">
                      {m.invited_name || "Uitnodiging"}
                      {m.status === "accepted" ? "" : " · nog niet aanvaard"}
                    </span>
                    <Button variant="ghost" size="icon" aria-label="Stop delen" onClick={() => void stopDelen(m.id)}>
                      <X className="size-5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogDescription>
              {bewerkItem?.recept ? `Voor het gerecht “${bewerkItem.recept}”.` : "Pas aan wat je wilt en tik op Opslaan."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-base font-semibold">Naam
              <Input autoFocus value={bewerkNaam} onChange={(event) => setBewerkNaam(event.target.value)} className="mt-1 h-14 text-base" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-base font-semibold">Hoeveel
                <Input inputMode="decimal" placeholder="bv. 2" value={bewerkAantal} onChange={(event) => setBewerkAantal(event.target.value)} className="mt-1 h-14 text-base" />
              </label>
              <label className="block text-base font-semibold">Eenheid
                <Input placeholder="bv. kg, stuk(s)" value={bewerkEenheid} onChange={(event) => setBewerkEenheid(event.target.value)} className="mt-1 h-14 text-base" />
              </label>
            </div>
            <label className="block text-base font-semibold">Nota
              <Input placeholder="bv. de biologische" value={bewerkNota} maxLength={100} onChange={(event) => setBewerkNota(event.target.value)} className="mt-1 h-14 text-base" />
            </label>
            <label className="block text-base font-semibold">Afdeling
              <select
                value={bewerkCategorie}
                onChange={(e) => setBewerkCategorie(e.target.value as CategorieId)}
                className="mt-1 h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
              >
                {CATEGORIE_VOLGORDE.map((c) => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
              </select>
            </label>
            {bewerkItem ? (
              <Button variant="outline" className="h-14 w-full justify-start text-base" onClick={() => void wisselVast(bewerkItem)}>
                <Star className={isVast(bewerkItem.name) ? "fill-current text-primary" : ""} />
                {isVast(bewerkItem.name) ? "Vaste boodschap (tik om te stoppen)" : "Maak er een vaste boodschap van"}
              </Button>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-destructive" onClick={() => { const i = bewerkItem; setBewerkItem(null); if (i) void verwijder(i); }}>
              <Trash2 /> Verwijderen
            </Button>
            <Button onClick={() => void bewaarItem()}>Opslaan</Button>
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

/** Schermvullende weergave om in de winkel af te vinken, afdeling per afdeling. */
function GeheugenRij({ naam, sub, vast, onVast, onPlus }: { naam: string; sub: string; vast: boolean; onVast: () => void; onPlus: () => void }) {
  return (
    <li className="flex min-h-16 items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg">{naam}</span>
        {sub ? <span className="block text-sm text-muted-foreground">{sub}</span> : null}
      </span>
      <Button variant="ghost" size="icon" className="size-12 shrink-0" aria-pressed={vast} aria-label={vast ? `${naam} is een vaste boodschap` : `Maak ${naam} een vaste boodschap`} onClick={onVast}>
        <Star className={vast ? "size-6 fill-current text-primary" : "size-6 text-muted-foreground"} />
      </Button>
      <Button variant="outline" className="h-12 shrink-0" onClick={onPlus} aria-label={`${naam} op je lijst zetten`}>
        <Plus /> Lijst
      </Button>
    </li>
  );
}

function Winkelmodus({
  groepen,
  openAantal,
  aantalGekocht,
  onVink,
  onSluit,
  onOpruimen,
}: {
  groepen: { id: CategorieId; lijst: Item[] }[];
  openAantal: number;
  aantalGekocht: number;
  onVink: (item: Item) => void;
  onSluit: () => void;
  onOpruimen: () => void;
}) {
  const [stap, setStap] = useState(0);

  // Scherm aan houden zolang je winkelt, waar de telefoon dat toelaat.
  useEffect(() => {
    let slot: { release: () => Promise<void> } | null = null;
    const api = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    void api?.request("screen").then((s) => { slot = s; }).catch(() => {});
    return () => {
      void slot?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (stap > groepen.length - 1) setStap(Math.max(0, groepen.length - 1));
  }, [groepen.length, stap]);

  const huidig = groepen[stap];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button variant="ghost" size="icon" className="size-12" aria-label="Winkelmodus sluiten" onClick={onSluit}>
          <X className="size-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{huidig ? CATEGORIE_LABEL[huidig.id] : "Klaar"}</p>
          <p className="text-sm text-muted-foreground">Nog {openAantal} te halen</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {huidig ? (
          <ul className="space-y-2">
            {huidig.lijst.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onVink(item)}
                  className="flex min-h-20 w-full items-center gap-4 rounded-2xl bg-card px-4 text-left ring-1 ring-border/60 active:scale-[0.99]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary">
                    <Check className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-2xl font-semibold">{item.name}</span>
                    {maatTekst(item) ? <span className="block text-lg text-muted-foreground">{maatTekst(item)}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <CheckCheck className="size-14 text-primary" />
            <p className="font-display text-3xl font-semibold">Klaar! Alles gekocht</p>
            {aantalGekocht > 0 ? (
              <Button className="h-16 w-full max-w-sm text-lg" onClick={onOpruimen}>Lijst leegmaken</Button>
            ) : null}
            <Button variant="outline" className="h-14 w-full max-w-sm text-lg" onClick={onSluit}>Nog iets vergeten</Button>
            <p className="text-sm text-muted-foreground">Wat je kocht, vind je later terug bij “Eerder gekocht”.</p>
          </div>
        )}
      </div>

      {groepen.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Button variant="outline" className="h-14 flex-1 text-base" disabled={stap === 0} onClick={() => setStap((s) => Math.max(0, s - 1))}>
            Vorige afdeling
          </Button>
          <span className="text-sm text-muted-foreground">{Math.min(stap + 1, groepen.length)}/{groepen.length}</span>
          <Button className="h-14 flex-1 text-base" disabled={stap >= groepen.length - 1} onClick={() => setStap((s) => s + 1)}>
            Volgende afdeling
          </Button>
        </div>
      )}
    </div>
  );
}

function ItemRij({
  item,
  kiesModus,
  gekozen,
  onKies,
  onVink,
  onBewerk,
  onVerwijder,
  onCategorie,
}: {
  item: Item;
  kiesModus: boolean;
  gekozen: boolean;
  onKies: () => void;
  onVink: () => void;
  onBewerk: () => void;
  onVerwijder: () => void;
  onCategorie: (categorie: CategorieId) => void;
}) {
  const start = useRef<number | null>(null);

  // Vegen op gsm: naar links = verwijderen, naar rechts = afvinken.
  function raakStart(e: React.TouchEvent) {
    start.current = e.touches[0]?.clientX ?? null;
  }
  function raakEinde(e: React.TouchEvent) {
    const begin = start.current;
    start.current = null;
    if (begin === null || kiesModus) return;
    const eind = e.changedTouches[0]?.clientX ?? begin;
    const verschil = eind - begin;
    if (verschil < -80) onVerwijder();
    else if (verschil > 80) onVink();
  }

  return (
    <div
      onTouchStart={raakStart}
      onTouchEnd={raakEinde}
      className="flex min-h-16 items-center gap-1 border-b border-border/70 px-1 last:border-b-0"
    >
      <label className="flex size-14 shrink-0 cursor-pointer items-center justify-center">
        {kiesModus ? (
          <Checkbox checked={gekozen} onCheckedChange={onKies} className="size-7" aria-label={`${item.name} kiezen`} />
        ) : (
          <Checkbox checked={item.checked} onCheckedChange={onVink} className="size-7" aria-label={item.checked ? `${item.name} — gekocht, tik om terug te zetten` : `${item.name} als gekocht aanvinken`} />
        )}
      </label>
      <button
        type="button"
        onClick={kiesModus ? onKies : onBewerk}
        aria-label={kiesModus ? `${item.name} kiezen` : `${item.name} aanpassen`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className={item.checked ? "block truncate text-lg text-muted-foreground line-through" : "block truncate text-lg"}>
            {item.name}
          </span>
          {item.note ? <span className="block truncate text-sm text-muted-foreground">{item.note}</span> : null}
          {item.recept ? <span className="block truncate text-sm text-muted-foreground">voor {item.recept}</span> : null}
        </span>
        {maatTekst(item) ? <span className="shrink-0 text-base text-muted-foreground">{maatTekst(item)}</span> : null}
        {item.checked ? <span className="sr-only">gekocht</span> : null}
      </button>
      {!kiesModus ? (
        <Button variant="ghost" size="icon" className="size-12 shrink-0" aria-label={`${item.name} aanpassen`} onClick={onBewerk}>
          <Pencil className="size-5" />
        </Button>
      ) : null}
    </div>
  );
}
