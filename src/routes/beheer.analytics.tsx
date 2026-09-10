import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAnalytics } from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/analytics")({ component: Analytics });

function Analytics() {
  const fn = useServerFn(adminAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fn() });
  const max = Math.max(1, ...(data?.grafiek ?? []).map((g) => g.actieveGebruikers));

  return (
    <AdminShell titel="Analytics" omschrijving="Hoe wordt de app gebruikt?">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Actief (7 dagen)" waarde={data.actieveGebruikers7} />
            <Kpi label="Actief (30 dagen)" waarde={data.actieveGebruikers30} />
            <Kpi
              label="Gebruikers totaal"
              waarde={data.gebruikers}
              extra={`${data.makers} maakten al een gerecht`}
            />
            <Kpi label="Gemeten handelingen" waarde={data.totaalEvents} extra="laatste 30 dagen" />
          </div>

          <Kaart>
            <p className="mb-4 text-sm font-medium">Actieve gebruikers per dag</p>
            <div className="flex h-32 items-end gap-1">
              {data.grafiek.map((g) => (
                <div key={g.datum} className="flex-1" title={`${g.datum}: ${g.actieveGebruikers}`}>
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(2, (g.actieveGebruikers / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </Kaart>

          <div className="grid gap-4 lg:grid-cols-2">
            <Kaart>
              <p className="mb-3 text-sm font-medium">Meest gebruikte functies</p>
              <Lijst items={data.topEvents} />
            </Kaart>
            <Kaart>
              <p className="mb-3 text-sm font-medium">Meest bekeken schermen</p>
              <Lijst items={data.topPaginas} />
            </Kaart>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Lijst({ items }: { items: { naam: string; aantal: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Nog geen gegevens.</p>;
  const max = Math.max(...items.map((i) => i.aantal));
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.naam}>
          <div className="flex justify-between">
            <span className="truncate">{i.naam}</span>
            <span className="text-slate-400">{i.aantal}</span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-white/10">
            <div className="h-full rounded bg-emerald-500/70" style={{ width: `${(i.aantal / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
