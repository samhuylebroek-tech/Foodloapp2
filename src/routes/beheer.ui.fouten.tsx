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
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiFouten } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/fouten")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Fouten,
});

function Fouten() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiFouten);
  const q = useQuery({ queryKey: ["ui-fouten", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell titel="Fouten" omschrijving="Elke fout is terug te voeren op een gebruiker, sessie en app-versie.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Fouten" },
        ]}
      />
      <FilterBalk zoek={zoek} scherm="fouten" velden={["zoek", "feature"]} exportSoort="fouten" />

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
              { label: "Soort" },
              { label: "Onderdeel" },
              { label: "Bericht" },
              { label: "Pagina" },
              { label: "Versie" },
              { label: "Sessie" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij key={r.id} onClick={() => navigate({ to: "/beheer/ui/fout/$id", params: { id: r.id } } as any)}>
                <Cel>{stip(r.created_at)}</Cel>
                <Cel>
                  {r.user_id ? (
                    <Link
                      to="/beheer/ui/gebruiker/$id"
                      params={{ id: r.user_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-300 hover:underline"
                    >
                      {r.naam}
                    </Link>
                  ) : (
                    "onbekend"
                  )}
                </Cel>
                <Cel>{r.soort}</Cel>
                <Cel>{r.feature}</Cel>
                <Cel className="max-w-[420px] truncate whitespace-normal">{r.bericht}</Cel>
                <Cel>{r.path ?? "—"}</Cel>
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
