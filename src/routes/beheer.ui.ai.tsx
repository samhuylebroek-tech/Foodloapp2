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
  euro,
  naarFilters,
  stip,
  zoekSchema,
} from "@/components/UserIntelligence";
import { uiAi } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/ai")({
  validateSearch: (s) => zoekSchema.parse(s ?? {}),
  component: Ai,
});

function Ai() {
  const zoek = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(uiAi);
  const q = useQuery({ queryKey: ["ui-ai", zoek], queryFn: () => fn({ data: naarFilters(zoek) }) });
  const d = q.data;

  return (
    <AdminShell
      titel="AI & kosten"
      omschrijving="Elke AI-actie met model, credits en geschatte kost. Kosten zijn een schatting op basis van modelprijzen."
    >
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "AI & kosten" },
        ]}
      />
      <FilterBalk zoek={zoek} scherm="ai" velden={["feature", "resultaat"]} exportSoort="ai" />

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
              { label: "Onderdeel" },
              { label: "Aanbieder" },
              { label: "Model" },
              { label: "Tokens in/uit" },
              { label: "Credits" },
              { label: "Kost (schatting)" },
              { label: "Cache" },
              { label: "Resultaat" },
            ]}
          >
            {d.rijen.map((r: any) => (
              <Rij key={r.id} onClick={() => navigate({ to: "/beheer/ui/ai-actie/$id", params: { id: r.id } } as any)}>
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
                    "systeem"
                  )}
                </Cel>
                <Cel>{r.feature}</Cel>
                <Cel>{r.provider}</Cel>
                <Cel>{r.model}</Cel>
                <Cel>
                  {r.tokens_in}/{r.tokens_out}
                </Cel>
                <Cel>{r.credits}</Cel>
                <Cel>{euro(r.kost_eur)}</Cel>
                <Cel>{r.cache_hit ? "ja" : "nee"}</Cel>
                <Cel className={r.ok ? "" : "text-red-300"}>{r.ok ? "gelukt" : (r.error_code ?? "mislukt")}</Cel>
              </Rij>
            ))}
          </Tabel>
          <Paginering totaal={d.totaal} pagina={d.pagina} perPagina={d.perPagina} />
        </>
      )}
    </AdminShell>
  );
}
