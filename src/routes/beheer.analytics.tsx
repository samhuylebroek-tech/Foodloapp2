import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAnalytics } from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi, PeriodeKiezer, type Periode } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/analytics")({ component: Analytics });

const OMSCHRIJVING: Record<Periode, string> = {
  dag: "laatste 24 uur",
  week: "laatste 7 dagen",
  maand: "laatste 30 dagen",
  jaar: "laatste 12 maanden",
};

function Analytics() {
  const [periode, setPeriode] = useState<Periode>("maand");
  const fn = useServerFn(adminAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", periode],
    queryFn: () => fn({ data: { periode } }),
  });
  const max = Math.max(1, ...(data?.grafiek ?? []).map((g) => g.actieveGebruikers));
  const tijd = OMSCHRIJVING[periode];

  return (
    <AdminShell
      titel="Analytics"
      omschrijving="Hoe wordt de app gebruikt?"
      acties={<PeriodeKiezer waarde={periode} onKies={setPeriode} />}
    >
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label={`Actieve gebruikers (${tijd})`}
              waarde={data.actieveGebruikers}
              evolutie={data.evoluties.actieveGebruikers}
              extra="vergeleken met de vorige periode"
            />
            <Kpi label="Actief (7 dagen)" waarde={data.actieveGebruikers7} />
            <Kpi
              label="Gebruikers totaal"
              waarde={data.gebruikers}
              extra={`${data.makers} maakten al een gerecht`}
            />
            <Kpi
              label="Gemeten handelingen"
              waarde={data.totaalEvents}
              evolutie={data.evoluties.events}
              extra={tijd}
            />
          </div>

          <Kaart>
            <p className="mb-4 text-sm font-medium">Actieve gebruikers · {tijd}</p>
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
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>{data.grafiek[0]?.datum}</span>
              <span>{data.grafiek[data.grafiek.length - 1]?.datum}</span>
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
