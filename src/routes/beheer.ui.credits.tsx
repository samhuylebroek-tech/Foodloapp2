import { createFileRoute, Link } from "@tanstack/react-router";
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
import { uiCredits } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/credits")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Credits,
});

function Credits() {
  const zoek = Route.useSearch();
  const fn = useServerFn(uiCredits);
  const q = useQuery({ queryKey: ["ui-credits", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell titel="Credits" omschrijving="Elke creditbeweging met saldo voor en na.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Credits" },
        ]}
      />
      <FilterBalk zoek={zoek} scherm="credits" velden={["feature"]} exportSoort="credits" />

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
              { label: "Aantal" },
              { label: "Saldo voor" },
              { label: "Saldo na" },
              { label: "Status" },
              { label: "Referentie" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij key={r.id}>
                <Cel>{stip(r.created_at)}</Cel>
                <Cel>
                  <Link to="/beheer/ui/gebruiker/$id" params={{ id: r.user_id }} className="text-emerald-300 hover:underline">
                    {r.naam}
                  </Link>
                </Cel>
                <Cel>{r.type}</Cel>
                <Cel>
                  {r.feature ? (
                    <Link
                      to="/beheer/ui/ai"
                      search={{ ...zoek, feature: r.feature, user: r.user_id, pagina: 1 } as any}
                      className="text-sky-300 hover:underline"
                    >
                      {r.feature}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Cel>
                <Cel className={r.amount < 0 ? "text-amber-300" : "text-emerald-300"}>{r.amount}</Cel>
                <Cel>{r.balance_before}</Cel>
                <Cel>{r.balance_after}</Cel>
                <Cel>{r.status}</Cel>
                <Cel>{r.reference_id ?? "—"}</Cel>
              </Rij>
            ))}
          </Tabel>
          <Paginering totaal={d.totaal} pagina={d.pagina} perPagina={d.perPagina} />
        </>
      )}
    </AdminShell>
  );
}
