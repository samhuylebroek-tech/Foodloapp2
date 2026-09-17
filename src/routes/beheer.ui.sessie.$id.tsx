import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Kruimels, SubNav, duurTekst, euro, klok, labelVan, stip } from "@/components/UserIntelligence";
import { uiSessie } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/sessie/$id")({ component: Sessie });

function Sessie() {
  const { id } = Route.useParams();
  const fn = useServerFn(uiSessie);
  const q = useQuery({ queryKey: ["ui-sessie", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data;

  const tijdlijn = d
    ? [
        ...d.events.map((e: any) => ({ soort: "event", id: e.id, tijd: e.created_at, titel: labelVan(e.event), label: e.entity_label ?? e.path })),
        ...d.fouten.map((f: any) => ({ soort: "fout", id: f.id, tijd: f.created_at, titel: `Fout · ${f.feature}`, label: f.bericht })),
        ...d.ai.map((a: any) => ({ soort: "ai", id: a.id, tijd: a.created_at, titel: `AI · ${a.feature}`, label: `${a.model} · ${a.credits} credits` })),
      ].sort((a, b) => (a.tijd < b.tijd ? -1 : 1))
    : [];

  return (
    <AdminShell titel="Sessie" omschrijving="Minuut per minuut wat er tijdens deze login gebeurde.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Sessies", to: "/beheer/ui/sessies" },
          { label: "Sessiedetail" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Deze sessie bestaat niet.</p>
      ) : (
        <>
          <Kaart className="mb-4">
            <p className="text-sm text-slate-300">
              <Link to="/beheer/ui/gebruiker/$id" params={{ id: d.sessie.user_id }} className="text-emerald-300 hover:underline">
                {d.sessie.naam}
              </Link>{" "}
              · start {stip(d.sessie.started_at)} ·{" "}
              {d.sessie.ended_at ? `einde ${stip(d.sessie.ended_at)}${d.sessie.einde_geschat ? " (geschat)" : ""}` : "nog bezig"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {d.sessie.device ?? "toestel onbekend"} · {d.sessie.platform ?? "—"} · {d.sessie.browser ?? "—"} · app v
              {d.sessie.app_version ?? "—"} · {d.sessie.taal ?? "—"} · {d.sessie.tijdzone ?? "—"}
            </p>
          </Kaart>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Duur" waarde={duurTekst(d.sessie.duur)} />
            <Kpi label="Acties" waarde={String(d.events.length)} />
            <Kpi label="Fouten" waarde={String(d.fouten.length)} />
            <Kpi label="AI-kost (schatting)" waarde={euro(d.kost)} extra={`${d.credits} credits`} />
          </div>

          <Kaart className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">Tijdlijn van deze sessie</h2>
            <ul className="divide-y divide-white/5 text-sm">
              {tijdlijn.map((t: any) => (
                <li key={`${t.soort}-${t.id}`} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-20 shrink-0 text-xs text-slate-500">{klok(t.tijd)}</span>
                  <Link
                    to={
                      t.soort === "event"
                        ? "/beheer/ui/gebeurtenis/$id"
                        : t.soort === "ai"
                          ? "/beheer/ui/ai-actie/$id"
                          : "/beheer/ui/fout/$id"
                    }
                    params={{ id: t.id }}
                    className={t.soort === "fout" ? "text-red-300 hover:underline" : "text-slate-100 hover:underline"}
                  >
                    {t.titel}
                  </Link>
                  <span className="text-slate-500">{t.label ?? ""}</span>
                </li>
              ))}
              {tijdlijn.length === 0 ? <li className="py-3 text-slate-500">Geen acties in deze sessie.</li> : null}
            </ul>
          </Kaart>
        </>
      )}
    </AdminShell>
  );
}
