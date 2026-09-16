import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Kruimels, SubNav, euro, labelVan, stip } from "@/components/UserIntelligence";
import { uiGroep } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/groep/$id")({ component: Groep });

function Groep() {
  const { id } = Route.useParams();
  const fn = useServerFn(uiGroep);
  const q = useQuery({ queryKey: ["ui-groep", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data;

  return (
    <AdminShell titel={d?.groep?.naam ?? "Gezin"} omschrijving="Gezinsdetail">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gezinnen", to: "/beheer/ui/groepen" },
          { label: d?.groep?.naam ?? "Gezin" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Dit gezin bestaat niet meer.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Leden" waarde={String(d.leden.length)} />
            <Kpi label="Credits" waarde={String(d.credits)} />
            <Kpi label="Kost (schatting)" waarde={euro(d.kost)} />
            <Kpi label="Gedeelde lijsten" waarde={String(d.lijsten.length)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Kaart>
              <h2 className="mb-2 text-sm font-semibold">Leden</h2>
              <ul className="divide-y divide-white/5 text-sm">
                {d.leden.map((l: any) => (
                  <li key={l.id ?? l.user_id} className="flex items-center justify-between py-2">
                    <Link to="/beheer/ui/gebruiker/$id" params={{ id: l.user_id }} className="text-emerald-300 hover:underline">
                      {l.naam}
                    </Link>
                    <span className="text-xs text-slate-400">
                      {l.rol} · {l.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Kaart>

            <Kaart>
              <h2 className="mb-2 text-sm font-semibold">Recente activiteit in dit gezin</h2>
              <ul className="divide-y divide-white/5 text-sm">
                {d.events.slice(0, 25).map((e: any, n: number) => (
                  <li key={n} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-slate-300">
                      {e.naam} · {labelVan(e.event)}
                    </span>
                    <span className="text-xs text-slate-500">{stip(e.created_at)}</span>
                  </li>
                ))}
                {d.events.length === 0 ? <li className="py-2 text-slate-500">Nog geen activiteit.</li> : null}
              </ul>
            </Kaart>

            <Kaart>
              <h2 className="mb-2 text-sm font-semibold">Gedeelde planning</h2>
              <ul className="divide-y divide-white/5 text-sm">
                {d.planning.slice(0, 20).map((p: any) => (
                  <li key={p.id} className="flex justify-between py-1.5">
                    <span>{p.custom_title ?? "Recept"}</span>
                    <span className="text-xs text-slate-500">
                      {p.plan_date} · {p.meal_type}
                    </span>
                  </li>
                ))}
                {d.planning.length === 0 ? <li className="py-2 text-slate-500">Nog niets ingepland.</li> : null}
              </ul>
            </Kaart>

            <Kaart>
              <h2 className="mb-2 text-sm font-semibold">Gedeelde lijsten</h2>
              <ul className="divide-y divide-white/5 text-sm">
                {d.lijsten.map((l: any) => (
                  <li key={l.id} className="flex justify-between py-1.5">
                    <span>{l.name}</span>
                    <span className="text-xs text-slate-500">{stip(l.created_at)}</span>
                  </li>
                ))}
                {d.lijsten.length === 0 ? <li className="py-2 text-slate-500">Nog geen lijsten.</li> : null}
              </ul>
            </Kaart>
          </div>
        </>
      )}
    </AdminShell>
  );
}
