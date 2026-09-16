import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import {
  Cel,
  FilterBalk,
  Kruimels,
  Paginering,
  Rij,
  SubNav,
  Tabel,
  labelVan,
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiGebeurtenissen } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/gebeurtenissen")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Gebeurtenissen,
});

function Gebeurtenissen() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiGebeurtenissen);
  const q = useQuery({ queryKey: ["ui-events", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell titel="Gebeurtenissen" omschrijving="Elke actie in de app, met gebruiker, sessie en toestel.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gebeurtenissen" },
        ]}
      />
      <FilterBalk
        zoek={zoek}
        scherm="gebeurtenissen"
        velden={["zoek", "event", "feature", "device", "resultaat"]}
        exportSoort="gebeurtenissen"
      />

      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Geen gegevens beschikbaar.</p>
      ) : (
        <>
          <Tabel
            kolommen={[
              { label: "Tijd" },
              { label: "Gebruiker" },
              { label: "Gebeurtenis" },
              { label: "Onderdeel" },
              { label: "Voorwerp" },
              { label: "Resultaat" },
              { label: "Toestel" },
              { label: "Versie" },
              { label: "Sessie" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij key={r.id} onClick={() => navigate({ to: "/beheer/ui/gebeurtenis/$id", params: { id: r.id } } as any)}>
                <Cel>{stip(r.created_at)}</Cel>
                <Cel>
                  <Link
                    to="/beheer/ui/gebruiker/$id"
                    params={{ id: r.user_id }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-300 hover:underline"
                  >
                    {r.naam}
                  </Link>
                </Cel>
                <Cel>{labelVan(r.event)}</Cel>
                <Cel>{r.feature ?? "—"}</Cel>
                <Cel>{r.entity_label ?? r.path ?? "—"}</Cel>
                <Cel className={r.ok === false ? "text-red-300" : ""}>
                  {r.ok === false ? "mislukt" : r.ok === true ? "gelukt" : "—"}
                </Cel>
                <Cel>{r.device ?? "niet beschikbaar"}</Cel>
                <Cel>{r.app_version ?? "—"}</Cel>
                <Cel>
                  {r.session_id ? (
                    <Link
                      to="/beheer/ui/sessie/$id"
                      params={{ id: r.session_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sky-300 hover:underline"
                    >
                      bekijk
                    </Link>
                  ) : (
                    "—"
                  )}
                </Cel>
              </Rij>
            ))}
          </Tabel>
          <Paginering totaal={d.totaal} pagina={d.pagina} perPagina={d.perPagina} />
        </>
      )}
    </AdminShell>
  );
}
