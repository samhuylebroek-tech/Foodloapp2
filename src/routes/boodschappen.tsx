import { lokaleDatum } from "@/lib/tijd";
import { useEffect, useMemo, useRef, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  Lightbulb,
  PackageCheck,
  WalletCards,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { Klantenkaarten } from "@/components/Klantenkaarten";
import { Groep, Icoon } from "@/components/mobiel/Lijst";
import { AanvulKaart, AanvulRegel } from "@/components/kringloop/AanvulKaart";
import { meldMetHerstel, useAanvulling, useKringloopVernieuw } from "@/hooks/useAanvulling";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { nogNodigVoorMorgen } from "@/lib/intelligentie/voor-morgen";
import { HalfGelukt, klaarMetWinkelen } from "@/lib/kringloop-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { zorgVoorLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { vervangNaam, vervanging, zelfdeProduct } from "@/lib/product-herkenning";
import { zitInVoorraad } from "@/lib/voorraad-match";
import { belgischeMaat, parseIngredientLine, toonBelgischeMaat } from "@/lib/ingredienten";
import { appOrigin } from "@/lib/app-url";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WinkelIdeeen } from "@/components/WinkelIdeeen";
import { ItemNaam, Winkelmodus, type Vervanging } from "@/components/winkel/Winkelmodus";
import { WaaromSheet, type WaaromRegel } from "@/components/lijst/WaaromSheet";
import { WinkelvolgordeSheet } from "@/components/lijst/WinkelvolgordeSheet";
import { CatalogusSheet } from "@/components/lijst/CatalogusSheet";
import { bewaarVolgorde, leesVolgorde } from "@/lib/winkelvolgorde";
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
  MAX_POGINGEN,
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
  /** Wie het toevoegde (gezinslijst). */
  user_id?: string;
};

function itemTekst(item: Item) {
  return [toonBelgischeMaat(item.quantity, item.unit), item.name].filter(Boolean).join(" ").trim();
}

function maatTekst(item: Item) {
  return toonBelgischeMaat(item.quantity, item.unit);
}

function datumLabel(dag: string) {
  const d = new Date(`${dag}T12:00:00`);
  const vandaag = lokaleDatum();
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
    const bestond = new Set(items.map((i) => i.id));
    return async () => {
      if (!lijstId) return;
      // Alleen wat deze toevoeging maakte: nooit iets dat intussen (ander toestel) zelf bijkwam.
      const { data: nieuw } = await supabase
        .from("shopping_items")
        .select("id, name")
        .eq("list_id", lijstId)
        .gte("created_at", start);
      const weg = (nieuw ?? [])
        .filter((r) => !bestond.has(r.id) && namen.some((n) => zelfdeProduct(r.name, n)))
        .map((r) => r.id);
      if (weg.length) await supabase.from("shopping_items").delete().in("id", weg);
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
        .select("id, name, quantity, unit, checked, recipe_id, note, user_id, recipes(title)")
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
        user_id: r.user_id,
        recept: (r.recipes as { title?: string } | null)?.title ?? null,
      })) as Item[];
    },
  });

  // Fase 5: "toegevoegd door" op een gezinslijst (namen van de anderen; lukt het niet, dan
  // tonen we gewoon niets).
  const anderen = [
    ...new Set(items.map((i) => i.user_id).filter((u): u is string => !!u && u !== user?.id)),
  ];
  const { data: namen = {} } = useQuery({
    queryKey: ["lijst-namen", anderen.join(",")],
    enabled: anderen.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", anderen);
      if (error) return {};
      return Object.fromEntries(
        (data ?? []).map((p) => [p.id, (p.display_name as string) || "Iemand"]),
      ) as Record<string, string>;
    },
  });
  const doorWie = (item: Item) =>
    item.user_id && item.user_id !== user?.id ? (namen[item.user_id] ?? null) : null;

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
      const van = lokaleDatum();
      const tot = lokaleDatum(new Date(Date.now() + 7 * 86400000));
      const { data } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date, personen, recipes(title, servings)")
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
          personen: (r.personen as number | null) ?? null,
          servings: (r.recipes as { servings?: number } | null)?.servings ?? null,
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
      // Wat mislukt, gaat terug in de wachtrij: nooit "bewaard" melden als het niet zo is.
      let mislukt = 0;
      let opgegeven = 0;
      for (const a of acties) {
        let ok = true;
        if (a.soort === "vink") {
          const { error } = await supabase
            .from("shopping_items")
            .update({ checked: a.checked })
            .eq("id", a.id);
          ok = !error;
        } else {
          const p = parseIngredientLine(a.tekst);
          if (p)
            ok = await voegToeAanLijst(a.userId, a.listId, [p]).then(
              () => true,
              () => false,
            );
        }
        if (ok) continue;
        const pogingen = (a.pogingen ?? 0) + 1;
        if (pogingen < MAX_POGINGEN) {
          mislukt++;
          zetInWachtrij({ ...a, pogingen });
        } else opgegeven++;
      }
      qc.invalidateQueries({ queryKey: ["shopping"] });
      const meervoud = (n: number) => (n === 1 ? "1 wijziging is" : `${n} wijzigingen zijn`);
      if (opgegeven) toast.error(`${meervoud(opgegeven)} niet bewaard. Kijk je lijst even na.`);
      if (mislukt)
        toast.error(
          `${meervoud(mislukt)} nog niet bewaard. We proberen het opnieuw zodra de verbinding beter is.`,
        );
      if (!mislukt && !opgegeven) toast.success("Je wijzigingen zijn bewaard");
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

  // B4: afdelingen in de volgorde van jouw winkel (per toestel).
  const [volgorde, setVolgorde] = useState<CategorieId[]>([...CATEGORIE_VOLGORDE]);
  const [volgordeOpen, setVolgordeOpen] = useState(false);
  useEffect(() => {
    setVolgorde(leesVolgorde());
  }, []);
  function zetVolgorde(v: CategorieId[]) {
    setVolgorde(v);
    bewaarVolgorde(v);
  }
  // B3: waarom staat dit op mijn lijst?
  const [waarom, setWaarom] = useState<WaaromRegel | null>(null);
  // B2: in het lege invoerveld meteen "vaak gekocht" tonen.
  const [invoerFocus, setInvoerFocus] = useState(false);
  // Fase 5: productcatalogus met tegels.
  const [catalogusOpen, setCatalogusOpen] = useState(false);

  const groepen = useMemo(() => {
    const per = new Map<CategorieId, Item[]>();
    for (const item of items.filter((rij) => !rij.checked)) {
      const handmatig = correcties[normaliseerTekst(item.name)];
      // Echte productherkenning (BUG-057): "ui" in de voorraad is geen "suiker".
      const thuis = zitInVoorraad(item.name, voorraad);
      const id: CategorieId = handmatig ?? (thuis ? "voorraadkast" : categorieVan(item.name, correcties));
      const lijst = per.get(id) ?? [];
      lijst.push(item);
      per.set(id, lijst);
    }
    return volgorde
      .filter((id) => (per.get(id)?.length ?? 0) > 0)
      .map((id) => ({
        id,
        lijst: per.get(id)!,
      }));
  }, [items, voorraad, correcties, volgorde]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  const refreshLijsten = () => qc.invalidateQueries({ queryKey: ["shopping-lists"] });
  const [vraagVerwijder, setVraagVerwijder] = useState(false);
  const [weergave, setWeergave] = useState<"lijst" | "gerechten">("lijst");
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
    const alToegevoegd = new Set([
      ...items.map((i) => i.recipe_id).filter(Boolean),
      ...geschiedenis.map((i) => i.recipe_id).filter(Boolean),
    ]);
    return weekGerechten.filter((g) => !alToegevoegd.has(g.recipe_id));
  }, [weekGerechten, items, geschiedenis]);
  const toegevoegdeWeekGerechten = useMemo(() => weekGerechten.filter((g) => !weekOpen.some((open) => open.recipe_id === g.recipe_id)), [weekGerechten, weekOpen]);
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

  async function zetGerechtOpLijst(recipeId: string, titel: string, personen?: number | null, servings?: number | null) {
    if (!user || !actief) return;
    // Schaalt de ingrediënten mee met het geplande aantal personen, indien gekend.
    const factor = personen && servings && servings > 0 ? personen / servings : 1;
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit")
      .eq("recipe_id", recipeId)
      .order("position");
    const lijst = (data ?? []).map((i) => ({
      ...i,
      quantity: i.quantity === null || i.quantity === undefined ? null : Math.round(i.quantity * factor * 100) / 100,
      recipe_id: recipeId,
    }));
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

  /** Rijen exact terugzetten (zelfde naam, hoeveelheid, gerecht en notitie). */
  async function zetRijenTerug(rijen: Item[], lijstId: string) {
    if (!user || !rijen.length) return;
    const { error } = await supabase.from("shopping_items").insert(
      rijen.map((r) => ({
        user_id: user.id,
        list_id: lijstId,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        checked: r.checked,
        recipe_id: r.recipe_id ?? null,
        note: r.note ?? null,
      })),
    );
    if (error) throw error;
  }

  /** Verwijderen met "Ongedaan maken": we zetten hetzelfde item dan gewoon terug. */
  async function verwijder(item: Item) {
    if (!user || !actief) return;
    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (error) {
      toast.error(`${item.name} verwijderen lukte niet. Probeer het opnieuw.`);
      return;
    }
    refresh();
    const lijstId = actief;
    let teruggezet = false;
    const herstel = async () => {
      if (teruggezet) return;
      teruggezet = true;
      await zetRijenTerug([item], lijstId);
    };
    onthoud(`${item.name} staat terug op je lijst`, herstel);
    toast.success(`${item.name} verwijderd`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void herstel()
            .catch(() => toast.error("Terugzetten lukte niet."))
            .finally(refresh);
        },
      },
    });
  }

  /** WP5: in de winkel vervangen — hoeveelheid, gerecht en notitie blijven, meteen in je kar. */
  async function vervangInWinkel(item: Item, door: Vervanging): Promise<boolean> {
    const naam = vervangNaam(door.naam, item.name);
    const maat = belgischeMaat(door.quantity, door.unit);
    const { error } = await supabase
      .from("shopping_items")
      .update({ name: naam, quantity: maat.quantity, unit: maat.unit, checked: true })
      .eq("id", item.id);
    if (error) {
      toast.error("Vervangen lukte niet. Je lijst blijft zoals hij was.");
      return false;
    }
    void meet("boodschappen.vervangen");
    setAfvinkTijd((t) => ({ ...t, [item.id]: Date.now() }));
    const vorig = { name: item.name, quantity: item.quantity, unit: item.unit, checked: item.checked };
    let teruggezet = false;
    const herstel = async () => {
      if (teruggezet) return;
      teruggezet = true;
      const { error: e } = await supabase.from("shopping_items").update(vorig).eq("id", item.id);
      if (e) throw e;
    };
    onthoud(`${vervanging(item.name).naam} staat weer op je lijst`, herstel);
    refresh();
    toast.success(`${vervanging(naam).naam} in je kar, in plaats van ${vervanging(item.name).naam}`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void herstel()
            .catch(() => toast.error("Terugzetten lukte niet."))
            .finally(refresh);
        },
      },
    });
    return true;
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
    if (!gekozen.size || !actief) return;
    const weg = items.filter((i) => gekozen.has(i.id));
    const lijstId = actief;
    const { error } = await supabase.from("shopping_items").delete().in("id", [...gekozen]);
    if (error) {
      toast.error("Verwijderen lukte niet. Je lijst blijft zoals hij was.");
      return;
    }
    let teruggezet = false;
    const herstel = async () => {
      if (teruggezet) return;
      teruggezet = true;
      await zetRijenTerug(weg, lijstId);
    };
    onthoud(`${weg.length} terug op je lijst`, herstel);
    toast.success(`${weg.length} verwijderd`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void herstel()
            .catch(() => toast.error("Terugzetten lukte niet."))
            .finally(refresh);
        },
      },
    });
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
    const thuis = (data ?? []).map((r) => r.naam.trim()).filter(Boolean);
    if (thuis.length === 0) {
      toast.info("Je voorraadkast is nog leeg.");
      return;
    }
    // Echt hetzelfde product (vroeger: "ui" vinkte ook "suiker" af).
    const raak = items.filter((i) => !i.checked && zitInVoorraad(i.name, thuis));
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
    const ids = raak.map((i) => i.id);
    onthoud(`${raak.length} terug op je lijst`, async () => {
      await supabase.from("shopping_items").update({ checked: false }).in("id", ids);
    });
    toast.success(`${raak.length} afgevinkt — je hebt ze al in huis.`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void supabase.from("shopping_items").update({ checked: false }).in("id", ids).then(refresh);
        },
      },
    });
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

  // V2-kringloop (S2): klaar met winkelen = in de voorraad + lijst opgeruimd. Geen vraag,
  // wel één "Ongedaan maken".
  const vernieuwKringloop = useKringloopVernieuw();
  // Usecase 9: in de winkel tonen wat je voor vandaag of morgen nog vergeten bent.
  const aanvulling = useAanvulling();
  const [slim] = useSlimmeVoorstellen();
  const voorMorgen =
    slim && aanvulling.data
      ? nogNodigVoorMorgen(aanvulling.data.aanvulling.kopen, lokaleDatum())
      : null;
  const [winkelKlaarBezig, setWinkelKlaarBezig] = useState(false);
  async function klaarMetWinkelenNu() {
    if (!user || !actieveLijst || !klaar.length || winkelKlaarBezig) return;
    setWinkelKlaarBezig(true);
    try {
      const r = await klaarMetWinkelen({ userId: user.id, lijst: actieveLijst, gekocht: klaar });
      void meet("kringloop.naar_voorraad", undefined, { aantal: r.inVoorraad });
      refresh();
      vernieuwKringloop();
      qc.invalidateQueries({ queryKey: ["shopping-history"] });
      meldMetHerstel(
        r.inVoorraad
          ? `${r.inVoorraad} ${r.inVoorraad === 1 ? "ding" : "dingen"} in je voorraad gezet`
          : "Lijst opgeruimd",
        async () => {
          await r.herstel();
          refresh();
        },
        vernieuwKringloop,
      );
    } catch (fout) {
      toast.error(
        fout instanceof HalfGelukt
          ? "Dat lukte maar half. Kijk je lijst en voorraad even na."
          : "Dat lukte niet. Je lijst blijft staan.",
      );
    } finally {
      setWinkelKlaarBezig(false);
    }
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

  const lijstKiezer =
    lijsten.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-secondary px-4 text-base font-semibold text-secondary-foreground"
          >
            <span className="truncate">
              {actieveNaam}
              {actieveLijst?.group_id ? " · gezin" : ""}
            </span>
            <ChevronDown className="size-5 shrink-0" />
            <span className="sr-only">— andere lijst kiezen</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {lijsten.map((l) => (
            <DropdownMenuItem key={l.id} onSelect={() => setActief(l.id)}>
              {l.id === actief ? <Check /> : <span className="size-5" />} {l.name}
              {l.group_id ? " · gezin" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <span className="inline-flex min-h-11 items-center rounded-full bg-secondary px-4 text-base font-semibold text-secondary-foreground">
        {actieveNaam}
        {actieveLijst?.group_id ? " · gezin" : ""}
      </span>
    );

  return (
    <AppShell
      breed
      title="Boodschappen"
      kop={
        <div className="mb-5">
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 text-paginatitel">Boodschappen</h1>
            <Button
              variant="zacht"
              size="icon"
              onClick={() => void zetTerug()}
              disabled={terugAantal === 0}
              aria-label="Ongedaan maken: laatste actie terugzetten"
              title="Ongedaan maken"
            >
              <Undo2 />
            </Button>
            <Button
              variant="zacht"
              size="icon"
              onClick={() => setMeerOpen(true)}
              aria-label="Meer opties voor deze lijst"
            >
              <MoreHorizontal />
            </Button>
          </div>
          {lijsten.length > 1 || actieveLijst?.group_id ? (
            <div className="mt-2">{lijstKiezer}</div>
          ) : null}
          {/* B1: status en "winkelen" op één regel — daaronder meteen de lijst. */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg text-muted-foreground">
              {openAantal === 0
                ? items.length
                  ? "Alles gekocht!"
                  : "Je lijst is leeg"
                : `${openAantal} te kopen`}
              {klaar.length > 0 ? ` · ${klaar.length} in je kar` : ""}
            </p>
            {openAantal > 0 ? (
              <Button onClick={() => setWinkel(true)} className="h-12 shrink-0 px-4 text-base">
                <ShoppingCart /> Ik ga winkelen
              </Button>
            ) : null}
          </div>
          {totaal > 0 ? (
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Gekocht"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={procent}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${procent}%` }}
              />
            </div>
          ) : null}
          {actieveLijst?.group_id ? (
            <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
              <Users className="size-4" aria-hidden /> Iedereen in je gezin kan aanvullen en
              afvinken.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {!online && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-2xl bg-honing-zacht px-4 py-3 text-base text-honing-foreground"
          >
            <WifiOff className="size-5 shrink-0" /> Je bent offline — we bewaren alles straks.
          </p>
        )}

        {weergave === "lijst" ? (
          // B1 — lijst eerst. Telefoon: lijst bovenaan, invoer vast onderaan, de rest ná de lijst.
          // Tablet: invoer bovenaan, dan de lijst. Desktop: lijst links, toevoegen en aanvullen rechts.
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
            {/* Snel toevoegen: op de telefoon vast onderaan, binnen bereik van de duim. */}
            <section
              aria-label="Iets toevoegen"
              className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-border/70 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none lg:col-start-2 lg:row-start-1"
            >
              <div className="mx-auto max-w-3xl">
                {invoerFocus && !nieuw.trim() && vaakLosOpen.length > 0 ? (
                  <div
                    className="scroll-rij -mx-1 mb-2 flex gap-2 overflow-x-auto px-1"
                    aria-label="Vaak gekocht"
                  >
                    {vaakLosOpen.slice(0, 10).map((e) => (
                      <Button
                        key={e.name}
                        variant="zacht"
                        size="sm"
                        className="shrink-0"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          void meet("boodschappen.vaak_gekocht");
                          void voegMeerdereToe(
                            [{ name: e.name, quantity: e.quantity, unit: e.unit }],
                            `${e.name} staat op je lijst`,
                          );
                        }}
                      >
                        <Plus className="size-4" /> {e.name}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {typSuggesties.length > 0 ? (
                  <div className="scroll-rij -mx-1 mb-2 flex gap-2 overflow-x-auto px-1" aria-label="Eerder gekocht">
                    {typSuggesties.map((s) => (
                      <Button
                        key={s}
                        variant="zacht"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setNieuw("");
                          void voegTekstToe(s);
                        }}
                      >
                        <Plus className="size-4" /> {s}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <label htmlFor="toevoegen" className="sr-only">
                  Iets toevoegen
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="zacht"
                    size="icon"
                    className="size-14"
                    aria-label="Producten kiezen"
                    onClick={() => setCatalogusOpen(true)}
                  >
                    <LayoutGrid className="size-6" />
                  </Button>
                  <Input
                    id="toevoegen"
                    value={nieuw}
                    onChange={(e) => setNieuw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void voegToe()}
                    onFocus={() => setInvoerFocus(true)}
                    onBlur={() => window.setTimeout(() => setInvoerFocus(false), 150)}
                    placeholder="Melk, 6 eieren, wasmiddel…"
                    className="rounded-full bg-card px-5"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                  <Button
                    onClick={() => void voegToe()}
                    size="icon"
                    className="size-14 shrink-0"
                    aria-label="Voeg toe"
                  >
                    <Plus className="size-7" />
                  </Button>
                </div>
              </div>
            </section>

            <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
              {items.length === 0 ? (
                <EmptyState
                  icon={<ShoppingCart />}
                  title="Nog niets op je lijst"
                  description="Typ wat je nodig hebt, of kies iets dat je eerder kocht."
                />
              ) : (
                <div className="space-y-4">
                  <h2 className="sr-only">Je lijst</h2>

                  {kiesModus && (
                    <div className="sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-inkt p-3 text-inkt-foreground shadow-zwevend">
                      <p className="flex-1 text-base font-semibold">{gekozen.size} gekozen</p>
                      <Button
                        variant="zacht"
                        size="sm"
                        onClick={() => {
                          setKiesModus(false);
                          setGekozen(new Set());
                        }}
                      >
                        Stoppen
                      </Button>
                      {lijsten.filter((l) => l.id !== actief).length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="zacht" size="sm">
                              Verplaatsen
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-56">
                            {lijsten
                              .filter((l) => l.id !== actief)
                              .map((l) => (
                                <DropdownMenuItem
                                  key={l.id}
                                  onSelect={() => void verplaatsGekozen(l.id)}
                                >
                                  {l.name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void verwijderGekozen()}
                        disabled={!gekozen.size}
                      >
                        <Trash2 /> Verwijderen
                      </Button>
                    </div>
                  )}

                  {/* Desktop: afdelingen in twee kolommen, zoals een winkelbriefje (tablet: één brede kolom, namen blijven leesbaar). */}
                  <div className="space-y-4 lg:block lg:columns-2 lg:gap-4 lg:space-y-0 lg:[&>section]:mb-4 lg:[&>section]:break-inside-avoid">
                    {groepen.map(({ id, lijst }) => {
                      const open = !dicht[id];
                      return (
                        <section
                          key={id}
                          aria-label={CATEGORIE_LABEL[id]}
                          className="paneel overflow-hidden"
                        >
                          <div className="flex items-center gap-1 border-b border-border/70 bg-muted/40 py-1 pl-2 pr-1">
                            <button
                              type="button"
                              onClick={() => setDicht((d) => ({ ...d, [id]: open }))}
                              aria-expanded={open}
                              className="flex min-h-12 flex-1 items-center gap-2 px-2 text-left"
                            >
                              <span className="text-[1.05rem] font-bold">
                                {CATEGORIE_LABEL[id]}
                              </span>
                              <span className="rounded-full bg-card px-2.5 py-0.5 text-[0.95rem] font-semibold text-muted-foreground ring-1 ring-border">
                                {lijst.length}
                              </span>
                              <span className="flex-1" />
                              {open ? (
                                <ChevronDown className="size-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-5 text-muted-foreground" />
                              )}
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Alles in ${CATEGORIE_LABEL[id]} afvinken`}
                              onClick={() => void vinkCategorieAf(lijst)}
                            >
                              <CheckCheck />
                            </Button>
                          </div>
                          {open ? (
                            <ul className="divide-y divide-border/70">
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
                                    onWaarom={() => setWaarom(item)}
                                    door={doorWie(item)}
                                    onCategorie={(c) => zetCategorie(item.name, c)}
                                  />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                  {klaar.length > 0 ? (
                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="klaar"
                      className="rounded-[1.25rem] bg-muted/60 px-2 ring-1 ring-border/70"
                    >
                      <AccordionItem value="klaar" className="border-0">
                        <AccordionTrigger className="px-2 text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <ShoppingCart className="size-5" /> In je kar ({klaar.length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-2">
                          <ul className="divide-y divide-border/70">
                            {klaar.map((item) => (
                              <li key={item.id}>
                                <ItemRij
                                  item={item}
                                  kiesModus={kiesModus}
                                  gekozen={gekozen.has(item.id)}
                                  onKies={() => kies(item.id)}
                                  onVink={() => vink(item)}
                                  onBewerk={() => openBewerken(item)}
                                  onVerwijder={() => verwijder(item)}
                                  onWaarom={() => setWaarom(item)}
                                  onCategorie={(c) => zetCategorie(item.name, c)}
                                />
                              </li>
                            ))}
                          </ul>
                          <Button
                            onClick={() => void klaarMetWinkelenNu()}
                            disabled={winkelKlaarBezig}
                            className="mt-3 w-full"
                          >
                            <PackageCheck /> Klaar met winkelen
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setWisVraag("afgevinkt")}
                            className="mt-1 w-full text-destructive"
                          >
                            <Trash2 /> Wis afgevinkte boodschappen
                          </Button>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : null}
                </div>
              )}
            </div>
            <aside
              aria-label="Meer voor je lijst"
              className="space-y-5 lg:col-start-2 lg:row-start-2"
            >
              {/* Aanvullen: compact onder de lijst; op desktop de volle kaart in de zijkolom. */}
              <div className="lg:hidden">
                <AanvulRegel />
              </div>
              <div className="hidden lg:block">
                <AanvulKaart />
              </div>

              <section aria-labelledby="toevoegen-uit" className="paneel overflow-hidden">
                <h2
                  id="toevoegen-uit"
                  className="px-4 pt-3 text-base font-bold text-muted-foreground"
                >
                  Toevoegen uit…
                </h2>
                <ul className="divide-y divide-border/70">
                  {[
                    {
                      label: "Producten",
                      uitleg: "Kies uit tegels per afdeling",
                      icoon: LayoutGrid,
                      doe: () => setCatalogusOpen(true),
                    },
                    {
                      label: "Je weekmenu",
                      uitleg: "Per gepland gerecht",
                      icoon: CalendarDays,
                      doe: () => setWeergave("gerechten"),
                    },
                    {
                      label: "Eerder gekocht",
                      uitleg: "Je vorige boodschappen",
                      icoon: History,
                      doe: () => setGeheugenOpen(true),
                    },
                    {
                      label: "Winkelideeën",
                      uitleg: "Wat je misschien vergeet",
                      icoon: Lightbulb,
                      doe: () => setWinkelIdeeen(true),
                    },
                  ].map((h) => (
                    <li key={h.label}>
                      <button
                        type="button"
                        onClick={h.doe}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/60"
                      >
                        <h.icoon className="size-6 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-semibold">{h.label}</span>
                          <span className="block text-base text-muted-foreground">{h.uitleg}</span>
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Vaak gekocht — alleen echte losse aankopen, nooit verzonnen. */}
              {vaakLosOpen.length > 0 && (
                <section aria-labelledby="vaak-kop">
                  <h2
                    id="vaak-kop"
                    className="mb-2 flex items-center gap-2 px-1 text-[0.95rem] font-bold text-muted-foreground"
                  >
                    <Star className="size-4" aria-hidden /> Vaak gekocht — tik om toe te voegen
                  </h2>
                  <div className="scroll-rij -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                    {(vaakAlles ? vaakLosOpen : vaakLosOpen.slice(0, 12)).map((e) => (
                      <Button
                        key={e.name}
                        variant="zacht"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          void meet("boodschappen.vaak_gekocht");
                          void voegMeerdereToe(
                            [{ name: e.name, quantity: e.quantity, unit: e.unit }],
                            `${e.name} staat op je lijst`,
                          );
                        }}
                      >
                        <Plus className="size-4" /> {e.name}
                      </Button>
                    ))}
                    {vaakLosOpen.length > 12 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setVaakAlles((v) => !v)}
                      >
                        {vaakAlles ? "Minder" : `Alles (${vaakLosOpen.length})`}
                      </Button>
                    ) : null}
                  </div>
                </section>
              )}

              <Accordion type="single" collapsible className="paneel px-4">
                <AccordionItem value="kaarten" className="border-0">
                  <AccordionTrigger>
                    <span className="flex min-w-0 items-center gap-3 [overflow-wrap:anywhere]">
                      <Icoon icoon={WalletCards} tint="blauw" /> Klantenkaarten
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Klantenkaarten />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </aside>
            {/* Ruimte voor de vaste invoerbalk onderaan (alleen telefoon). */}
            <div aria-hidden className="h-28 md:hidden" />
          </div>
        ) : (
          <div className="space-y-5">
            <Button
              variant="ghost"
              className="-ml-2 h-12 text-base"
              onClick={() => setWeergave("lijst")}
            >
              <ChevronRight className="rotate-180" /> Terug naar je lijst
            </Button>
            {/* V2-kringloop: één tik voor alles wat nog ontbreekt (min voorraad). */}
            <Link
              to="/aanvullen"
              className="flex items-center gap-4 rounded-[1.5rem] bg-inkt p-5 text-inkt-foreground shadow-kaart transition-transform active:scale-[0.99]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-honing text-honing-foreground">
                <Sparkles className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-kaarttitel">Slim aanvullen</span>
                <span className="block text-base text-inkt-zacht">
                  Alles voor je komende maaltijden, min wat je al hebt
                </span>
              </span>
              <ChevronRight className="size-6 shrink-0" aria-hidden />
            </Link>
            <Groep
              titel={
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-5" aria-hidden /> Gerechten uit je weekmenu
                </span>
              }
              voet="Voeg ingrediënten toe zonder je boodschappenlijst uit het oog te verliezen."
            >
              {weekGerechten.length === 0 ? (
                <p className="p-4 text-base text-muted-foreground">
                  Nog geen gerechten gepland. Plan eerst een gerecht in je weekmenu.
                </p>
              ) : (
                weekGerechten.map((g) => {
                  const toegevoegd = toegevoegdeWeekGerechten.some(
                    (item) => item.recipe_id === g.recipe_id,
                  );
                  return (
                    <div key={g.recipe_id} className="flex min-h-20 items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[1.05rem] font-semibold">{g.titel}</span>
                        <span className="block text-[0.95rem] capitalize text-muted-foreground">
                          {datumLabel(g.dag)}
                        </span>
                      </span>
                      <Button
                        variant={toegevoegd ? "secondary" : "zacht"}
                        size="sm"
                        disabled={toegevoegd}
                        className="shrink-0"
                        onClick={() =>
                          void zetGerechtOpLijst(g.recipe_id, g.titel, g.personen, g.servings)
                        }
                      >
                        {toegevoegd ? (
                          <>
                            <Check /> Toegevoegd
                          </>
                        ) : (
                          <>
                            <Plus /> Zet op lijst
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </Groep>
          </div>
        )}
      </div>

      {user ? (
        <WaaromSheet
          regel={waarom}
          userId={user.id}
          listId={actief}
          onSluit={() => setWaarom(null)}
        />
      ) : null}
      <CatalogusSheet
        open={catalogusOpen}
        onSluit={() => setCatalogusOpen(false)}
        opLijst={(naam) => items.some((i) => !i.checked && zelfdeProduct(i.name, naam))}
        favorieten={[...vaste.map((v) => v.name), ...vaakLos.map((e) => e.name)].filter(
          (n, i, a) => a.findIndex((x) => zelfdeProduct(x, n)) === i,
        )}
        onKies={(naam, staatErOp) => {
          if (!staatErOp) {
            void voegTekstToe(naam);
            return;
          }
          // Weghalen is een bewuste keuze van de gebruiker; verwijder() biedt "Ongedaan maken".
          const open = items.filter((i) => !i.checked && zelfdeProduct(i.name, naam));
          const eerst = open.find((i) => !i.recipe_id) ?? open[0];
          if (eerst) void verwijder(eerst);
        }}
      />
      <WinkelvolgordeSheet
        open={volgordeOpen}
        volgorde={volgorde}
        onVolgorde={zetVolgorde}
        onSluit={() => setVolgordeOpen(false)}
      />

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
            <Button
              variant="outline"
              className="h-14 w-full justify-start text-base"
              onClick={() => {
                setMeerOpen(false);
                setWeergave("gerechten");
              }}
            >
              <CalendarDays /> Toevoegen uit je weekmenu
            </Button>
            <Button
              variant="outline"
              className="h-14 w-full justify-start text-base"
              onClick={() => {
                setMeerOpen(false);
                setGeheugenOpen(true);
              }}
            >
              <History /> Eerder gekocht
            </Button>
            <Button
              variant="outline"
              className="h-14 w-full justify-start text-base"
              onClick={() => {
                setMeerOpen(false);
                setWinkelIdeeen(true);
              }}
            >
              <Lightbulb /> Winkelideeën
            </Button>
            <Button
              variant="outline"
              className="h-14 w-full justify-start text-base"
              onClick={() => {
                setMeerOpen(false);
                setVolgordeOpen(true);
              }}
            >
              <ArrowUpDown /> Volgorde van je winkel
            </Button>
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
          lijstId={actief ?? "geen"}
          groepen={groepen}
          openAantal={openAantal}
          aantalGekocht={klaar.length}
          onVink={(item) => void vink(item)}
          onVervang={vervangInWinkel}
          onSluit={() => setWinkel(false)}
          onOpruimen={() => { setWinkel(false); void klaarMetWinkelenNu(); }}
          voorMorgen={voorMorgen}
          onVoorMorgen={async (v) => {
            const aantal = await aanvulling.zetOpLijst(new Set(v.sleutels));
            if (aantal) void meet("winkel.voor_morgen", undefined, { aantal });
          }}
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
            <p className="px-1 text-base text-muted-foreground">
              Wie de link opent, maakt eerst een gratis Foodlo-account. Daarna kan die mee aanvullen en afvinken.
            </p>
            {deelLink ? (
              <div className="rounded-xl bg-secondary p-3">
                <p className="break-all text-base">{deelLink}</p>
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
                <p className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
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
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lijst-weg-titel"
            className="w-full max-w-md rounded-t-[1.75rem] bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-zwevend sm:rounded-[1.75rem]"
          >
            <h2 id="lijst-weg-titel" className="text-sectietitel">
              Lijstje verwijderen?
            </h2>
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
        {sub ? <span className="block text-base text-muted-foreground">{sub}</span> : null}
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

function ItemRij({
  item,
  kiesModus,
  gekozen,
  onKies,
  onVink,
  onBewerk,
  onVerwijder,
  onCategorie,
  onWaarom,
  door,
}: {
  item: Item;
  kiesModus: boolean;
  gekozen: boolean;
  onKies: () => void;
  onVink: () => void;
  onBewerk: () => void;
  onVerwijder: () => void;
  onCategorie: (categorie: CategorieId) => void;
  /** B3: uitleg waarom dit op de lijst staat. */
  onWaarom?: () => void;
  /** Fase 5: naam van wie het toevoegde (alleen als dat iemand anders was). */
  door?: string | null;
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

  const vinkId = `vink-${item.id}`;
  return (
    <div
      onTouchStart={raakStart}
      onTouchEnd={raakEinde}
      className={cn(
        "flex min-h-[4.25rem] items-center gap-1 pl-2 pr-1 transition-colors",
        item.checked && "bg-muted/40",
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center">
        {kiesModus ? (
          <Checkbox
            id={vinkId}
            checked={gekozen}
            onCheckedChange={onKies}
            className="size-8 rounded-full"
            aria-label={`${item.name} kiezen`}
          />
        ) : (
          <Checkbox
            id={vinkId}
            checked={item.checked}
            onCheckedChange={onVink}
            className="size-8 rounded-full"
            aria-label={
              item.checked
                ? `${item.name} — gekocht, tik om terug te zetten`
                : `${item.name} als gekocht aanvinken`
            }
          />
        )}
      </span>
      {/* De hele rij is tikbaar om af te vinken: makkelijk met één hand in de winkel. */}
      <label
        htmlFor={vinkId}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <ItemNaam
            naam={item.name}
            className={cn(
              "block truncate text-lg leading-snug",
              item.checked && "text-muted-foreground line-through",
            )}
          />
          {item.note ? (
            <span className="block truncate text-[0.95rem] text-muted-foreground">{item.note}</span>
          ) : null}
          {door ? (
            <span className="block truncate text-[0.95rem] text-muted-foreground">
              toegevoegd door {door}
            </span>
          ) : null}
          {item.recept && onWaarom ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onWaarom();
              }}
              aria-label={`Waarom staat ${item.name} op je lijst? Voor ${item.recept}`}
              className="block min-h-6 max-w-full truncate text-left text-[0.95rem] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              voor {item.recept}
            </button>
          ) : item.recept ? (
            <span className="block truncate text-[0.95rem] text-muted-foreground">
              voor {item.recept}
            </span>
          ) : null}
        </span>
        {maatTekst(item) ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.95rem] font-semibold tabular-nums text-muted-foreground">
            {maatTekst(item)}
          </span>
        ) : null}
      </label>
      {!kiesModus ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          aria-label={`${item.name} aanpassen`}
          onClick={onBewerk}
        >
          <Pencil />
        </Button>
      ) : null}
    </div>
  );
}
