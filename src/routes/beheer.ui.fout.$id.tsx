import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Kruimels, SubNav, klok, labelVan, stip } from "@/components/UserIntelligence";
import { uiFoutDetail } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/fout/$id")({ component: Fout });

function Regel({ label, waarde }: { label: string; waarde: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-slate-200">{waarde ?? "niet beschikbaar"}</span>
    </div>
  );
}

function Fout() {
  const { id } = Route.useParams();
  const fn = useServerFn(uiFoutDetail);
  const q = useQuery({ queryKey: ["ui-fout", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data;

  return (
    <AdminShell titel="Fout" omschrijving="Wie kreeg deze fout, in welke sessie en op welke app-versie?">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Fouten", to: "/beheer/ui/fouten" },
          { label: "Detail" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Deze fout bestaat niet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Kaart>
            <h2 className="mb-2 text-sm font-semibold text-red-300">{d.rij.bericht}</h2>
            <Regel label="Tijd" waarde={stip(d.rij.created_at)} />
            <Regel
              label="Gebruiker"
              waarde={
                d.rij.user_id ? (
                  <Link to="/beheer/ui/gebruiker/$id" params={{ id: d.rij.user_id }} className="text-emerald-300 hover:underline">
                    {d.naam}
                  </Link>
                ) : (
                  "niet aangemeld"
                )
              }
            />
            <Regel label="Soort" waarde={d.rij.soort} />
            <Regel label="Onderdeel" waarde={d.rij.feature} />
            <Regel label="Pagina" waarde={d.rij.path} />
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
            {d.rij.detail ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{d.rij.detail}</pre>
            ) : null}
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Wat de gebruiker deed in dezelfde sessie</h2>
            <ul className="divide-y divide-white/5 text-sm">
              {d.rondom.map((e: any) => (
                <li key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-20 text-xs text-slate-500">{klok(e.created_at)}</span>
                  <Link to="/beheer/ui/gebeurtenis/$id" params={{ id: e.id }} className="text-slate-200 hover:underline">
                    {labelVan(e.event)}
                  </Link>
                  <span className="text-slate-500">{e.entity_label ?? ""}</span>
                </li>
              ))}
              {d.rondom.length === 0 ? <li className="py-2 text-slate-500">Geen sessiecontext beschikbaar.</li> : null}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
