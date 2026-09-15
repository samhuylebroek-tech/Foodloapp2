import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminLoyalty, adminLoyaltyWinkel } from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/kaarten")({ component: LoyaltyBeheer });

function LoyaltyBeheer() {
  const fn = useServerFn(adminLoyalty);
  const bewaarFn = useServerFn(adminLoyaltyWinkel);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-loyalty"], queryFn: () => fn() });
  const [nieuw, setNieuw] = useState({ slug: "", naam: "", kleur: "#475569" });

  const bewaar = useMutation({
    mutationFn: (v: any) => bewaarFn({ data: v }),
    onSuccess: () => {
      toast.success("Bewaard");
      qc.invalidateQueries({ queryKey: ["admin-loyalty"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 200)),
  });

  return (
    <AdminShell titel="Klantenkaarten" omschrijving="Winkels, kaarttypes, scanproblemen en gebruik">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Bewaarde kaarten" waarde={data.totaal} />
            <Kpi label="Gebruikers met kaart" waarde={data.gebruikers} />
            <Kpi label="Gedeeld met gezin" waarde={data.gedeeld} />
            <Kpi
              label="Scans (30 d)"
              waarde={data.scans.totaal}
              extra={`${data.scans.mislukt} niet gelukt`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Kaart>
              <p className="mb-3 text-sm font-medium">Ondersteunde winkels</p>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">Winkel</th>
                      <th>Code</th>
                      <th>Volgorde</th>
                      <th>Actief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.winkels.map((w: any) => (
                      <tr key={w.slug} className="border-t border-white/5">
                        <td className="py-2">{w.naam}</td>
                        <td>
                          <select
                            defaultValue={w.standaard_formaat}
                            onChange={(e) =>
                              bewaar.mutate({ ...w, standaard_formaat: e.target.value })
                            }
                            className="rounded border border-white/10 bg-slate-950 px-2 py-1"
                          >
                            {["CODE128", "EAN13", "EAN8", "CODE39", "ITF", "QR"].map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            defaultValue={w.volgorde}
                            onBlur={(e) =>
                              bewaar.mutate({ ...w, volgorde: Number(e.target.value) || 100 })
                            }
                            className="w-20 rounded border border-white/10 bg-slate-950 px-2 py-1"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => bewaar.mutate({ ...w, actief: !w.actief })}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              w.actief
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : "border-white/10 bg-white/5 text-slate-400"
                            }`}
                          >
                            {w.actief ? "Aan" : "Uit"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Input
                  placeholder="slug (bv. spar-express)"
                  value={nieuw.slug}
                  onChange={(e) => setNieuw({ ...nieuw, slug: e.target.value.toLowerCase() })}
                  className="max-w-[180px] border-white/10 bg-slate-950 text-slate-100"
                />
                <Input
                  placeholder="Naam"
                  value={nieuw.naam}
                  onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })}
                  className="max-w-[180px] border-white/10 bg-slate-950 text-slate-100"
                />
                <input
                  type="color"
                  value={nieuw.kleur}
                  onChange={(e) => setNieuw({ ...nieuw, kleur: e.target.value })}
                  className="h-10 w-12 rounded bg-slate-950"
                />
                <Button
                  onClick={() => {
                    bewaar.mutate({ ...nieuw, standaard_formaat: "CODE128", actief: true, volgorde: 100 });
                    setNieuw({ slug: "", naam: "", kleur: "#475569" });
                  }}
                >
                  Winkel toevoegen
                </Button>
              </div>
            </Kaart>

            <Kaart>
              <p className="mb-3 text-sm font-medium">Gebruik per winkel en soort code</p>
              <ul className="space-y-1 text-sm">
                {data.perWinkel.map((p: any) => (
                  <li key={p.winkel} className="flex justify-between border-b border-white/5 py-1">
                    <span>{p.winkel}</span>
                    <span className="text-slate-400">{p.aantal}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 mb-2 text-sm font-medium">Soorten code</p>
              <ul className="space-y-1 text-sm">
                {data.perFormaat.map((p: any) => (
                  <li key={p.formaat} className="flex justify-between border-b border-white/5 py-1">
                    <span>{p.formaat}</span>
                    <span className="text-slate-400">{p.aantal}</span>
                  </li>
                ))}
              </ul>
            </Kaart>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Kaart>
              <p className="mb-3 text-sm font-medium">Scanproblemen</p>
              {data.scans.recent.length === 0 ? (
                <p className="text-sm text-slate-400">Nog geen scans geregistreerd.</p>
              ) : (
                <ul className="max-h-80 space-y-1 overflow-auto text-xs">
                  {data.scans.recent.map((s: any) => (
                    <li key={s.id} className="flex justify-between border-b border-white/5 py-1">
                      <span className={s.ok ? "text-emerald-300" : "text-red-300"}>
                        {s.ok ? "gelukt" : "afgebroken"} · {s.methode} · {s.formaat ?? "—"}
                      </span>
                      <span className="text-slate-500">{new Date(s.created_at).toLocaleString("nl-BE")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Kaart>

            <Kaart>
              <p className="mb-3 text-sm font-medium">Laatste kaarten (nummer afgeschermd)</p>
              <ul className="max-h-80 space-y-1 overflow-auto text-xs">
                {data.recent.map((k: any) => (
                  <li key={k.id} className="flex justify-between border-b border-white/5 py-1">
                    <span>
                      {k.winkel} · {k.gemaskeerd} · {k.formaat}
                      {k.gedeeld ? " · gedeeld" : ""}
                    </span>
                    <span className="text-slate-500">{new Date(k.created_at).toLocaleDateString("nl-BE")}</span>
                  </li>
                ))}
              </ul>
            </Kaart>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
