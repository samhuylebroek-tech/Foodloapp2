import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminCreditAanvraagAfhandelen,
  adminCreditAanvragen,
  adminCreditKostZetten,
  adminCredits,
} from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/beheer/credits")({ component: CreditsBeheer });

function CreditsBeheer() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lezen = useServerFn(adminCredits);
  const zetten = useServerFn(adminCreditKostZetten);
  const { data, isLoading } = useQuery({ queryKey: ["admin-credits"], queryFn: () => lezen() });

  const zet = useMutation({
    mutationFn: (v: { feature: string; credit_cost?: number; enabled?: boolean; max_per_dag?: number }) =>
      zetten({ data: v }),
    onSuccess: () => {
      toast.success("Opgeslagen");
      qc.invalidateQueries({ queryKey: ["admin-credits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell titel="Credits & AI-kosten" omschrijving="Verbruik, kosten per functie en hergebruik van resultaten">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Saldo alle gebruikers" waarde={data.saldoTotaal} extra={`${data.gebruikers} gebruikers`} />
            <Kpi label="Verbruikt (totaal)" waarde={data.verbruikt} extra={`${data.verbruiktPerGebruiker} per gebruiker`} />
            <Kpi label="AI-verzoeken (30 d)" waarde={data.aiVerzoeken} extra={`${data.teruggestort} teruggestort`} />
            <Kpi label="Uit de cache" waarde={`${data.cachePercentage}%`} extra={`${data.cacheTreffers} keer gratis`} />
          </div>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Kosten per slimme functie</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Functie</th>
                  <th>Credits</th>
                  <th>Max/dag</th>
                  <th>Aan</th>
                  <th>Verbruik 30 d</th>
                </tr>
              </thead>
              <tbody>
                {(data.kosten as any[]).map((k) => {
                  const stat = data.perFunctie.find((p) => p.feature === k.feature);
                  return (
                    <tr key={k.feature} className="border-t border-white/5">
                      <td className="py-2">{k.label || k.feature}</td>
                      <td>
                        <Input
                          type="number"
                          min={0}
                          defaultValue={k.credit_cost}
                          disabled={!mag("settings.manage")}
                          className="h-8 w-20 border-white/10 bg-slate-950 text-slate-100"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n !== k.credit_cost)
                              zet.mutate({ feature: k.feature, credit_cost: n });
                          }}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          min={1}
                          defaultValue={k.max_per_dag}
                          disabled={!mag("settings.manage")}
                          className="h-8 w-20 border-white/10 bg-slate-950 text-slate-100"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n !== k.max_per_dag)
                              zet.mutate({ feature: k.feature, max_per_dag: n });
                          }}
                        />
                      </td>
                      <td>
                        <Switch
                          checked={k.enabled}
                          disabled={!mag("settings.manage")}
                          onCheckedChange={(v) => zet.mutate({ feature: k.feature, enabled: v })}
                        />
                      </td>
                      <td className="text-slate-400">
                        {stat ? `${stat.aantal} × · ${stat.credits} credits · ${stat.cache} uit cache` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Kaart>

          <Aanvragen magBeheren={mag("users.manage")} />

          <Kaart>
            <p className="mb-3 text-sm font-medium">Creditpakketten (verkoop staat uit tot betalingen actief zijn)</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {(data.pakketten as any[]).map((p) => (
                <li key={p.id} className="flex justify-between border-b border-white/5 py-1">
                  <span>
                    {p.naam} · {p.credits + p.bonus} credits
                  </span>
                  <span className="text-slate-400">{(p.prijs_cent / 100).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}

function Aanvragen({ magBeheren }: { magBeheren: boolean }) {
  const qc = useQueryClient();
  const lezen = useServerFn(adminCreditAanvragen);
  const afhandelen = useServerFn(adminCreditAanvraagAfhandelen);
  const { data } = useQuery({ queryKey: ["admin-credit-aanvragen"], queryFn: () => lezen() });
  const [bedrag, setBedrag] = useState<Record<string, number>>({});

  const behandel = useMutation({
    mutationFn: (v: { id: string; toekennen: number; afwijzen: boolean }) => afhandelen({ data: { ...v, note: "" } }),
    onSuccess: () => {
      toast.success("Afgehandeld");
      qc.invalidateQueries({ queryKey: ["admin-credit-aanvragen"] });
      qc.invalidateQueries({ queryKey: ["admin-credits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Kaart>
      <p className="mb-3 text-sm font-medium">
        Vragen om extra credits {data?.open ? `· ${data.open} open` : ""}
      </p>
      {!data || data.aanvragen.length === 0 ? (
        <p className="text-sm text-slate-400">Nog geen vragen.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {data.aanvragen.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.naam}</span>
                <span className="text-xs text-slate-400">
                  saldo {a.saldo} · {new Date(a.created_at).toLocaleDateString("nl-BE")} ·{" "}
                  {a.status === "open" ? "open" : a.status === "toegekend" ? `+${a.toegekend}` : "afgewezen"}
                </span>
              </div>
              {a.bericht ? <p className="mt-1 text-slate-300">{a.bericht}</p> : null}
              {a.status === "open" && magBeheren ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="50"
                    value={bedrag[a.id] ?? 50}
                    onChange={(e) => setBedrag((b) => ({ ...b, [a.id]: Number(e.target.value) }))}
                    className="h-8 w-24 border-white/10 bg-slate-950 text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={behandel.isPending}
                    onClick={() => behandel.mutate({ id: a.id, toekennen: bedrag[a.id] ?? 50, afwijzen: false })}
                    className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Credits geven
                  </button>
                  <button
                    type="button"
                    disabled={behandel.isPending}
                    onClick={() => behandel.mutate({ id: a.id, toekennen: 0, afwijzen: true })}
                    className="h-8 rounded-md border border-white/10 px-3 text-xs font-medium text-slate-300 disabled:opacity-60"
                  >
                    Afwijzen
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Kaart>
  );
}
