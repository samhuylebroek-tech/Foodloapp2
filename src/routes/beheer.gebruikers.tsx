import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminBlokkeerGebruiker,
  adminCreditsToekennen,
  adminExportGebruiker,
  adminGebruikerDetail,
  adminGebruikers,
  adminVerwijderGebruiker,
} from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/gebruikers")({ component: Gebruikers });

function Gebruikers() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(adminGebruikers);
  const detailFn = useServerFn(adminGebruikerDetail);
  const blokFn = useServerFn(adminBlokkeerGebruiker);
  const exportFn = useServerFn(adminExportGebruiker);
  const wisFn = useServerFn(adminVerwijderGebruiker);
  const creditFn = useServerFn(adminCreditsToekennen);

  const [zoek, setZoek] = useState("");
  const [pagina, setPagina] = useState(0);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [reden, setReden] = useState("");
  const [bevestig, setBevestig] = useState("");
  const [creditAantal, setCreditAantal] = useState("");
  const [creditReden, setCreditReden] = useState("");

  const lijst = useQuery({
    queryKey: ["admin-gebruikers", zoek, pagina],
    queryFn: () => lijstFn({ data: { zoek, pagina } }),
  });
  const detail = useQuery({
    queryKey: ["admin-gebruiker", gekozen],
    queryFn: () => detailFn({ data: { id: gekozen! } }),
    enabled: Boolean(gekozen),
  });

  const blokkeer = useMutation({
    mutationFn: (blokkeren: boolean) => blokFn({ data: { id: gekozen!, blokkeren, reden } }),
    onSuccess: () => {
      toast.success("Bijgewerkt");
      qc.invalidateQueries({ queryKey: ["admin-gebruiker"] });
      qc.invalidateQueries({ queryKey: ["admin-gebruikers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const creditsAanpassen = useMutation({
    mutationFn: (amount: number) => creditFn({ data: { user_id: gekozen!, amount, reden: creditReden } }),
    onSuccess: () => {
      toast.success("Credits aangepast");
      setCreditAantal("");
      setCreditReden("");
      qc.invalidateQueries({ queryKey: ["admin-gebruiker"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell titel="Gebruikers" omschrijving="Zoek, onderzoek en help gebruikers">
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Kaart>
          <div className="mb-3 flex gap-2">
            <Input
              value={zoek}
              onChange={(e) => {
                setZoek(e.target.value);
                setPagina(0);
              }}
              placeholder="Zoek op naam"
              className="border-white/10 bg-slate-950 text-slate-100"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Naam</th>
                  <th>Lid sinds</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(lijst.data?.rijen ?? []).map((r: any) => (
                  <tr
                    key={r.id}
                    onClick={() => setGekozen(r.id)}
                    className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${
                      gekozen === r.id ? "bg-emerald-500/10" : ""
                    }`}
                  >
                    <td className="py-2">{r.display_name || "(geen naam)"}</td>
                    <td className="text-slate-400">{new Date(r.created_at).toLocaleDateString("nl-BE")}</td>
                    <td>
                      {r.blocked_at ? (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">geblokkeerd</span>
                      ) : (
                        <span className="text-xs text-slate-400">actief</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>{lijst.data?.totaal ?? 0} gebruikers</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                Vorige
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={(pagina + 1) * (lijst.data?.perPagina ?? 25) >= (lijst.data?.totaal ?? 0)}
                onClick={() => setPagina((p) => p + 1)}
              >
                Volgende
              </Button>
            </div>
          </div>
        </Kaart>

        <Kaart>
          {!gekozen ? (
            <p className="text-sm text-slate-400">Kies een gebruiker om details te zien.</p>
          ) : detail.isLoading || !detail.data ? (
            <p className="text-sm text-slate-400">Laden…</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <h2 className="text-base font-semibold">{detail.data.profiel?.display_name || "(geen naam)"}</h2>
                <p className="text-slate-400">{detail.data.email}</p>
                <p className="text-xs text-slate-500">
                  Laatst aangemeld:{" "}
                  {detail.data.laatsteAanmelding
                    ? new Date(detail.data.laatsteAanmelding).toLocaleString("nl-BE")
                    : "nooit"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Vak label="Recepten" waarde={detail.data.recepten.length} />
                <Vak label="Lijsten" waarde={detail.data.lijsten} />
                <Vak label="Planning" waarde={detail.data.planning} />
              </div>

              <div>
                <p className="mb-1 text-xs uppercase text-slate-400">Recepten</p>
                <ul className="max-h-40 space-y-1 overflow-auto text-slate-300">
                  {detail.data.recepten.map((r: any) => (
                    <li key={r.id} className={r.deleted_at ? "text-slate-500 line-through" : ""}>
                      {r.title}
                    </li>
                  ))}
                </ul>
              </div>

              {mag("users.manage") ? (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <Input
                    value={reden}
                    onChange={(e) => setReden(e.target.value)}
                    placeholder="Interne notitie / reden"
                    className="border-white/10 bg-slate-950 text-slate-100"
                  />
                  <Button
                    variant={detail.data.profiel?.blocked_at ? "secondary" : "destructive"}
                    className="w-full"
                    onClick={() => blokkeer.mutate(!detail.data.profiel?.blocked_at)}
                  >
                    {detail.data.profiel?.blocked_at ? "Blokkering opheffen" : "Gebruiker blokkeren"}
                  </Button>
                </div>
              ) : null}

              {mag("privacy.manage") ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    const bundel = await exportFn({ data: { id: gekozen } });
                    const blob = new Blob([JSON.stringify(bundel, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `gegevens-${gekozen}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Gegevensexport gedownload");
                  }}
                >
                  Gegevens exporteren (GDPR)
                </Button>
              ) : null}

              {mag("users.delete") ? (
                <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-xs text-red-300">
                    Account definitief verwijderen. Typ VERWIJDER om te bevestigen.
                  </p>
                  <Input
                    value={bevestig}
                    onChange={(e) => setBevestig(e.target.value)}
                    placeholder="VERWIJDER"
                    className="border-white/10 bg-slate-950 text-slate-100"
                  />
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={bevestig !== "VERWIJDER"}
                    onClick={async () => {
                      try {
                        await wisFn({ data: { id: gekozen, bevestiging: bevestig } });
                        toast.success("Account verwijderd");
                        setGekozen(null);
                        setBevestig("");
                        qc.invalidateQueries({ queryKey: ["admin-gebruikers"] });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Account verwijderen
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </Kaart>
      </div>
    </AdminShell>
  );
}

function Vak({ label, waarde }: { label: string; waarde: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <p className="text-lg font-semibold">{waarde}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
