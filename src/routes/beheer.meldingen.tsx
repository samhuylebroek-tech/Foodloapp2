import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import {
  bewaarMeldingStandaard,
  meldingStatistieken,
  type MeldingStats,
} from "@/lib/meldingen-admin.functions";

export const Route = createFileRoute("/beheer/meldingen")({ component: BeheerMeldingen });

const LABELS: Record<string, string> = {
  daily_menu: "Menu van vandaag",
  weekly: "Weekmenu plannen",
  meal: "Maaltijdherinnering",
  shopping: "Boodschappen",
  cooking: "Tijd om te koken",
};

function BeheerMeldingen() {
  const fn = useServerFn(meldingStatistieken);
  const bewaar = useServerFn(bewaarMeldingStandaard);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<MeldingStats>({
    queryKey: ["admin-meldingen"],
    queryFn: () => fn() as Promise<MeldingStats>,
  });

  return (
    <AdminShell titel="Meldingen" omschrijving="Bereik, aflevering en standaardinstellingen">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Gebruikers met meldingen"
              waarde={data.gebruikersMetToestel}
              extra={`van ${data.gebruikersTotaal} · ${data.optInPercentage}% opt-in`}
            />
            <Kpi label="Verstuurd (30 d)" waarde={data.verstuurd} extra={`${data.afleverPercentage}% afgeleverd`} />
            <Kpi label="Mislukt (30 d)" waarde={data.mislukt} />
            <Kpi label="Aangetikt" waarde={data.aangetikt} extra={`${data.engagementPercentage}% engagement`} />
          </div>

          <Kaart>
            <p className="mb-4 text-sm font-medium">Per soort, laatste 30 dagen</p>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Soort</th>
                  <th>Aan bij gebruikers</th>
                  <th>Verstuurd</th>
                  <th>Aangetikt</th>
                  <th>Mislukt</th>
                </tr>
              </thead>
              <tbody>
                {data.aanPerSoort.map((a) => {
                  const s = data.perSoort.find((x) => x.soort === a.soort);
                  return (
                    <tr key={a.soort} className="border-t border-white/5">
                      <td className="py-2">{LABELS[a.soort] ?? a.soort}</td>
                      <td>{a.aantal}</td>
                      <td>{s?.verstuurd ?? 0}</td>
                      <td>{s?.aangetikt ?? 0}</td>
                      <td>{s?.mislukt ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Kaart>

          <Kaart>
            <p className="mb-4 text-sm font-medium">Standaardinstellingen voor nieuwe gebruikers</p>
            <div className="space-y-3">
              {data.standaarden.map((s) => (
                <div key={s.key} className="flex flex-wrap items-center gap-3">
                  <span className="w-48 text-sm">{LABELS[s.key] ?? s.key}</span>
                  <input
                    defaultValue={s.value}
                    aria-label={`Standaard voor ${LABELS[s.key] ?? s.key}`}
                    onBlur={async (e) => {
                      try {
                        JSON.parse(e.target.value);
                        await bewaar({ data: { key: s.key, value: e.target.value } });
                        await qc.invalidateQueries({ queryKey: ["admin-meldingen"] });
                        toast.success("Bewaard");
                      } catch {
                        toast.error("Ongeldige waarde");
                      }
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs"
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
