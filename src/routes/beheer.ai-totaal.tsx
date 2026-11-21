/**
 * Fase 7 — Control Center › AI-totaal per actie: hoeveel slimme acties er deze maand waren,
 * over alle gebruikers samen (geen namen, geen inhoud), met de geschatte kost per actie.
 * Vaste regels tellen niet: die kosten niets.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { BccBinnenkort, BccFout, BccLaden } from "@/components/beheer/BccDelen";
import { bccTotalen, kleineKost } from "@/lib/ai/gebruik-log";
import { bccAiGebruik } from "@/lib/bcc.functions";
import { lokaleDatum } from "@/lib/tijd";

export const Route = createFileRoute("/beheer/ai-totaal")({ component: AiTotaal });

function AiTotaal() {
  const fn = useServerFn(bccAiGebruik);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bcc-ai-totaal"],
    queryFn: () => fn(),
  });
  const t = data ? bccTotalen(data.rijen, lokaleDatum()) : null;

  return (
    <AdminShell
      titel="AI-totaal per actie"
      omschrijving="Alle gebruikers samen, zonder namen of inhoud. Kost is een schatting per actie."
    >
      {isLoading ? (
        <BccLaden />
      ) : isError ? (
        <BccFout tekst="Het AI-gebruik kon niet geladen worden." opnieuw={() => void refetch()} />
      ) : !data?.beschikbaar || !t ? (
        <BccBinnenkort wat="Het AI-totaal" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Slimme acties deze maand" waarde={String(t.maand)} />
            <Kpi label="Vandaag" waarde={String(t.vandaag)} />
            <Kpi label="Uit de cache (gratis)" waarde={String(t.cache)} />
            <Kpi label="Geschatte kost deze maand" waarde={kleineKost(t.kostCent)} />
          </div>
          <Kaart>
            <h2 className="mb-3 text-base font-semibold">Per actie</h2>
            {!t.lijst.length ? (
              <p className="text-slate-300">Deze maand nog geen slimme acties.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">AI-gebruik per actie deze maand</caption>
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">Actie</th>
                      <th>Deze maand</th>
                      <th>Vandaag</th>
                      <th>Uit cache</th>
                      <th>Kost per actie</th>
                      <th>Kost maand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.lijst.map((r) => (
                      <tr key={r.soort} className="border-t border-white/5">
                        <td className="py-2">{r.label}</td>
                        <td className="tabular-nums">{r.maand}</td>
                        <td className="tabular-nums">{r.vandaag}</td>
                        <td className="tabular-nums">{r.cache}</td>
                        <td>{kleineKost(r.kostPerActieCent)}</td>
                        <td>{kleineKost(r.kostCent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Schatting met een klein model en korte antwoorden. Testmodus-antwoorden tellen mee als
              actie maar kosten in werkelijkheid niets.
            </p>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
