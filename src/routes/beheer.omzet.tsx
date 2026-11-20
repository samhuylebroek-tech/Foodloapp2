import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import {
  BccBinnenkort,
  BccFout,
  BccLaden,
  BccTestmodus,
  datumTijd,
} from "@/components/beheer/BccDelen";
import { maandLabel } from "@/lib/bcc";
import { bccOmzet } from "@/lib/bcc.functions";
import { euro } from "@/lib/betalen/types";

export const Route = createFileRoute("/beheer/omzet")({ component: Omzet });

function Omzet() {
  const fn = useServerFn(bccOmzet);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bcc-omzet"],
    queryFn: () => fn(),
  });
  const laatste = data?.maanden[0] ?? null;

  return (
    <AdminShell
      titel="Omzet (testmodus)"
      omschrijving="Makerabonnementen, partnerplannen en premium per maand. Btw en terugbetalingen apart."
    >
      {isLoading ? (
        <BccLaden />
      ) : isError ? (
        <BccFout tekst="De omzet kon niet geladen worden." opnieuw={() => void refetch()} />
      ) : !data?.beschikbaar ? (
        <BccBinnenkort wat="Het omzetoverzicht" />
      ) : (
        <div className="space-y-4">
          <BccTestmodus>
            Alle bedragen komen uit de testbetaalprovider. Er is geen echte betaling, factuur of
            btw-aangifte. Bedragen zijn inclusief btw; de btw staat apart.
          </BccTestmodus>
          {laatste ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label={`Omzet ${maandLabel(laatste.maand)}`}
                waarde={euro(laatste.totaalBrutoCent)}
                extra="incl. btw, na terugbetalingen"
              />
              <Kpi label="Waarvan btw" waarde={euro(laatste.totaalBtwCent)} />
              <Kpi label="Excl. btw" waarde={euro(laatste.totaalExclBtwCent)} />
              <Kpi
                label="Terugbetaald"
                waarde={euro(laatste.terugbetalingen.brutoCent)}
                extra={`${laatste.terugbetalingen.aantal} keer`}
              />
            </div>
          ) : null}
          <Kaart>
            <h2 className="mb-3 text-base font-semibold">Per maand</h2>
            {!data.maanden.length ? (
              <p className="text-slate-300">Nog geen testbetalingen.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">Omzet per maand in testmodus</caption>
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th scope="col" className="py-2">
                        Maand
                      </th>
                      <th scope="col">Makerabonnementen</th>
                      <th scope="col">Partnerplannen</th>
                      <th scope="col">Premium</th>
                      <th scope="col">Terugbetaald</th>
                      <th scope="col">Totaal incl. btw</th>
                      <th scope="col">Btw</th>
                      <th scope="col">Excl. btw</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.maanden.map((m) => (
                      <tr
                        key={m.maand}
                        className="border-t border-white/5"
                        aria-label={maandLabel(m.maand)}
                      >
                        <th scope="row" className="py-2 text-left font-medium">
                          {maandLabel(m.maand)}
                        </th>
                        <td>
                          {euro(m.makerAbonnementen.brutoCent)}{" "}
                          <span className="text-slate-400">({m.makerAbonnementen.aantal})</span>
                        </td>
                        <td>
                          {euro(m.partnerplannen.brutoCent)}{" "}
                          <span className="text-slate-400">({m.partnerplannen.aantal})</span>
                        </td>
                        <td>
                          {euro(m.premium.brutoCent)}{" "}
                          <span className="text-slate-400">({m.premium.aantal})</span>
                        </td>
                        <td>− {euro(m.terugbetalingen.brutoCent)}</td>
                        <td className="font-semibold">{euro(m.totaalBrutoCent)}</td>
                        <td>{euro(m.totaalBtwCent)}</td>
                        <td>{euro(m.totaalExclBtwCent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Kaart>
          <Kaart>
            <h2 className="mb-2 text-base font-semibold">Terugbetalingen</h2>
            {!data.terugbetalingen.length ? (
              <p className="text-slate-300">Geen terugbetalingen.</p>
            ) : (
              <ul className="space-y-1 text-sm" aria-label="Terugbetalingen">
                {data.terugbetalingen.map((t, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {t.maker} <span className="text-slate-400">· {datumTijd(t.datum)}</span>
                    </span>
                    <strong>− {euro(t.bedrag_cent)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Een terugbetaling ontstaat wanneer een fan een makerabonnement opzegt (deel van de
              resterende periode, testmodus).
            </p>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
