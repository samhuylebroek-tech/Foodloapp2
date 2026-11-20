import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import {
  BccBinnenkort,
  BccFout,
  BccLaden,
  BccTestmodus,
  BevestigKnop,
  datumTijd,
} from "@/components/beheer/BccDelen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/hooks/useAdmin";
import { leesPlatformProcent, maandLabel } from "@/lib/bcc";
import {
  bccTestuitbetalingVastleggen,
  bccUitbetalingen,
  bccZetPlatformProcent,
} from "@/lib/bcc.functions";
import { euro } from "@/lib/betalen/types";

export const Route = createFileRoute("/beheer/uitbetalingen")({ component: Uitbetalingen });

function Uitbetalingen() {
  const { mag, alleenLezen } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(bccUitbetalingen);
  const zetFn = useServerFn(bccZetPlatformProcent);
  const vastFn = useServerFn(bccTestuitbetalingVastleggen);
  const [maand, setMaand] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bcc-uitbetalingen", maand ?? "laatste"],
    queryFn: () => lijstFn({ data: maand ? { maand } : {} }),
  });
  const ververs = () => qc.invalidateQueries({ queryKey: ["bcc-uitbetalingen"] });
  const [procent, setProcent] = useState("");
  const procentFout = procent && leesPlatformProcent(procent) === null;
  const zet = useMutation({
    mutationFn: (p: string) => zetFn({ data: { procent: p } }),
    onSuccess: (r) => {
      toast.success(`Platformdeel staat nu op ${r.procent} %. Dit staat in het auditlog.`);
      setProcent("");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const vastleggen = useMutation({
    mutationFn: (m: string) => vastFn({ data: { maand: m } }),
    onSuccess: (r) => {
      toast.success(
        `Testuitbetaling vastgelegd voor ${r.makers} ${r.makers === 1 ? "maker" : "makers"}. Er is niets uitbetaald.`,
      );
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const magWijzigen = mag("finance.manage") && !alleenLezen;
  const totaalMaker = (data?.makers ?? []).reduce((s, m) => s + m.makerCent, 0);
  const totaalPlatform = (data?.makers ?? []).reduce((s, m) => s + m.platformCent, 0);
  const vast = new Map((data?.vastgelegd ?? []).map((v) => [v.creator_id, v]));

  return (
    <AdminShell
      titel="Makeruitbetalingen (testmodus)"
      omschrijving="Wat makers zouden ontvangen van hun abonnementen, met één centrale verdeling maker/platform."
    >
      {isLoading ? (
        <BccLaden />
      ) : isError ? (
        <BccFout
          tekst="De uitbetalingen konden niet geladen worden."
          opnieuw={() => void refetch()}
        />
      ) : !data?.beschikbaar ? (
        <BccBinnenkort wat="Het uitbetalingsoverzicht" />
      ) : (
        <div className="space-y-4">
          <BccTestmodus>
            Er wordt niets uitbetaald. Elke regel staat op “zou uitbetaald worden”. Voor echte
            uitbetalingen is eerst een betaal- en uitbetalingsprovider nodig, met
            identiteitscontrole (KYC) van elke maker, een btw-review en het akkoord van de eigenaar.
          </BccTestmodus>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Platformdeel"
              waarde={`${data.platformProcent.toLocaleString("nl-BE")} %`}
              extra="centraal ingesteld"
            />
            <Kpi
              label="Naar makers (zou)"
              waarde={euro(totaalMaker)}
              extra={maandLabel(data.maand)}
            />
            <Kpi label="Platform" waarde={euro(totaalPlatform)} extra={maandLabel(data.maand)} />
            <Kpi label="Identiteitscontrole (KYC)" waarde="Niet gekoppeld" extra="geen provider" />
          </div>

          <Kaart className="space-y-3">
            <h2 className="text-base font-semibold">Verdeling maker / platform</h2>
            <p className="text-sm text-slate-300">
              Per betaling: eerst de btw (21 %), dan de geschatte betaalkosten ({"1,5 % + € 0,25"}),
              dan het platformdeel. De rest is voor de maker. Wijzigen geldt voor alle makers
              tegelijk en komt in het auditlog.
            </p>
            {magWijzigen ? (
              <form
                className="flex flex-wrap items-end gap-2"
                aria-label="Platformdeel wijzigen"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (procent && !procentFout) zet.mutate(procent);
                }}
              >
                <label className="text-sm text-slate-300">
                  Nieuw platformdeel in procent (0–50)
                  <Input
                    value={procent}
                    onChange={(e) => setProcent(e.target.value)}
                    inputMode="decimal"
                    aria-invalid={procentFout || undefined}
                    aria-describedby={procentFout ? "procent-fout" : undefined}
                    className="mt-1 min-h-11 w-40 border-white/10 bg-slate-950 text-slate-100"
                  />
                </label>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={!procent || !!procentFout || zet.isPending}
                >
                  Platformdeel bewaren
                </Button>
                {procentFout ? (
                  <p id="procent-fout" className="w-full text-sm text-red-300">
                    Kies een getal tussen 0 en 50, met hoogstens één cijfer na de komma.
                  </p>
                ) : null}
              </form>
            ) : (
              <p className="text-sm text-slate-400">Alleen de eigenaar wijzigt de verdeling.</p>
            )}
          </Kaart>

          <Kaart className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="text-sm text-slate-300">
                Maand
                <select
                  value={data.maand}
                  onChange={(e) => setMaand(e.target.value)}
                  className="mt-1 block min-h-11 rounded-lg border border-white/10 bg-slate-950 px-3 text-slate-100"
                >
                  {(data.maanden.length ? data.maanden : [data.maand]).map((m) => (
                    <option key={m} value={m}>
                      {maandLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              {magWijzigen && data.makers.length ? (
                <BevestigKnop
                  label="Testuitbetaling vastleggen…"
                  vraag={`De verdeling van ${maandLabel(data.maand)} vastleggen als “zou uitbetaald worden”? Er gaat geen geld weg.`}
                  bevestig="Ja, vastleggen (test)"
                  bezig={vastleggen.isPending}
                  onBevestig={() => vastleggen.mutate(data.maand)}
                />
              ) : null}
            </div>
            {!data.makers.length ? (
              <p className="text-slate-300">Geen makerabonnementen in deze maand.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">Uitbetaling per maker in testmodus</caption>
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th scope="col" className="py-2">
                        Maker
                      </th>
                      <th scope="col">Betalingen</th>
                      <th scope="col">Bruto</th>
                      <th scope="col">Btw</th>
                      <th scope="col">Betaalkosten</th>
                      <th scope="col">Platform</th>
                      <th scope="col">Maker</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.makers.map((m) => (
                      <tr
                        key={m.creator_id}
                        className="border-t border-white/5 align-top"
                        aria-label={m.maker}
                      >
                        <th scope="row" className="py-2 text-left font-medium">
                          {m.maker}
                          {m.handle ? (
                            <span className="block text-xs text-slate-400">@{m.handle}</span>
                          ) : null}
                        </th>
                        <td>
                          {m.betalingen}
                          {m.terugbetalingen ? (
                            <span className="block text-xs text-slate-400">
                              {m.terugbetalingen} terugbetaald
                            </span>
                          ) : null}
                        </td>
                        <td>{euro(m.brutoCent)}</td>
                        <td>{euro(m.btwCent)}</td>
                        <td>{euro(m.betaalkostenCent)}</td>
                        <td>{euro(m.platformCent)}</td>
                        <td className="font-semibold">{euro(m.makerCent)}</td>
                        <td>
                          Zou uitbetaald worden
                          <span className="block text-xs text-slate-400">
                            KYC niet gekoppeld
                            {vast.get(m.creator_id)
                              ? ` · vastgelegd ${datumTijd(vast.get(m.creator_id)!.created_at)}`
                              : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
