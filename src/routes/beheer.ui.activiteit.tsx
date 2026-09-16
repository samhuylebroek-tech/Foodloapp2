import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import {
  Cel,
  FilterBalk,
  Kruimels,
  Paginering,
  Rij,
  SubNav,
  Tabel,
  geleden,
  labelVan,
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiGebeurtenissen } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/activiteit")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Activiteit,
});

function Activiteit() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiGebeurtenissen);
  const q = useQuery({
    queryKey: ["ui-activiteit", zoek],
    queryFn: () => fn({ data: naarFilters(zoek) }),
    refetchInterval: 30_000,
  });
  const live = useQuery({
    queryKey: ["ui-live"],
    queryFn: () => fn({ data: naarFilters({ bereik: "vandaag", pagina: 1 }) as any }),
    refetchInterval: 20_000,
  });
  const d = q.data;

  return (
    <AdminShell titel="Activiteit" omschrijving="Alles wat gebruikers doen, nieuwste eerst. Ververst automatisch.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Activiteit" },
        ]}
      />
      <FilterBalk
        zoek={zoek}
        scherm="activiteit"
        velden={["zoek", "event", "feature", "device"]}
        exportSoort="gebeurtenissen"
      />

      <Kaart className="mb-4">
        <h2 className="mb-2 text-sm font-semibold">Laatste activiteit (live)</h2>
        <ul className="space-y-1 text-sm">
          {((live.data?.rijen ?? []) as any[]).slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-500">{geleden(r.created_at)}</span>
              <Link to="/beheer/ui/gebruiker/$id" params={{ id: r.user_id }} className="text-emerald-300 hover:underline">
                {r.naam}
              </Link>
              <Link to="/beheer/ui/gebeurtenis/$id" params={{ id: r.id }} className="text-slate-200 hover:underline">
                {labelVan(r.event)}
              </Link>
              <span className="text-slate-500">{r.entity_label ?? ""}</span>
            </li>
          ))}
          {!live.isLoading && (live.data?.rijen ?? []).length === 0 ? (
            <li className="text-slate-500">Vandaag nog geen activiteit.</li>
          ) : null}
        </ul>
      </Kaart>

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
              { label: "Actie" },
              { label: "Onderdeel" },
              { label: "Voorwerp" },
              { label: "Toestel" },
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
                <Cel>{r.device ?? "niet beschikbaar"}</Cel>
              </Rij>
            ))}
          </Tabel>
          <Paginering totaal={d.totaal} pagina={d.pagina} perPagina={d.perPagina} />
        </>
      )}
    </AdminShell>
  );
}
