import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Kruimels, SubNav, klok, labelVan, stip } from "@/components/UserIntelligence";
import { uiGebeurtenis } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/gebeurtenis/$id")({ component: Gebeurtenis });

function Regel({ label, waarde }: { label: string; waarde: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{waarde ?? "niet beschikbaar"}</span>
    </div>
  );
}

function Gebeurtenis() {
  const { id } = Route.useParams();
  const fn = useServerFn(uiGebeurtenis);
  const q = useQuery({ queryKey: ["ui-event", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data;

  return (
    <AdminShell titel="Gebeurtenis" omschrijving="Alle details van deze actie.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gebeurtenissen", to: "/beheer/ui/gebeurtenissen" },
          { label: "Detail" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Deze gebeurtenis bestaat niet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">{labelVan(d.rij.event)}</h2>
            <Regel label="Tijd" waarde={stip(d.rij.created_at)} />
            <Regel
              label="Gebruiker"
              waarde={
                <Link to="/beheer/ui/gebruiker/$id" params={{ id: d.rij.user_id }} className="text-emerald-300 hover:underline">
                  {d.naam}
                </Link>
              }
            />
            <Regel label="Onderdeel" waarde={d.rij.feature} />
            <Regel label="Voorwerp" waarde={d.rij.entity_label ?? d.rij.entity_id} />
            <Regel label="Soort voorwerp" waarde={d.rij.entity_type} />
            <Regel label="Pagina" waarde={d.rij.path} />
            <Regel label="Resultaat" waarde={d.rij.ok === false ? "mislukt" : d.rij.ok === true ? "gelukt" : null} />
            <Regel label="Duur" waarde={d.rij.duration_ms ? `${d.rij.duration_ms} ms` : null} />
            <Regel label="Toestel" waarde={d.rij.device} />
            <Regel label="Platform" waarde={d.rij.platform} />
            <Regel label="Browser" waarde={d.rij.browser} />
            <Regel label="App-versie" waarde={d.rij.app_version} />
            <Regel
              label="Sessie"
              waarde={
                d.rij.session_id ? (
                  <Link to="/beheer/ui/sessie/$id" params={{ id: d.rij.session_id }} className="text-sky-300 hover:underline">
                    bekijk sessie
                  </Link>
                ) : null
              }
            />
            {d.rij.detail && Object.keys(d.rij.detail).length ? (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                {JSON.stringify(d.rij.detail, null, 2)}
              </pre>
            ) : null}
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Wat er rond deze actie gebeurde</h2>
            <ul className="divide-y divide-white/5 text-sm">
              {(d.buren ?? []).map((b: any) => (
                <li key={b.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-20 text-xs text-slate-500">{klok(b.created_at)}</span>
                  <Link
                    to="/beheer/ui/gebeurtenis/$id"
                    params={{ id: b.id }}
                    className={b.id === d.rij.id ? "font-semibold text-emerald-300" : "text-slate-200 hover:underline"}
                  >
                    {labelVan(b.event)}
                  </Link>
                  <span className="text-slate-500">{b.entity_label ?? ""}</span>
                </li>
              ))}
              {(d.buren ?? []).length === 0 ? (
                <li className="py-2 text-slate-500">Geen sessiecontext beschikbaar.</li>
              ) : null}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
