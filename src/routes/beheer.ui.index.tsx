import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import {
  FilterBalk,
  KlikKpi,
  Kruimels,
  SubNav,
  euro,
  naarFilters,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiOverzicht } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Overzicht,
});

/** Waar leidt een KPI naartoe? Elke kaart is een echte doorklik. */
function bestemming(doel: string, bereik: string): { to: string; search: any } {
  const [pagina, waarde] = doel.split(":");
  const basis = { bereik, pagina: 1 } as any;
  if (pagina === "gebruikers") return { to: "/beheer/ui/gebruikers", search: { ...basis, status: waarde ?? "alles" } };
  if (pagina === "sessies") return { to: "/beheer/ui/sessies", search: basis };
  if (pagina === "gebeurtenissen")
    return { to: "/beheer/ui/gebeurtenissen", search: waarde ? { ...basis, event: waarde } : basis };
  if (pagina === "ai") return { to: "/beheer/ui/ai", search: basis };
  if (pagina === "fouten") return { to: "/beheer/ui/fouten", search: basis };
  return { to: "/beheer/ui/gebruikers", search: basis };
}

function Overzicht() {
  const zoek = Route.useSearch();
  const fn = useServerFn(uiOverzicht);
  const q = useQuery({
    queryKey: ["ui-overzicht", zoek],
    queryFn: () => fn({ data: naarFilters(zoek) }),
  });

  const d = q.data;
  const maxDag = Math.max(1, ...(d?.dagen ?? []).map((x: any) => x.events));
  const maxUur = Math.max(1, ...(d?.uren ?? []).map((x: any) => x.events));

  return (
    <AdminShell titel="User Intelligence" omschrijving="Wie gebruikt Foodlo, wanneer en met welk resultaat?">
      <SubNav />
      <Kruimels items={[{ label: "Control Center", to: "/beheer" }, { label: "User Intelligence" }]} />
      <FilterBalk zoek={zoek} scherm="overzicht" exportSoort="gebruikers" />

      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Geen gegevens beschikbaar.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {d.kpis.map((k: any) => {
              const b = bestemming(k.doel, zoek.bereik);
              const waarde =
                k.waarde === null
                  ? "niet beschikbaar"
                  : k.sleutel === "kost"
                    ? euro(k.waarde)
                    : k.sleutel === "duur"
                      ? `${Math.round(k.waarde / 60)} min`
                      : k.waarde.toLocaleString("nl-BE");
              return (
                <KlikKpi key={k.sleutel} label={k.label} waarde={waarde} extra={k.extra} to={b.to} search={b.search} />
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Kaart>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Per dag</h2>
                <span className="text-xs text-slate-500">
                  filteren: tik een dag in het dagoverzicht
                </span>
              </div>
              {/* Alleen beeld: 30 balken zijn op een telefoon te smal om te tikken (< 24 px).
                  Het dagoverzicht hieronder heeft per dag een tikbare link en de cijfers. */}
              <div
                className="flex h-40 items-end gap-1"
                role="img"
                aria-label="Gebeurtenissen per dag; de cijfers staan in het dagoverzicht"
              >
                {d.dagen.map((dag: any) => (
                  <span
                    key={dag.dag}
                    title={`${dag.dag}: ${dag.events} gebeurtenissen, ${dag.gebruikers} gebruikers`}
                    className="group flex h-full flex-1 items-end"
                  >
                    <span
                      className="block w-full rounded-t bg-emerald-500/50 group-hover:bg-emerald-400"
                      style={{ height: `${Math.max(3, (dag.events / maxDag) * 100)}%` }}
                    />
                  </span>
                ))}
              </div>
            </Kaart>

            <Kaart>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Per uur</h2>
                <Link
                  to="/beheer/ui/gebeurtenissen"
                  search={{ ...zoek, pagina: 1 } as any}
                  className="text-xs text-emerald-300 underline underline-offset-2"
                >
                  Alle gebeurtenissen
                </Link>
              </div>
              {/* Alleen beeld (24 smalle balken); de link "Alle gebeurtenissen" deed hetzelfde als elke balk. */}
              <div
                className="flex h-40 items-end gap-1"
                role="img"
                aria-label="Gebeurtenissen per uur van de dag"
              >
                {d.uren.map((u: any) => (
                  <span
                    key={u.uur}
                    title={`${String(u.uur).padStart(2, "0")}:00 — ${u.events} gebeurtenissen`}
                    className="group flex h-full flex-1 items-end"
                  >
                    <span
                      className="block w-full rounded-t bg-sky-500/50 group-hover:bg-sky-400"
                      style={{ height: `${Math.max(3, (u.events / maxUur) * 100)}%` }}
                    />
                  </span>
                ))}
              </div>
            </Kaart>
          </div>

          <Kaart className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">Dagoverzicht</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    {["Dag", "Gebruikers", "Sessies", "Gebeurtenissen", "AI", "Credits", "Kost", "Fouten"].map((k) => (
                      <th key={k} className="px-3 py-2">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...d.dagen].reverse().map((dag: any) => (
                    <tr key={dag.dag} className="hover:bg-white/5">
                      <td className="px-3 py-2">
                        <Link
                          to="/beheer/ui/activiteit"
                          search={{ bereik: "eigen", van: dag.dag, tot: dag.dag, pagina: 1 } as any}
                          className="inline-flex min-h-11 items-center text-emerald-300 underline underline-offset-2"
                        >
                          {dag.dag}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{dag.gebruikers}</td>
                      <td className="px-3 py-2">{dag.sessies}</td>
                      <td className="px-3 py-2">{dag.events}</td>
                      <td className="px-3 py-2">{dag.ai}</td>
                      <td className="px-3 py-2">{dag.credits}</td>
                      <td className="px-3 py-2">{euro(dag.kost)}</td>
                      <td className="px-3 py-2">{dag.fouten}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kaart>
        </>
      )}
    </AdminShell>
  );
}
