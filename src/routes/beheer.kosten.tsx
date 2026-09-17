import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminKostenOverzicht } from "@/lib/monitoring.functions";
import { adminInstellingZetten } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { toast } from "sonner";

export const Route = createFileRoute("/beheer/kosten")({ component: KostenPagina });

const BEREIKEN = [
  { waarde: "vandaag", label: "Vandaag" },
  { waarde: "gisteren", label: "Gisteren" },
  { waarde: "zeven", label: "7 dagen" },
  { waarde: "dertig", label: "30 dagen" },
  { waarde: "jaar", label: "Jaar" },
] as const;

type Bereik = (typeof BEREIKEN)[number]["waarde"];

function eur(n: number | null | undefined, cijfers = 2) {
  if (n === null || n === undefined) return "niet beschikbaar";
  return `€ ${Number(n).toFixed(cijfers)}`;
}

function KostenPagina() {
  const [bereik, setBereik] = useState<Bereik>("dertig");
  const fn = useServerFn(adminKostenOverzicht);
  const zetten = useServerFn(adminInstellingZetten);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-kosten", bereik],
    queryFn: () => fn({ data: { bereik, wieModus: "alles", wieIds: [] } }),
  });

  const bewaar = useMutation({
    mutationFn: (v: { key: string; value: number }) => zetten({ data: v }),
    onSuccess: () => {
      toast.success("Bewaard");
      void refetch();
    },
  });

  return (
    <AdminShell
      titel="Kosten"
      omschrijving="Wat Foodlo jou werkelijk kost — AI, hosting en credits"
      acties={
        <div className="flex flex-wrap gap-1">
          {BEREIKEN.map((b) => (
            <button
              key={b.waarde}
              onClick={() => setBereik(b.waarde)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                bereik === b.waarde ? "bg-emerald-500/20 text-emerald-300" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      }
    >
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          {data.alarm ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              De AI-kost van vandaag ({eur(data.alarm.kostVandaag, 4)}) ligt boven je grens van {eur(data.alarm.grens)}.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <Kaart>
              <p className="text-xs uppercase tracking-wide text-slate-400">Totale kost ({data.dagen} d)</p>
              <p className="mt-1 text-2xl font-semibold">{eur(data.totaal.alles, 4)}</p>
              <p className="text-xs text-slate-400">{eur(data.totaal.perDag, 4)} per dag</p>
            </Kaart>
            <Kaart>
              <p className="text-xs uppercase tracking-wide text-slate-400">AI (gemeten)</p>
              <p className="mt-1 text-2xl font-semibold">{eur(data.totaal.ai, 4)}</p>
              <p className="text-xs text-slate-400">
                {data.totaal.aiOproepen} oproepen · {data.totaal.cacheTreffers} uit cache
              </p>
            </Kaart>
            <Kaart>
              <p className="text-xs uppercase tracking-wide text-slate-400">Online houden (ingesteld)</p>
              <p className="mt-1 text-2xl font-semibold">{eur(data.totaal.hosting, 4)}</p>
              <p className="text-xs text-slate-400">
                {data.totaal.hostingCredits} credits · {data.instellingen.gratisCloud} gratis per maand
              </p>
            </Kaart>
            <Kaart>
              <p className="text-xs uppercase tracking-wide text-slate-400">Per actieve gebruiker</p>
              <p className="mt-1 text-2xl font-semibold">{eur(data.totaal.perGebruiker, 4)}</p>
              <p className="text-xs text-slate-400">{data.totaal.actieveGebruikers} gebruikers met AI</p>
            </Kaart>
          </div>

          {data.totaal.nietGemeten > 0 ? (
            <p className="text-xs text-slate-400">
              {data.totaal.nietGemeten} AI-oproepen hebben geen token- of beeldtelling en tellen dus niet mee in de kost
              (niet gemeten, niet gratis).
            </p>
          ) : null}

          <Kaart>
            <p className="mb-3 text-sm font-medium">Kost per actie</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Actie</th>
                    <th>Keren</th>
                    <th>Uit cache</th>
                    <th>Gem. kost</th>
                    <th>Totale kost</th>
                    <th>Credits betaald</th>
                    <th>Creditprijs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.acties.map((a: any) => (
                    <tr key={a.feature} className="border-t border-white/5">
                      <td className="py-2">{a.label}</td>
                      <td>{a.aantal}</td>
                      <td className="text-slate-400">{a.cache}</td>
                      <td>{a.gemiddeld === null ? <span className="text-slate-500">niet gemeten</span> : eur(a.gemiddeld, 4)}</td>
                      <td>{eur(a.kost, 4)}</td>
                      <td className="text-slate-400">{a.credits}</td>
                      <td className="text-slate-400">{a.creditPrijs ?? "—"}</td>
                    </tr>
                  ))}
                  {data.acties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-3 text-slate-400">
                        Geen AI-gebruik in deze periode.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Kaart>

          <div className="grid gap-4 lg:grid-cols-2">
            <Kaart>
              <p className="mb-3 text-sm font-medium">Kost per gebruiker</p>
              <ul className="space-y-1 text-sm">
                {data.gebruikers.map((u: any) => (
                  <li key={u.user_id} className="flex justify-between gap-3 border-b border-white/5 py-1">
                    <span>{u.naam}</span>
                    <span className="text-slate-400">
                      {u.aantal} acties · {u.credits} credits · {eur(u.kost, 4)}
                    </span>
                  </li>
                ))}
                {data.gebruikers.length === 0 ? <li className="text-slate-400">Nog niemand.</li> : null}
              </ul>
            </Kaart>

            <Kaart>
              <p className="mb-3 text-sm font-medium">Kost per dag</p>
              <Grafiek reeks={data.reeks} />
            </Kaart>
          </div>

          <Simulator
            acties={data.acties}
            creditEur={data.instellingen.creditEur}
            hostingKostPerDag={data.totaal.hosting / Math.max(1, data.dagen)}
          />

          <Kaart>
            <p className="mb-3 text-sm font-medium">Instellingen</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Veld
                label="Euro per credit"
                waarde={data.instellingen.creditEur}
                onBewaar={(v) => bewaar.mutate({ key: "kost_credit_eur", value: v })}
              />
              <Veld
                label="Hosting: credits per dag"
                waarde={data.instellingen.hostingPerDag}
                onBewaar={(v) => bewaar.mutate({ key: "hosting_credits_per_dag", value: v })}
              />
              <Veld
                label="Gratis cloud-credits per maand"
                waarde={data.instellingen.gratisCloud}
                onBewaar={(v) => bewaar.mutate({ key: "kost_gratis_cloud_credits", value: v })}
              />
              <Veld
                label="Waarschuw boven (€ per dag)"
                waarde={data.instellingen.alarmEur}
                onBewaar={(v) => bewaar.mutate({ key: "kost_alarm_eur", value: v })}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Hosting is een ingestelde schatting, geen meting. AI-kosten komen uit de prijslijst hieronder en de
              werkelijk verbruikte tokens en beelden.
            </p>
          </Kaart>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Prijslijst modellen</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Model</th>
                  <th>€ / 1M in</th>
                  <th>€ / 1M uit</th>
                  <th>€ / beeld</th>
                </tr>
              </thead>
              <tbody>
                {data.prijzen.map((p: any) => (
                  <tr key={p.model} className="border-t border-white/5">
                    <td className="py-2">{p.model}</td>
                    <td className="text-slate-400">{Number(p.eur_per_1m_in).toFixed(3)}</td>
                    <td className="text-slate-400">{Number(p.eur_per_1m_out).toFixed(3)}</td>
                    <td className="text-slate-400">{Number(p.eur_per_beeld).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}

function Grafiek({ reeks }: { reeks: { dag: string; kost: number }[] }) {
  const max = Math.max(0.0001, ...reeks.map((r) => r.kost));
  return (
    <div className="flex h-40 items-end gap-[2px]">
      {reeks.map((r) => (
        <div
          key={r.dag}
          title={`${r.dag}: € ${r.kost.toFixed(4)}`}
          className="flex-1 rounded-t bg-emerald-500/60"
          style={{ height: `${Math.max(2, (r.kost / max) * 100)}%` }}
        />
      ))}
      {reeks.length === 0 ? <p className="text-slate-400">Geen data.</p> : null}
    </div>
  );
}

function Veld({ label, waarde, onBewaar }: { label: string; waarde: number; onBewaar: (v: number) => void }) {
  const [v, setV] = useState(String(waarde));
  return (
    <label className="text-xs text-slate-400">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"
        />
        <button
          onClick={() => {
            const n = Number(v.replace(",", "."));
            if (Number.isFinite(n)) onBewaar(n);
          }}
          className="rounded-md bg-emerald-500/20 px-3 text-sm text-emerald-300"
        >
          Bewaar
        </button>
      </div>
    </label>
  );
}

function Simulator({
  acties,
  creditEur,
  hostingKostPerDag,
}: {
  acties: any[];
  creditEur: number;
  hostingKostPerDag: number;
}) {
  const [gebruikers, setGebruikers] = useState(100);
  const [fotos, setFotos] = useState(5);
  const [imports, setImports] = useState(3);
  const [suggesties, setSuggesties] = useState(3);

  const gem = useMemo(() => {
    const zoek = (f: string) => acties.find((a) => a.feature === f)?.gemiddeld ?? null;
    return {
      foto: zoek("foto_maken"),
      imp: zoek("import_url") ?? zoek("import_tekst"),
      sug: zoek("suggesties"),
    };
  }, [acties]);

  const perWeek =
    gebruikers * (fotos * (gem.foto ?? 0) + imports * (gem.imp ?? 0) + suggesties * (gem.sug ?? 0));
  const perDag = perWeek / 7 + hostingKostPerDag;
  const perMaand = perDag * 30;
  const perGebruikerMaand = gebruikers ? perMaand / gebruikers : 0;
  const ontbreekt = gem.foto === null || gem.imp === null || gem.sug === null;

  return (
    <Kaart>
      <p className="mb-3 text-sm font-medium">Wat als het groeit?</p>
      <div className="grid gap-3 md:grid-cols-4">
        <Getal label="Gebruikers" waarde={gebruikers} zet={setGebruikers} />
        <Getal label="AI-foto's per gebruiker/week" waarde={fotos} zet={setFotos} />
        <Getal label="Imports per gebruiker/week" waarde={imports} zet={setImports} />
        <Getal label="Suggesties per gebruiker/week" waarde={suggesties} zet={setSuggesties} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm">
        <div>
          <p className="text-xs uppercase text-slate-400">Per dag</p>
          <p className="text-xl font-semibold">{eur(perDag)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Per maand</p>
          <p className="text-xl font-semibold">{eur(perMaand)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Per gebruiker/maand</p>
          <p className="text-xl font-semibold">{eur(perGebruikerMaand)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">In credits/maand</p>
          <p className="text-xl font-semibold">{creditEur ? Math.round(perMaand / creditEur) : 0}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {ontbreekt
          ? "Voor sommige acties is nog geen gemeten kost beschikbaar; die tellen als € 0 tot ze gemeten zijn."
          : "Gerekend met je eigen gemeten kost per actie."}
      </p>
    </Kaart>
  );
}

function Getal({ label, waarde, zet }: { label: string; waarde: number; zet: (n: number) => void }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        value={waarde}
        onChange={(e) => zet(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
        inputMode="numeric"
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"
      />
    </label>
  );
}
