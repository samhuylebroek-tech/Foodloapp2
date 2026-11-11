import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminFinance } from "@/lib/finance.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/finance")({ component: Finance });

const euro = (n: number) =>
  `€ ${Number(n ?? 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KEUZES = [7, 30, 90, 365];

function Finance() {
  const [dagen, setDagen] = useState(30);
  const fn = useServerFn(adminFinance);
  const q = useQuery({ queryKey: ["finance", dagen], queryFn: () => fn({ data: { dagen } }) });
  const d = q.data;
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : undefined);

  return (
    <AdminShell
      titel="Wat kost en wat levert Foodlo op?"
      omschrijving="Omzet, kosten en credits — alleen echte cijfers."
      acties={
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {KEUZES.map((k) => (
            <button
              key={k}
              onClick={() => setDagen(k)}
              className={`rounded-md px-3 py-1.5 text-sm ${dagen === k ? "bg-emerald-500/20 text-emerald-300" : "text-slate-300"}`}
            >
              {k === 365 ? "Jaar" : `${k} d`}
            </button>
          ))}
        </div>
      }
    >
      {!d ? (
        <p className="text-slate-400">{q.error ? (q.error as Error).message : "Laden…"}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Omzet (euro)"
              waarde={euro(d.omzet)}
              evolutie={pct(d.omzet, d.omzetVorig)}
              extra={
                d.andereValuta.aantal
                  ? `${d.andereValuta.aantal} betaling(en) in ${d.andereValuta.munten.join(", ")} niet meegeteld`
                  : d.omzet === 0
                    ? "Betalingen niet gekoppeld"
                    : `${d.betalendeKlanten} betalende klanten`
              }
            />
            <Kpi
              label="AI-kosten (schatting)"
              waarde={euro(d.kost)}
              evolutie={pct(d.kost, d.kostVorig)}
              extra="Volgens de prijslijst; hosting en andere kosten: zie Kosten"
            />
            <Kpi
              label="Omzet min AI-kosten"
              waarde={euro(d.marge)}
              extra="Geen winst: hosting, e-mail en betaalkosten zitten er niet in"
            />
            <Kpi label="Terugbetalingen" waarde={d.refunds.aantal} extra={euro(d.refunds.bedrag)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Kaart>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Credits</h2>
                <Link to="/beheer/credits" className="text-xs text-emerald-400 hover:underline">
                  Details
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Blok l="Verbruikt" w={d.credits.verbruikt} />
                <Blok l="Gratis gegeven" w={d.credits.gratis} />
                <Blok l="Verkocht" w={d.credits.gekocht} />
                <Blok l="Teruggestort" w={d.credits.terug} />
                <Blok l="Openstaand saldo" w={d.credits.openstaand} />
              </div>
            </Kaart>
            <Kaart>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Kosten per functie</h2>
                <Link to="/beheer/kosten" className="text-xs text-emerald-400 hover:underline">
                  Alle kosten
                </Link>
              </div>
              <div className="space-y-1 text-sm">
                {d.perFeature.slice(0, 8).map((f) => (
                  <div
                    key={f.sleutel}
                    className="flex justify-between border-b border-white/5 py-1.5"
                  >
                    <span>{f.sleutel}</span>
                    <span className="text-slate-400">
                      {f.aantal}× · {f.credits} cr · {euro(f.kost)}
                    </span>
                  </div>
                ))}
                {!d.perFeature.length ? (
                  <p className="text-slate-400">Geen AI-gebruik in deze periode.</p>
                ) : null}
              </div>
            </Kaart>
          </div>

          <Kaart>
            <h2 className="mb-3 text-sm font-semibold">Inkomstenbronnen</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {["Web-betalingen", "Apple App Store", "Google Play", "Abonnementen"].map((b) => (
                <div key={b} className="rounded-lg border border-white/10 p-3">
                  <p className="text-sm font-medium">{b}</p>
                  <p className="mt-1 text-xs text-slate-400">Niet gekoppeld</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Omzet, abonnementen, uitbetalingen en refunds verschijnen hier automatisch zodra een
              betaalkanaal gekoppeld is. Zie{" "}
              <Link
                to="/beheer/integraties"
                className="text-emerald-400 underline underline-offset-2"
              >
                Integraties
              </Link>
              .
            </p>
          </Kaart>

          <Kaart>
            <h2 className="mb-3 text-sm font-semibold">Transacties</h2>
            {d.transacties.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Datum</th>
                    <th>Soort</th>
                    <th>Bedrag</th>
                    <th>Status</th>
                    <th>Kanaal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {d.transacties.map((t: any) => (
                    <tr key={t.id}>
                      <td className="py-2">
                        <Link
                          to="/beheer/gebruiker/$id"
                          params={{ id: t.user_id }}
                          className="text-emerald-300 hover:underline"
                        >
                          {new Date(t.created_at).toLocaleDateString("nl-BE")}
                        </Link>
                      </td>
                      <td>{t.soort}</td>
                      <td>{euro(t.bedrag_cent / 100)}</td>
                      <td>{t.status}</td>
                      <td>{t.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-400">Nog geen transacties.</p>
            )}
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}

function Blok({ l, w }: { l: string; w: number }) {
  return (
    <div className="rounded-lg bg-white/5 p-2">
      <p className="text-xs text-slate-400">{l}</p>
      <p className="text-base font-semibold">{w.toLocaleString("nl-BE")}</p>
    </div>
  );
}
