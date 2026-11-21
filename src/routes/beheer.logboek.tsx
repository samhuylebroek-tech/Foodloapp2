import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAudit } from "@/lib/admin.functions";
import { auditOmschrijving, rolNaam } from "@/lib/bcc";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/logboek")({ component: Logboek });

function Logboek() {
  const fn = useServerFn(adminAudit);
  const [zoek, setZoek] = useState("");
  const [pagina, setPagina] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", zoek, pagina],
    queryFn: () => fn({ data: { zoek, pagina } }),
  });

  return (
    <AdminShell
      titel="Auditlogboek"
      omschrijving="Elke beheeractie wordt onwijzigbaar bewaard: wie, wat en wanneer. Alleen lezen."
    >
      <Kaart>
        <Input
          value={zoek}
          onChange={(e) => {
            setZoek(e.target.value);
            setPagina(0);
          }}
          placeholder="Zoek op actie of onderdeel"
          className="mb-3 max-w-xs border-white/10 bg-slate-950 text-slate-100"
        />
        {isLoading ? (
          <p className="text-slate-400">Laden…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Wanneer</th>
                  <th>Wie</th>
                  <th>Rol</th>
                  <th>Actie</th>
                  <th>Onderdeel</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rijen ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t border-white/5 align-top">
                    <td className="py-2 whitespace-nowrap text-slate-400">
                      {new Date(r.created_at).toLocaleString("nl-BE")}
                    </td>
                    {/* BUG-182: de server geeft `naam` en `entity_type`; die bleven leeg. */}
                    <td>{r.naam ?? r.actor_naam}</td>
                    <td className="text-slate-400">{rolNaam(r.actor_role)}</td>
                    <td>
                      <span className="block">{auditOmschrijving(String(r.action))}</span>
                      <span className="block text-xs text-slate-500">{r.action}</span>
                    </td>
                    <td className="text-slate-400">
                      {r.entity_type ?? r.entity}
                      {r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}
                    </td>
                    <td className="max-w-[280px] truncate text-xs text-slate-500">
                      {r.details ? JSON.stringify(r.details) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{data?.totaal ?? 0} regels</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Vorige
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={(pagina + 1) * (data?.perPagina ?? 50) >= (data?.totaal ?? 0)}
              onClick={() => setPagina((p) => p + 1)}
            >
              Volgende
            </Button>
          </div>
        </div>
      </Kaart>
    </AdminShell>
  );
}
