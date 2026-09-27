import { useEffect, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Trash2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Barcode } from "@/components/Barcode";
import { bewaarLokaal, groepeer, leesLokaal, type Kaart } from "@/lib/kaarten";

export const Route = createFileRoute("/kaarten/$id")({
  head: () => ({
    meta: [
      { title: "Je klantenkaart – Foodlo" },
      { name: "description", content: "Toon je klantenkaart aan de kassa, ook zonder internetverbinding." },
      { property: "og:title", content: "Je klantenkaart – Foodlo" },
      { property: "og:description", content: "Grote streepjescode, klaar voor de kassascanner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KaartPagina,
});

function KaartPagina() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [kassa, setKassa] = useState(false);

  const { data: kaart } = useQuery({
    queryKey: ["loyalty-kaart", id],
    initialData: () => leesLokaal().find((k) => k.id === id) ?? undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_cards")
        .select("id, user_id, store_slug, winkel_naam, kaartnaam, nummer, formaat, favoriet, gedeeld")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return leesLokaal().find((k) => k.id === id) ?? null;
      const alles = leesLokaal().filter((k) => k.id !== id);
      bewaarLokaal([...alles, data as Kaart]);
      return data as Kaart;
    },
  });

  const [kaartnaam, setKaartnaam] = useState("");
  useEffect(() => {
    if (kaart) setKaartnaam(kaart.kaartnaam ?? "");
  }, [kaart?.id]);

  if (!kaart) {
    return (
      <AppShell title="Klantenkaart">
        <p className="text-lg text-muted-foreground">Deze kaart is niet gevonden.</p>
      </AppShell>
    );
  }

  const vanMij = kaart.user_id === user?.id;

  const wijzig = async (velden: Partial<Kaart>) => {
    const { error } = await supabase.from("loyalty_cards").update(velden).eq("id", kaart.id);
    if (error) {
      toast.error("Aanpassen lukte niet.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["loyalty-kaart", id] });
    qc.invalidateQueries({ queryKey: ["loyalty-kaarten"] });
  };

  const verwijder = async () => {
    const { error } = await supabase.from("loyalty_cards").delete().eq("id", kaart.id);
    if (error) {
      toast.error("Verwijderen lukte niet.");
      return;
    }
    bewaarLokaal(leesLokaal().filter((k) => k.id !== kaart.id));
    qc.invalidateQueries({ queryKey: ["loyalty-kaarten"] });
    toast.success("Kaart verwijderd");
    navigate({ to: "/kaarten" });
  };

  if (kassa) return <Kassa kaart={kaart} onSluiten={() => setKassa(false)} />;

  return (
    <AppShell title={kaart.winkel_naam}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <Barcode waarde={kaart.nummer} formaat={kaart.formaat} hoogte={110} />
          <p className="mt-3 text-center font-mono text-lg tracking-wide text-slate-800">
            {groepeer(kaart.nummer)}
          </p>
        </div>

        <Button onClick={() => setKassa(true)} className="h-16 w-full gap-2 text-lg">
          <Maximize2 className="size-6" aria-hidden /> Tonen aan de kassa
        </Button>

        {vanMij ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div>
              <label className="text-base font-medium" htmlFor="naam">
                Naam van de kaart
              </label>
              <Input
                id="naam"
                value={kaartnaam}
                onChange={(e) => setKaartnaam(e.target.value)}
                onBlur={() => {
                  if (kaartnaam !== kaart.kaartnaam) wijzig({ kaartnaam });
                }}
                className="mt-1 h-14 text-base"
              />
            </div>
            <label className="flex items-center justify-between rounded-2xl border border-border p-3">
              <span className="flex items-center gap-2 text-base">
                <Star className="size-5" aria-hidden /> Favoriet
              </span>
              <Switch checked={kaart.favoriet} onCheckedChange={(v) => wijzig({ favoriet: v })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-3">
              <span className="text-base">
                Delen met mijn gezin
                <span className="block text-base text-muted-foreground">Uit = alleen jij ziet deze kaart.</span>
              </span>
              <Switch checked={kaart.gedeeld} onCheckedChange={(v) => wijzig({ gedeeld: v })} />
            </label>
            <Button variant="destructive" onClick={verwijder} className="h-14 w-full gap-2 text-base">
              <Trash2 className="size-5" aria-hidden /> Kaart verwijderen
            </Button>
          </div>
        ) : (
          <p className="text-base text-muted-foreground">Deze kaart wordt gedeeld door je gezin.</p>
        )}
      </div>
    </AppShell>
  );
}

// Volledig scherm, zo helder mogelijk, zonder afleiding: klaar voor de kassascanner.
function Kassa({ kaart, onSluiten }: { kaart: Kaart; onSluiten: () => void }) {
  useEffect(() => {
    void meet("kaart.getoond");
  }, []);
  useEffect(() => {
    let lock: any = null;
    const nav: any = navigator;
    nav.wakeLock?.request?.("screen").then(
      (l: any) => {
        lock = l;
      },
      () => undefined,
    );
    return () => {
      try {
        lock?.release?.();
      } catch {
        /* niets */
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 p-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
        <button
          type="button"
          onClick={onSluiten}
          className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-lg font-semibold text-slate-700"
        >
          <ArrowLeft className="size-6" aria-hidden /> Sluiten
        </button>
        <p className="text-2xl font-bold text-slate-900">{kaart.winkel_naam}</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
        <div className="w-full max-w-xl">
          <Barcode waarde={kaart.nummer} formaat={kaart.formaat} hoogte={220} />
        </div>
        <p className="font-mono text-2xl tracking-widest text-slate-900">{groepeer(kaart.nummer)}</p>
      </div>
    </div>
  );
}
