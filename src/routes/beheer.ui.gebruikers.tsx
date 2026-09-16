import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  euro,
  geleden,
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiGebruikers } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/gebruikers")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Gebruikers,
});

const KLEUR: Record<string, string> = {
  nieuw: "bg-sky-500/15 text-sky-300",
  actief: "bg-emerald-500/15 text-emerald-300",
  weinig: "bg-amber-500/15 text-amber-300",
  inactief: "bg-slate-500/15 text-slate-300",
  nooit: "bg-red-500/15 text-red-300",
};

function Gebruikers() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiGebruikers);
  const q = useQuery({ queryKey: ["ui-gebruikers", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell titel="Gebruikers" omschrijving="Elke rij opent het volledige gebruikersprofiel.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gebruikers" },
        ]}
      />
      <FilterBalk zoek={zoek} scherm="gebruikers" velden={["zoek", "status", "device"]} exportSoort="gebruikers" />

      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Geen gegevens beschikbaar.</p>
      ) : (
        <>
          <Tabel
            sorteerbaar
            zoek={zoek}
            kolommen={[
              { sleutel: "naam", label: "Gebruiker" },
              { sleutel: "status", label: "Status" },
              { sleutel: "laatsteLogin", label: "Laatste login" },
              { sleutel: "laatsteActiviteit", label: "Laatst actief" },
              { sleutel: "sessies", label: "Sessies" },
              { sleutel: "actieveDagen", label: "Actieve dagen" },
              { sleutel: "events", label: "Acties" },
              { sleutel: "recepten", label: "Recepten" },
              { sleutel: "ai", label: "AI" },
              { sleutel: "credits", label: "Credits" },
              { sleutel: "kost", label: "Kost (schatting)" },
              { sleutel: "fouten", label: "Fouten" },
              { sleutel: "aangemaakt", label: "Aangemeld" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij
                key={r.id}
                onClick={() => navigate({ to: "/beheer/ui/gebruiker/$id", params: { id: r.id } } as any)}
              >
                <Cel>
                  <span className="font-medium text-slate-100">{r.naam}</span>
                  {r.handle ? <span className="ml-1 text-xs text-slate-500">@{r.handle}</span> : null}
                  {r.geblokkeerd ? <span className="ml-2 text-xs text-red-300">geblokkeerd</span> : null}
                </Cel>
                <Cel>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${KLEUR[r.status] ?? ""}`}>{r.status}</span>
                </Cel>
                <Cel>{geleden(r.laatsteLogin)}</Cel>
                <Cel>{geleden(r.laatsteActiviteit)}</Cel>
                <Cel>{r.sessies}</Cel>
                <Cel>{r.actieveDagen}</Cel>
                <Cel>{r.events}</Cel>
                <Cel>{r.recepten}</Cel>
                <Cel>{r.ai}</Cel>
                <Cel>{r.credits}</Cel>
                <Cel>{euro(r.kost)}</Cel>
                <Cel className={r.fouten ? "text-red-300" : ""}>{r.fouten}</Cel>
                <Cel>{stip(r.aangemaakt)}</Cel>
              </Rij>
            ))}
          </Tabel>
          <Paginering totaal={d.totaal} pagina={d.pagina} perPagina={d.perPagina} />
        </>
      )}
    </AdminShell>
  );
}
