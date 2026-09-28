import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, Mail, Minus, UserSearch, Wallet, Wrench } from "lucide-react";
import { adminAandacht, adminActiviteit, adminGebeurtenissen } from "@/lib/monitoring.functions";
import { adminFinance } from "@/lib/finance.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { GEBEURTENIS_LABEL } from "@/lib/meten";

export const Route = createFileRoute("/beheer/")({ component: Overzicht });

const euro = (n: number) => `€ ${Number(n ?? 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const klok = (iso: string) => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

function verschil(nu: number, toen: number) {
  if (!toen) return nu ? 100 : 0;
  return Math.round(((nu - toen) / toen) * 100);
}

function Overzicht() {
  const actFn = useServerFn(adminActiviteit);
  const recentFn = useServerFn(adminGebeurtenissen);
  const aandachtFn = useServerFn(adminAandacht);
  const finFn = useServerFn(adminFinance);

  const vandaag = useQuery({ queryKey: ["cc-vandaag"], queryFn: () => actFn({ data: { bereik: "vandaag" } as any }), refetchInterval: 60_000 });
  const gisteren = useQuery({ queryKey: ["cc-gisteren"], queryFn: () => actFn({ data: { bereik: "gisteren" } as any }) });
  const recent = useQuery({ queryKey: ["cc-recent"], queryFn: () => recentFn({ data: { bereik: "vandaag", limiet: 12 } as any }), refetchInterval: 30_000 });
  const aandacht = useQuery({ queryKey: ["cc-aandacht"], queryFn: () => aandachtFn() });
  const fin = useQuery({ queryKey: ["cc-fin", 30], queryFn: () => finFn({ data: { dagen: 30 } }) });

  const v = vandaag.data?.kpi as any;
  const g = gisteren.data?.kpi as any;
  const hoog = (aandacht.data ?? []).filter((a: any) => a.ernst === "hoog").length;

  const status = !v
    ? null
    : v.fouten > 5 || hoog > 3
      ? { toon: "rood", tekst: `Aandacht nodig: ${v.fouten} fouten vandaag en ${hoog} gebruikers met hoge prioriteit.` }
      : v.fouten > 0 || hoog > 0
        ? { toon: "geel", tekst: `Foodlo draait goed, met ${v.fouten} fout${v.fouten === 1 ? "" : "en"} en ${hoog} gebruiker${hoog === 1 ? "" : "s"} om op te volgen.` }
        : { toon: "groen", tekst: "Foodlo draait goed. Geen fouten en niemand die dringend aandacht nodig heeft." };

  const inzichten: string[] = [];
  if (v && g) {
    const d = verschil(v.actieveGebruikers, g.actieveGebruikers);
    if (d) inzichten.push(`${Math.abs(d)}% ${d > 0 ? "meer" : "minder"} actieve gebruikers dan gisteren (${v.actieveGebruikers} vs ${g.actieveGebruikers}).`);
    if (v.nieuweGebruikers) inzichten.push(`${v.nieuweGebruikers} nieuwe gebruiker${v.nieuweGebruikers === 1 ? "" : "s"} vandaag.`);
    const k = verschil(v.kostEur, g.kostEur);
    if (Math.abs(k) >= 25 && v.kostEur > 0.01) inzichten.push(`AI-kosten ${k > 0 ? "stijgen" : "dalen"} ${Math.abs(k)}% t.o.v. gisteren.`);
    if (v.imports > g.imports) inzichten.push(`Meer recepten geïmporteerd dan gisteren (${v.imports}).`);
  }
  if (fin.data && fin.data.omzet === 0) inzichten.push("Nog geen omzet: betalingen zijn nog niet gekoppeld.");

  return (
    <AdminShell titel="Hoe gaat Foodlo?" omschrijving={new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}>
      <div className="space-y-6">
        {status ? (
          <div
            className={`rounded-xl border p-4 text-base ${
              status.toon === "groen"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : status.toon === "geel"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border-red-500/30 bg-red-500/10 text-red-100"
            }`}
          >
            {status.tekst}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Groot label="Actief vandaag" waarde={v?.actieveGebruikers} vorig={g?.actieveGebruikers} to="/beheer/activiteit" />
          <Groot label="Nieuwe gebruikers" waarde={v?.nieuweGebruikers} vorig={g?.nieuweGebruikers} to="/beheer/gebruikers" />
          <Groot label="Kosten vandaag" waarde={v?.kostEur} vorig={g?.kostEur} geld omgekeerd to="/beheer/kosten" />
          <Groot label="Omzet (30 dagen)" waarde={fin.data?.omzet} vorig={fin.data?.omzetVorig} geld to="/beheer/finance" extra={fin.data?.omzet === 0 ? "Betalingen niet gekoppeld" : undefined} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Kaart className="xl:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Wat is er veranderd?</h2>
            {inzichten.length ? (
              <ul className="space-y-2 text-[15px] text-slate-200">
                {inzichten.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {i}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">Geen opvallende veranderingen t.o.v. gisteren.</p>
            )}
            {v ? (
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Klein label="Sessies" w={v.sessies} />
                <Klein label="AI-oproepen" w={v.aiCalls} />
                <Klein label="Credits verbruikt" w={v.credits} />
                <Klein label="Nieuwe recepten" w={v.nieuweRecepten} />
              </div>
            ) : null}
          </Kaart>

          <Kaart>
            <h2 className="mb-3 text-sm font-semibold">Snelle acties</h2>
            <div className="grid gap-2">
              <Actie to="/beheer/gebruikers" icoon={UserSearch} label="Gebruiker opzoeken" />
              <Actie to="/beheer/communicatie" icoon={Mail} label="Bericht versturen" />
              <Actie to="/beheer/finance" icoon={Wallet} label="Kosten en omzet" />
              <Actie to="/beheer/systeem" icoon={Wrench} label="Systeemstatus" />
            </div>
          </Kaart>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Kaart>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Wie heeft aandacht nodig?</h2>
              <Link to="/beheer/ui/segmenten" className="text-xs text-emerald-400 hover:underline">Segmenten</Link>
            </div>
            <div className="space-y-1 text-sm">
              {(aandacht.data ?? []).slice(0, 8).map((a: any, i: number) => (
                <Link key={`${a.id}-${i}`} to="/beheer/gebruiker/$id" params={{ id: a.id }} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                  <span className={`size-2 shrink-0 rounded-full ${a.ernst === "hoog" ? "bg-red-400" : a.ernst === "midden" ? "bg-amber-400" : "bg-slate-500"}`} />
                  <span className="font-medium">{a.naam}</span>
                  <span className="truncate text-slate-400">{a.reden}</span>
                </Link>
              ))}
              {aandacht.data && !aandacht.data.length ? <p className="text-slate-400">Niemand. Alles ziet er goed uit.</p> : null}
            </div>
          </Kaart>

          <Kaart>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Net gebeurd</h2>
              <Link to="/beheer/activiteit" className="text-xs text-emerald-400 hover:underline">Volledige tijdlijn</Link>
            </div>
            <div className="space-y-1 text-sm">
              {(recent.data ?? []).map((r: any, i: number) => (
                <div key={i} className="flex gap-3 border-b border-white/5 py-1.5">
                  <span className="w-12 shrink-0 text-slate-500">{klok(r.tijd)}</span>
                  {r.user_id ? (
                    <Link to="/beheer/gebruiker/$id" params={{ id: r.user_id }} className="shrink-0 text-emerald-300 hover:underline">{r.naam}</Link>
                  ) : (
                    <span className="shrink-0">{r.naam}</span>
                  )}
                  <span className={`truncate ${r.type === "fout" ? "text-red-300" : r.type === "ai" ? "text-amber-300" : "text-slate-300"}`}>
                    {GEBEURTENIS_LABEL[r.titel as keyof typeof GEBEURTENIS_LABEL] ?? r.titel}
                  </span>
                </div>
              ))}
              {recent.data && !recent.data.length ? <p className="text-slate-400">Vandaag nog niets gebeurd.</p> : null}
            </div>
          </Kaart>
        </div>
      </div>
    </AdminShell>
  );
}

function Groot({ label, waarde, vorig, geld, omgekeerd, to, extra }: { label: string; waarde?: number | undefined; vorig?: number | undefined; geld?: boolean; omgekeerd?: boolean; to: string; extra?: string | undefined }) {
  const d = waarde == null || vorig == null ? null : verschil(waarde, vorig);
  const goed = d == null || d === 0 ? null : omgekeerd ? d < 0 : d > 0;
  const Pijl = !d ? Minus : d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Link to={to} className="rounded-xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-emerald-500/40">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{waarde == null ? "…" : geld ? euro(waarde) : waarde.toLocaleString("nl-BE")}</p>
      <p className={`mt-2 flex items-center gap-1 text-xs ${goed == null ? "text-slate-500" : goed ? "text-emerald-300" : "text-red-300"}`}>
        {extra ?? (d == null ? "" : <><Pijl className="size-3.5" /> {d > 0 ? "+" : ""}{d}% t.o.v. vorige periode</>)}
      </p>
    </Link>
  );
}

function Klein({ label, w }: { label: string; w: number }) {
  return (
    <div className="rounded-lg bg-white/5 p-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-semibold">{w}</p>
    </div>
  );
}

function Actie({ to, icoon: I, label }: { to: string; icoon: typeof Mail; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-3 text-sm hover:bg-white/5">
      <I className="size-4 text-emerald-400" /> {label}
    </Link>
  );
}
