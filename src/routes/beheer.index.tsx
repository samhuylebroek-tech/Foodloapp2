import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminDashboard } from "@/lib/admin.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(adminDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });

  const max = Math.max(1, ...(data?.grafiek ?? []).map((g) => g.aantal));

  return (
    <AdminShell titel="Dashboard" omschrijving="Overzicht van het platform">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Gebruikers" waarde={data.gebruikers} extra={`+${data.nieuweGebruikers} deze week`} />
            <Kpi label="Recepten" waarde={data.recepten} extra={`+${data.nieuweRecepten} deze week`} />
            <Kpi label="Open supportvragen" waarde={data.openTickets} />
            <Kpi
              label="AI-oproepen (7 d)"
              waarde={data.ai.totaal}
              extra={`${data.ai.fouten} fouten · gem. ${data.ai.gemiddeldMs} ms`}
            />
            <Kpi label="Boodschappenlijsten" waarde={data.lijsten} />
            <Kpi label="Ingeplande maaltijden" waarde={data.planItems} />
            <Kpi label="Actieve vriendschappen" waarde={data.shares} />
            <Kpi label="Verwijderde recepten" waarde={data.verwijderdeRecepten} extra="herstelbaar" />
          </div>

          <Kaart>
            <p className="mb-4 text-sm font-medium">Nieuwe recepten, laatste 30 dagen</p>
            <div className="flex h-32 items-end gap-1">
              {data.grafiek.map((g) => (
                <div key={g.datum} className="group flex-1" title={`${g.datum}: ${g.aantal}`}>
                  <div
                    className="w-full rounded-t bg-emerald-500/70 transition group-hover:bg-emerald-400"
                    style={{ height: `${Math.max(2, (g.aantal / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
