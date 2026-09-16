import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminDashboard } from "@/lib/admin.functions";
import {
  adminAandacht,
  adminActiviteit,
  adminGebeurtenissen,
  adminKosten,
} from "@/lib/monitoring.functions";
import { AdminShell, Kaart, Kpi, PeriodeKiezer, type Periode } from "@/components/AdminShell";
import { GEBEURTENIS_LABEL } from "@/lib/meten";

export const Route = createFileRoute("/beheer/")({ component: Dashboard });

const OMSCHRIJVING: Record<Periode, string> = {
  dag: "laatste 24 uur",
  week: "laatste 7 dagen",
  maand: "laatste 30 dagen",
  jaar: "laatste 12 maanden",
};

const KOP: Record<Periode, string> = {
  dag: "Vandaag",
  week: "Deze week",
  maand: "Deze maand",
  jaar: "Dit jaar",
};

const BEREIK: Record<Periode, "vandaag" | "zeven" | "dertig" | "jaar"> = {
  dag: "vandaag",
  week: "zeven",
  maand: "dertig",
  jaar: "jaar",
};

const DAGEN: Record<Periode, number> = { dag: 1, week: 7, maand: 30, jaar: 365 };

const euro = (n: number) => `€ ${Number(n ?? 0).toFixed(Number(n) < 1 ? 4 : 2)}`;
const klok = (iso: string) => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

function Dashboard() {
  const [periode, setPeriode] = useState<Periode>("week");
  const fn = useServerFn(adminDashboard);
  const vandaagFn = useServerFn(adminActiviteit);
  const recentFn = useServerFn(adminGebeurtenissen);
  const kostFn = useServerFn(adminKosten);
  const aandachtFn = useServerFn(adminAandacht);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", periode],
    queryFn: () => fn({ data: { periode } }),
  });
  const vandaag = useQuery({
    queryKey: ["admin-vandaag"],
    queryFn: () => vandaagFn({ data: { bereik: "vandaag" } }),
    refetchInterval: 60_000,
  });
  const recent = useQuery({
    queryKey: ["admin-recent"],
    queryFn: () => recentFn({ data: { bereik: "vandaag", limiet: 20 } }),
    refetchInterval: 30_000,
  });
  const kosten = useQuery({ queryKey: ["admin-kosten"], queryFn: () => kostFn() });
  const aandacht = useQuery({ queryKey: ["admin-aandacht"], queryFn: () => aandachtFn() });

  const max = Math.max(1, ...(data?.grafiek ?? []).map((g) => Math.max(g.aantal, g.gebruikers)));
  const tijd = OMSCHRIJVING[periode];
  const v = vandaag.data?.kpi;

  return (
    <AdminShell
      titel="Dashboard"
      omschrijving="Overzicht van het platform"
      acties={<PeriodeKiezer waarde={periode} onKies={setPeriode} />}
    >
      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Vandaag</h2>
          {!v ? (
            <p className="text-slate-400">Laden…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Actieve gebruikers" waarde={v.actieveGebruikers} extra={`${v.sessies} sessies`} />
              <Kpi label="Nieuwe gebruikers" waarde={v.nieuweGebruikers} />
              <Kpi label="AI-oproepen" waarde={v.aiCalls} extra={`${v.credits} credits`} />
              <Kpi label="AI-kosten" waarde={euro(v.kostEur)} extra={`${euro(v.kostPerActieve)} per actieve gebruiker`} />
              <Kpi label="Nieuwe recepten" waarde={v.nieuweRecepten} extra={`${v.imports} geïmporteerd`} />
              <Kpi label="Weekmenu-items" waarde={v.weekmenus} />
              <Kpi label="Boodschappenlijsten" waarde={v.lijsten} />
              <Kpi label="Fouten" waarde={v.fouten} />
            </div>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <Kaart>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Recente activiteit</p>
              <Link to="/beheer/activiteit" className="text-xs text-emerald-400 hover:underline">
                Alles bekijken
              </Link>
            </div>
            <div className="space-y-1 text-sm">
              {(recent.data ?? []).map((r, i) => (
                <div key={i} className="flex gap-3 border-b border-white/5 py-1.5">
                  <span className="w-12 text-slate-400">{klok(r.tijd)}</span>
                  {r.user_id ? (
                    <Link to="/beheer/gebruiker/$id" params={{ id: r.user_id }} className="text-emerald-300 hover:underline">
                      {r.naam}
                    </Link>
                  ) : (
                    <span>{r.naam}</span>
                  )}
                  <span className={r.type === "fout" ? "text-red-300" : r.type === "ai" ? "text-amber-300" : "text-slate-300"}>
                    {GEBEURTENIS_LABEL[r.titel as keyof typeof GEBEURTENIS_LABEL] ?? r.titel}
                  </span>
                </div>
              ))}
              {!(recent.data ?? []).length ? <p className="text-slate-400">Nog niets vandaag.</p> : null}
            </div>
          </Kaart>

          <Kaart>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Kosten</p>
              <Link to="/beheer/credits" className="text-xs text-emerald-400 hover:underline">
                Credits & kosten
              </Link>
            </div>
            {!kosten.data ? (
              <p className="text-slate-400">Laden…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Cijfer label="Vandaag" waarde={euro(kosten.data.vandaag)} />
                  <Cijfer label="Gisteren" waarde={euro(kosten.data.gisteren)} />
                  <Cijfer label="7 dagen" waarde={euro(kosten.data.zeven)} />
                  <Cijfer label="30 dagen" waarde={euro(kosten.data.dertig)} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Per functie (30 dagen)</p>
                <div className="mt-1 space-y-1 text-sm">
                  {kosten.data.perFeature.slice(0, 6).map((f) => (
                    <div key={f.sleutel} className="flex justify-between border-b border-white/5 py-1">
                      <span>{f.sleutel}</span>
                      <span className="text-slate-400">
                        {f.aantal}× · {euro(f.kost)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Kaart>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Gebruikersactiviteit · {tijd}
          </h2>
          {isLoading || !data ? (
            <p className="text-slate-400">Laden…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Gebruikers" waarde={data.gebruikers} extra={`+${data.nieuweGebruikers} in ${tijd}`} evolutie={data.evoluties.gebruikers} />
                <Kpi label="Recepten" waarde={data.recepten} extra={`+${data.nieuweRecepten} in ${tijd}`} evolutie={data.evoluties.recepten} />
                <Kpi label="Open supportvragen" waarde={data.openTickets} />
                <Kpi label={`AI-oproepen (${tijd})`} waarde={data.ai.totaal} extra={`${data.ai.fouten} fouten · gem. ${data.ai.gemiddeldMs} ms`} evolutie={data.evoluties.ai} />
              </div>
              <Kaart>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Evolutie · {tijd}</p>
                  <p className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2 rounded-sm bg-emerald-500/70" /> nieuwe recepten
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2 rounded-sm bg-sky-400/70" /> nieuwe gebruikers
                    </span>
                  </p>
                </div>
                <div className="flex h-36 items-end gap-1">
                  {data.grafiek.map((g) => (
                    <div key={g.datum} className="flex flex-1 items-end gap-0.5" title={`${g.datum}: ${g.aantal} recepten · ${g.gebruikers} gebruikers`}>
                      <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${Math.max(2, (g.aantal / max) * 100)}%` }} />
                      <div className="w-full rounded-t bg-sky-400/70" style={{ height: `${Math.max(2, (g.gebruikers / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
              </Kaart>
            </div>
          )}
        </section>

        <Kaart>
          <p className="mb-3 text-sm font-medium">Gebruikers die aandacht nodig hebben</p>
          <div className="space-y-1 text-sm">
            {(aandacht.data ?? []).slice(0, 15).map((a, i) => (
              <Link
                key={`${a.id}-${i}`}
                to="/beheer/gebruiker/$id"
                params={{ id: a.id }}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5"
              >
                <span
                  className={`size-2 rounded-full ${
                    a.ernst === "hoog" ? "bg-red-400" : a.ernst === "midden" ? "bg-amber-400" : "bg-slate-500"
                  }`}
                />
                <span className="font-medium">{a.naam}</span>
                <span className="text-slate-400">{a.reden}</span>
              </Link>
            ))}
            {!(aandacht.data ?? []).length ? <p className="text-slate-400">Alles ziet er goed uit.</p> : null}
          </div>
        </Kaart>
      </div>
    </AdminShell>
  );
}

function Cijfer({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-semibold">{waarde}</p>
    </div>
  );
}
