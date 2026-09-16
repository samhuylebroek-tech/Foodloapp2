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
  duurTekst,
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiSessies } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/sessies")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Sessies,
});

function Sessies() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiSessies);
  const q = useQuery({ queryKey: ["ui-sessies", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell titel="Sessies" omschrijving="Elke login, met duur en wat er tijdens die sessie gebeurde.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Sessies" },
        ]}
      />
      <FilterBalk zoek={zoek} scherm="sessies" velden={["device"]} exportSoort="sessies" />

      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Geen gegevens beschikbaar.</p>
      ) : (
        <>
          <Tabel
            kolommen={[
              { label: "Start" },
              { label: "Gebruiker" },
              { label: "Duur" },
              { label: "Acties" },
              { label: "Fouten" },
              { label: "Toestel" },
              { label: "Platform" },
              { label: "Browser" },
              { label: "Versie" },
              { label: "Einde" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij key={r.id} onClick={() => navigate({ to: "/beheer/ui/sessie/$id", params: { id: r.id } } as any)}>
                <Cel>{stip(r.started_at)}</Cel>
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
                <Cel>{duurTekst(r.duur)}</Cel>
                <Cel>{r.events}</Cel>
                <Cel className={r.fouten ? "text-red-300" : ""}>{r.fouten}</Cel>
                <Cel>{r.device ?? "niet beschikbaar"}</Cel>
                <Cel>{r.platform ?? "—"}</Cel>
                <Cel>{r.browser ?? "—"}</Cel>
                <Cel>{r.app_version ?? "—"}</Cel>
                <Cel>
                  {r.ended_at ? `${stip(r.ended_at)}${r.einde_geschat ? " (geschat)" : ""}` : "nog bezig"}
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
