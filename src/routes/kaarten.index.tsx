import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, ScanLine, Star, Keyboard, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { KaartScanner } from "@/components/KaartScanner";
import { Barcode } from "@/components/Barcode";
import { EmptyState } from "@/components/EmptyState";
import {
  FORMATEN,
  bewaarLokaal,
  bewaarWinkels,
  formaatVanScan,
  groepeer,
  leesLokaal,
  leesWinkels,
  raadWinkel,
  type Kaart,
  type Winkel,
} from "@/lib/kaarten";
import { leesCodeUitBestand, zxingFormaat } from "@/lib/kaart-scan";

export const Route = createFileRoute("/kaarten/")({
  head: () => ({
    meta: [
      { title: "Klantenkaarten – Foodlo" },
      {
        name: "description",
        content:
          "Bewaar je klantenkaarten van Carrefour, Delhaize, Colruyt en andere winkels en toon ze aan de kassa, ook zonder internet.",
      },
      { property: "og:title", content: "Klantenkaarten – Foodlo" },
      {
        property: "og:description",
        content: "Al je klantenkaarten op je telefoon, klaar voor de kassa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KaartenPagina,
});

function KaartenPagina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [toevoegen, setToevoegen] = useState(false);

  const { data: winkels = leesWinkels() } = useQuery({
    queryKey: ["loyalty-winkels"],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_stores")
        .select("slug, naam, kleur, standaard_formaat")
        .eq("actief", true)
        .order("volgorde");
      const lijst = (data ?? []) as Winkel[];
      if (lijst.length) bewaarWinkels(lijst);
      return lijst.length ? lijst : leesWinkels();
    },
  });

  const { data: kaarten = leesLokaal() } = useQuery({
    queryKey: ["loyalty-kaarten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_cards")
        .select(
          "id, user_id, store_slug, winkel_naam, kaartnaam, nummer, formaat, favoriet, gedeeld",
        )
        .order("favoriet", { ascending: false })
        .order("winkel_naam");
      if (error) return leesLokaal();
      const lijst = (data ?? []) as Kaart[];
      bewaarLokaal(lijst);
      return lijst;
    },
  });

  const eigen = kaarten.filter((k) => k.user_id === user?.id);
  const vanGezin = kaarten.filter((k) => k.user_id !== user?.id);

  return (
    <AppShell
      title="Klantenkaarten"
      action={
        <Button onClick={() => setToevoegen(true)} className="h-12 gap-2 px-4">
          <Plus className="size-5" aria-hidden /> Kaart
        </Button>
      }
    >
      {kaarten.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-7" />}
          title="Nog geen kaarten"
          description="Bewaar je klantenkaart één keer en toon ze daarna ook zonder internet."
          action={<Button onClick={() => setToevoegen(true)}>Kaart toevoegen</Button>}
        />
      ) : (
        <div className="space-y-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {eigen.map((k) => (
              <KaartTegel key={k.id} kaart={k} winkels={winkels} />
            ))}
          </ul>
          {vanGezin.length > 0 ? (
            <section>
              <h2 className="mb-2 px-1 text-[0.95rem] font-bold text-muted-foreground">
                Gedeeld door je gezin
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {vanGezin.map((k) => (
                  <KaartTegel key={k.id} kaart={k} winkels={winkels} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {toevoegen ? (
        <ToevoegVenster
          winkels={winkels}
          onKlaar={() => {
            setToevoegen(false);
            qc.invalidateQueries({ queryKey: ["loyalty-kaarten"] });
          }}
          onSluiten={() => setToevoegen(false)}
        />
      ) : null}
    </AppShell>
  );
}

function kleurVan(kaart: Kaart, winkels: Winkel[]) {
  return winkels.find((w) => w.slug === kaart.store_slug)?.kleur ?? "#475569";
}

function KaartTegel({ kaart, winkels }: { kaart: Kaart; winkels: Winkel[] }) {
  // Ziet eruit als de echte kaart in je portefeuille: winkelkleur, naam, nummer.
  return (
    <li>
      <Link
        to="/kaarten/$id"
        params={{ id: kaart.id }}
        className="relative flex aspect-[1.75] flex-col justify-between overflow-hidden rounded-[1.25rem] p-5 text-white shadow-kaart transition-transform active:scale-[0.98]"
        style={{ backgroundColor: kleurVan(kaart, winkels) }}
      >
        {/* Donkere laag: witte tekst blijft leesbaar op elke winkelkleur (≥ 4.5:1). */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/35" />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10"
        />
        <span className="relative flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[1.5rem] font-bold leading-tight drop-shadow-sm">
              {kaart.winkel_naam}
            </span>
            {kaart.kaartnaam ? (
              <span className="block truncate text-base text-white/90">{kaart.kaartnaam}</span>
            ) : null}
          </span>
          {kaart.favoriet ? (
            <Star className="size-6 shrink-0 fill-white text-white" aria-label="Favoriet" />
          ) : null}
        </span>
        <span className="relative flex items-end justify-between gap-3">
          <span className="min-w-0 truncate font-mono text-lg tracking-wider text-white/95">
            {groepeer(kaart.nummer)}
          </span>
          <span className="shrink-0 rounded-full bg-black/30 px-3 py-1 text-[0.9rem] font-semibold">
            Tonen
          </span>
        </span>
      </Link>
    </li>
  );
}

function ToevoegVenster({
  winkels,
  onKlaar,
  onSluiten,
}: {
  winkels: Winkel[];
  onKlaar: () => void;
  onSluiten: () => void;
}) {
  const { user } = useAuth();
  const [scannen, setScannen] = useState(false);
  const [nummer, setNummer] = useState("");
  const [formaat, setFormaat] = useState("CODE128");
  const [slug, setSlug] = useState<string>("");
  const [kaartnaam, setKaartnaam] = useState("");
  const [favoriet, setFavoriet] = useState(false);
  const [gedeeld, setGedeeld] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const winkel = useMemo(() => winkels.find((w) => w.slug === slug) ?? null, [winkels, slug]);

  const uitFoto = async (file: File | undefined) => {
    if (!file) return;
    setFotoBezig(true);
    const gelezen = await leesCodeUitBestand(file);
    setFotoBezig(false);
    if (!gelezen) {
      toast.error(
        "We zien geen code op die foto. Probeer dichterbij en recht van boven, of typ het nummer zelf in.",
      );
      logScan(user?.id, "foto", null, null, false);
      return;
    }
    gevonden(gelezen.waarde, zxingFormaat(gelezen.formaat));
  };

  const gevonden = (waarde: string, scanFormaat: string) => {
    setScannen(false);
    setNummer(waarde.trim());
    setFormaat(formaatVanScan(scanFormaat));
    const geraden = raadWinkel(waarde, winkels);
    if (geraden) {
      setSlug(geraden.slug);
      toast.success(`${geraden.naam} herkend. Klopt dat?`);
    } else {
      toast.success("Code gescand. Kies nog de winkel.");
    }
    logScan(user?.id, "scan", formaatVanScan(scanFormaat), geraden?.slug ?? null, true);
  };

  const bewaar = async () => {
    if (!user) return;
    if (!nummer.trim()) {
      toast.error("Vul eerst het kaartnummer in.");
      return;
    }
    if (!winkel) {
      toast.error("Kies eerst een winkel.");
      return;
    }
    setBezig(true);
    const { error } = await supabase.from("loyalty_cards").insert({
      user_id: user.id,
      store_slug: winkel.slug,
      winkel_naam: winkel.naam,
      kaartnaam: kaartnaam.trim(),
      nummer: nummer.trim(),
      formaat,
      favoriet,
      gedeeld,
    });
    setBezig(false);
    if (error) {
      toast.error("Bewaren lukte niet. Probeer het opnieuw.");
      return;
    }
    toast.success("Kaart bewaard");
    onKlaar();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kaart-toevoegen-titel"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-zwevend sm:rounded-[1.75rem] sm:p-7"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-border sm:hidden"
        />
        <h2 id="kaart-toevoegen-titel" className="text-sectietitel">
          Kaart toevoegen
        </h2>

        <div className="mt-4 space-y-3">
          <Button onClick={() => setScannen(true)} className="h-14 w-full gap-2 text-base">
            <ScanLine className="size-5" aria-hidden /> Scan je kaart
          </Button>
          <p className="text-center text-base text-muted-foreground">of</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              disabled={fotoBezig}
              onClick={() => fotoRef.current?.click()}
              className="h-14 gap-2 text-base"
            >
              <ImageIcon className="size-5" aria-hidden />{" "}
              {fotoBezig ? "Even kijken…" : "Foto kiezen"}
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById("kaartnummer")?.focus()}
              className="h-14 gap-2 text-base"
            >
              <Keyboard className="size-5" aria-hidden /> Zelf invullen
            </Button>
          </div>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void uitFoto(file);
            }}
          />
        </div>

        {nummer ? (
          <div className="mt-4 rounded-2xl bg-white p-3">
            <Barcode waarde={nummer} formaat={formaat} hoogte={80} />
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-base font-semibold" htmlFor="winkel">
              Winkel
            </label>
            <select
              id="winkel"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                const w = winkels.find((x) => x.slug === e.target.value);
                if (w && !nummer) setFormaat(w.standaard_formaat);
              }}
              className="mt-1 h-14 w-full rounded-2xl border-2 border-input bg-card px-4 text-base"
            >
              <option value="">Kies je winkel…</option>
              {winkels.map((w) => (
                <option key={w.slug} value={w.slug}>
                  {w.naam}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-base font-semibold" htmlFor="kaartnummer">
              Kaartnummer
            </label>
            <Input
              id="kaartnummer"
              value={nummer}
              inputMode="text"
              onChange={(e) => setNummer(e.target.value)}
              placeholder="bv. 5400141234567"
              className="mt-1 h-14 text-base"
            />
          </div>

          <div>
            <label className="text-base font-semibold" htmlFor="formaat">
              Soort code
            </label>
            <select
              id="formaat"
              value={formaat}
              onChange={(e) => setFormaat(e.target.value)}
              className="mt-1 h-14 w-full rounded-2xl border-2 border-input bg-card px-4 text-base"
            >
              {FORMATEN.map((f) => (
                <option key={f} value={f}>
                  {f === "QR" ? "QR-code" : f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-base font-semibold" htmlFor="kaartnaam">
              Naam (optioneel)
            </label>
            <Input
              id="kaartnaam"
              value={kaartnaam}
              onChange={(e) => setKaartnaam(e.target.value)}
              placeholder="bv. Kaart van mama"
              className="mt-1 h-14 text-base"
            />
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-border p-3">
            <span className="text-base">Favoriet</span>
            <Switch checked={favoriet} onCheckedChange={setFavoriet} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-border p-3">
            <span className="text-base">
              Delen met mijn gezin
              <span className="block text-base text-muted-foreground">
                Standaard blijft je kaart privé.
              </span>
            </span>
            <Switch checked={gedeeld} onCheckedChange={setGedeeld} />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={onSluiten} className="h-14 flex-1 text-base">
            Annuleren
          </Button>
          <Button onClick={bewaar} disabled={bezig} className="h-14 flex-1 text-base">
            Bewaren
          </Button>
        </div>
      </div>

      <KaartScanner
        open={scannen}
        onSluiten={() => {
          setScannen(false);
          logScan(user?.id, "scan", null, null, false);
        }}
        onGevonden={gevonden}
      />
    </div>
  );
}

// Alleen of het scannen lukte — nooit het kaartnummer zelf.
async function logScan(
  userId: string | undefined,
  methode: string,
  formaat: string | null,
  store: string | null,
  ok: boolean,
) {
  if (!userId) return;
  try {
    await supabase
      .from("loyalty_scan_events")
      .insert({ user_id: userId, methode, formaat, store_slug: store, ok });
  } catch {
    /* mag de app nooit breken */
  }
}
