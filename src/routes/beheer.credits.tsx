import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminCreditKostZetten, adminCredits } from "@/lib/admin.functions";
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
