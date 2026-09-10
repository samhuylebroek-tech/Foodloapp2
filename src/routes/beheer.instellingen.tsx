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

  return (
    <AdminShell titel="Instellingen" omschrijving="Functies aan- of uitzetten zonder code">
      {isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Kaart>
            <p className="mb-3 text-sm font-medium">Functies</p>
            <ul className="space-y-3">
              {Object.keys(LABELS)
                .filter((k) => k !== "onderhoud")
                .map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-sm">
                    <span>{LABELS[k]}</span>
                    <Switch
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
                checked={vlaggen["onderhoud"] === true}
                disabled={!mag("settings.manage")}
                onCheckedChange={(v) => zet.mutate({ key: "flag:onderhoud", value: v })}
              />
            </div>
            <Input
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
        </div>
      )}
    </AdminShell>
  );
}
