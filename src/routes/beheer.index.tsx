import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminDashboard } from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi, PeriodeKiezer, type Periode } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/")({ component: Dashboard });

const OMSCHRIJVING: Record<Periode, string> = {
  dag: "laatste 24 uur",
  week: "laatste 7 dagen",
  maand: "laatste 30 dagen",
  jaar: "laatste 12 maanden",
};

function Dashboard() {
  const [periode, setPeriode] = useState<Periode>("week");
  const fn = useServerFn(adminDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", periode],
    queryFn: () => fn({ data: { periode } }),
  });

  const max = Math.max(1, ...(data?.grafiek ?? []).map((g) => Math.max(g.aantal, g.gebruikers)));
  const tijd = OMSCHRIJVING[periode];

  return (
    <AdminShell
      titel="Dashboard"
      omschrijving="Overzicht van het platform"
      acties={<PeriodeKiezer waarde={periode} onKies={setPeriode} />}
    >
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Gebruikers"
              waarde={data.gebruikers}
              extra={`+${data.nieuweGebruikers} in ${tijd}`}
              evolutie={data.evoluties.gebruikers}
            />
            <Kpi
              label="Recepten"
              waarde={data.recepten}
              extra={`+${data.nieuweRecepten} in ${tijd}`}
              evolutie={data.evoluties.recepten}
            />
            <Kpi label="Open supportvragen" waarde={data.openTickets} />
            <Kpi
              label={`AI-oproepen (${tijd})`}
              waarde={data.ai.totaal}
              extra={`${data.ai.fouten} fouten · gem. ${data.ai.gemiddeldMs} ms`}
              evolutie={data.evoluties.ai}
            />
            <Kpi
              label="Boodschappenlijsten"
              waarde={data.lijsten}
              extra={`+${data.nieuweLijsten} in ${tijd}`}
              evolutie={data.evoluties.lijsten}
            />
            <Kpi label="Ingeplande maaltijden" waarde={data.planItems} />
            <Kpi label="Actieve vriendschappen" waarde={data.shares} />
            <Kpi label="Verwijderde recepten" waarde={data.verwijderdeRecepten} extra="herstelbaar" />
          </div>

          <Kaart>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Evolutie · {tijd}</p>
              <p className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-emerald-500/70" /> nieuwe recepten
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-sky-400/70" /> nieuwe gebruikers
                </span>
              </p>
            </div>
            <div className="flex h-36 items-end gap-1">
              {data.grafiek.map((g) => (
                <div
                  key={g.datum}
                  className="flex flex-1 items-end gap-0.5"
                  title={`${g.datum}: ${g.aantal} recepten · ${g.gebruikers} gebruikers`}
                >
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(2, (g.aantal / max) * 100)}%` }}
                  />
                  <div
                    className="w-full rounded-t bg-sky-400/70"
                    style={{ height: `${Math.max(2, (g.gebruikers / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>{data.grafiek[0]?.datum}</span>
              <span>{data.grafiek[data.grafiek.length - 1]?.datum}</span>
            </div>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
