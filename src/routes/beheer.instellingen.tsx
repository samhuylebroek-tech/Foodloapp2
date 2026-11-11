import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { adminInstellingZetten, adminInstellingen } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BETAALPROVIDER_GEKOPPELD } from "@/lib/limiet";

export const Route = createFileRoute("/beheer/instellingen")({ component: Instellingen });

const LABELS: Record<string, string> = {
  ai_import: "AI-import (link, tekst, foto)",
  ontdek_suggesties: "Ontdek-suggesties op het startscherm",
  weer_suggesties: "Weersuggesties",
  vrienden: "Vrienden & delen",
  feedback: "Feedbackformulier",
  onderhoud: "Onderhoudsmodus (app tijdelijk sluiten)",
};

function Instellingen() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lezenFn = useServerFn(adminInstellingen);
  const zetFn = useServerFn(adminInstellingZetten);
  const { data, isLoading } = useQuery({ queryKey: ["admin-instellingen"], queryFn: () => lezenFn() });
  const [bericht, setBericht] = useState<string | null>(null);

  const zet = useMutation({
    mutationFn: (v: { key: string; value: unknown }) => zetFn({ data: v }),
    onSuccess: () => {
      toast.success("Opgeslagen");
      qc.invalidateQueries({ queryKey: ["admin-instellingen"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rijen = (data ?? []) as { key: string; value: any }[];
  const vlaggen: Record<string, boolean> = Object.fromEntries(
    rijen.filter((r) => r.key.startsWith("flag:")).map((r) => [r.key.slice(5), r.value === true || r.value === "true"]),
  );
  const onderhoudsbericht = (rijen.find((r) => r.key === "onderhoudsbericht")?.value as string) ?? "";
  const getal = (key: string, standaard: number) => {
    const v = rijen.find((r) => r.key === key)?.value;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : standaard;
  };
  const betalenActief = rijen.find((r) => r.key === "betalen_actief")?.value === true;
  const [gratis, setGratis] = useState<string | null>(null);
  const [pakket, setPakket] = useState<string | null>(null);
  const [prijs, setPrijs] = useState<string | null>(null);

  return (
    <AdminShell titel="Instellingen" omschrijving="Functies aan- of uitzetten zonder code">
      {isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Kaart>
            <p className="mb-3 text-sm font-medium">Functies</p>
            <ul className="space-y-3">
              {Object.keys(LABELS)
                .filter((k) => k !== "onderhoud")
                .map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-sm">
                    <span>{LABELS[k]}</span>
                    <Switch
                      aria-label={LABELS[k]}
                      checked={vlaggen[k] !== false}
                      disabled={!mag("settings.manage")}
                      onCheckedChange={(v) => zet.mutate({ key: `flag:${k}`, value: v })}
                    />
                  </li>
                ))}
            </ul>
          </Kaart>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Onderhoud</p>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{LABELS["onderhoud"]}</span>
              <Switch
                aria-label={LABELS["onderhoud"]}
                checked={vlaggen["onderhoud"] === true}
                disabled={!mag("settings.manage")}
                onCheckedChange={(v) => zet.mutate({ key: "flag:onderhoud", value: v })}
              />
            </div>
            <Input
              aria-label="Bericht voor gebruikers tijdens onderhoud"
              className="mt-3 border-white/10 bg-slate-950 text-slate-100"
              placeholder="Bericht voor gebruikers tijdens onderhoud"
              value={bericht ?? onderhoudsbericht}
              onChange={(e) => setBericht(e.target.value)}
              disabled={!mag("settings.manage")}
            />
            <Button
              className="mt-3"
              disabled={!mag("settings.manage")}
              onClick={() => zet.mutate({ key: "onderhoudsbericht", value: bericht ?? "" })}
            >
              Bericht opslaan
            </Button>
          </Kaart>

          <Kaart>
            <p className="mb-1 text-sm font-medium">Betalingen (voorbereiding)</p>
            <p className="mb-3 text-xs text-slate-400">
              Zolang dit uit staat, is alles gratis en onbeperkt.
            </p>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Betalingen actief</span>
              {/* BUG-094: zonder betaalprovider kan niemand een pakket kopen. Aanzetten zou
                  gebruikers boven de limiet blokkeren zonder uitweg. Uitzetten blijft altijd kan. */}
              <Switch
                aria-label="Betalingen actief"
                aria-describedby="betalen-uitleg"
                checked={betalenActief}
                disabled={!mag("settings.manage") || (!betalenActief && !BETAALPROVIDER_GEKOPPELD)}
                onCheckedChange={(v) => zet.mutate({ key: "betalen_actief", value: v })}
              />
            </div>
            {!BETAALPROVIDER_GEKOPPELD ? (
              <p id="betalen-uitleg" className="mt-2 text-xs text-amber-200">
                Kan pas aan als er een betaalprovider gekoppeld is. Anders kunnen gebruikers boven de
                limiet geen recepten meer bewaren en ook geen pakket kopen.
              </p>
            ) : null}
            <label className="mt-4 block text-xs text-slate-400">Gratis gerechten per gebruiker</label>
            <Input
              aria-label="Gratis gerechten per gebruiker"
              type="number"
              min={0}
              className="mt-1 border-white/10 bg-slate-950 text-slate-100"
              value={gratis ?? String(getal("gratis_gerechten", 100))}
              onChange={(e) => setGratis(e.target.value)}
              onBlur={() => {
                if (gratis !== null) zet.mutate({ key: "gratis_gerechten", value: Number(gratis) });
                setGratis(null);
              }}
              disabled={!mag("settings.manage")}
            />
            <label className="mt-3 block text-xs text-slate-400">Gerechten per pakket</label>
            <Input
              aria-label="Gerechten per pakket"
              type="number"
              min={1}
              className="mt-1 border-white/10 bg-slate-950 text-slate-100"
              value={pakket ?? String(getal("pakket_gerechten", 100))}
              onChange={(e) => setPakket(e.target.value)}
              onBlur={() => {
                if (pakket !== null) zet.mutate({ key: "pakket_gerechten", value: Number(pakket) });
                setPakket(null);
              }}
              disabled={!mag("settings.manage")}
            />
            <label className="mt-3 block text-xs text-slate-400">Prijs per pakket (eurocent)</label>
            <Input
              aria-label="Prijs per pakket (eurocent)"
              type="number"
              min={0}
              className="mt-1 border-white/10 bg-slate-950 text-slate-100"
              value={prijs ?? String(getal("pakket_prijs_cent", 499))}
              onChange={(e) => setPrijs(e.target.value)}
              onBlur={() => {
                if (prijs !== null) zet.mutate({ key: "pakket_prijs_cent", value: Number(prijs) });
                setPrijs(null);
              }}
              disabled={!mag("settings.manage")}
            />
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
