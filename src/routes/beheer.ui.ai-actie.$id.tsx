import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Kruimels, SubNav, euro, stip } from "@/components/UserIntelligence";
import { uiAiDetail } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/ai-actie/$id")({ component: AiActie });

function Regel({ label, waarde }: { label: string; waarde: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{waarde ?? "niet beschikbaar"}</span>
    </div>
  );
}

function AiActie() {
  const { id } = Route.useParams();
  const fn = useServerFn(uiAiDetail);
  const q = useQuery({ queryKey: ["ui-ai-detail", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data;

  return (
    <AdminShell titel="AI-actie" omschrijving="Model, credits en geschatte kost van één AI-oproep.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "AI & kosten", to: "/beheer/ui/ai" },
          { label: "Detail" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d ? (
        <p className="text-slate-400">Deze AI-actie bestaat niet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">{d.rij.feature}</h2>
            <Regel label="Tijd" waarde={stip(d.rij.created_at)} />
            <Regel
              label="Gebruiker"
              waarde={
                d.rij.user_id ? (
                  <Link to="/beheer/ui/gebruiker/$id" params={{ id: d.rij.user_id }} className="text-emerald-300 hover:underline">
                    {d.naam}
                  </Link>
                ) : (
                  "systeem"
                )
              }
            />
            <Regel label="Aanbieder" waarde={d.rij.provider} />
            <Regel label="Model" waarde={d.rij.model} />
            <Regel label="Tokens in" waarde={d.rij.tokens_in} />
            <Regel label="Tokens uit" waarde={d.rij.tokens_out} />
            <Regel label="Beelden" waarde={d.rij.beelden} />
            <Regel label="Credits" waarde={d.rij.credits} />
            <Regel label="Kost (schatting)" waarde={euro(d.rij.kost_eur)} />
            <Regel label="Uit cache" waarde={d.rij.cache_hit ? "ja" : "nee"} />
            <Regel label="Duur" waarde={d.rij.duration_ms ? `${d.rij.duration_ms} ms` : null} />
            <Regel label="Resultaat" waarde={d.rij.ok ? "gelukt" : (d.rij.error_code ?? "mislukt")} />
            <Regel
              label="Sessie"
              waarde={
                d.sessie ? (
                  <Link to="/beheer/ui/sessie/$id" params={{ id: d.sessie.id }} className="text-sky-300 hover:underline">
                    sessie van {stip(d.sessie.started_at)}
                  </Link>
                ) : null
              }
            />
            <p className="mt-2 text-xs text-slate-500">De kost is een schatting op basis van de ingestelde modelprijzen.</p>
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Creditbewegingen rond deze actie</h2>
            <ul className="divide-y divide-white/5 text-sm">
              {d.transacties.map((t: any) => (
                <li key={t.id} className="flex justify-between py-1.5">
                  <span>
                    {t.type} {t.feature ? `· ${t.feature}` : ""} · {t.status}
                  </span>
                  <span className="text-slate-400">
                    {t.amount} · saldo {t.balance_after - t.amount} → {t.balance_after}
                  </span>
                </li>
              ))}
              {d.transacties.length === 0 ? <li className="py-2 text-slate-500">Geen creditbewegingen gevonden.</li> : null}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
