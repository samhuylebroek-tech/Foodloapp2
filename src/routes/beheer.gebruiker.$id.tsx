import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGebruikerDetail } from "@/lib/admin.functions";
import { adminGebruikerMonitoring } from "@/lib/monitoring.functions";
import { SEGMENT_LABEL, type Segment } from "@/lib/segmenten";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GEBEURTENIS_LABEL } from "@/lib/meten";

export const Route = createFileRoute("/beheer/gebruiker/$id")({ component: GebruikerDetail });

const euro = (n: number) => `€ ${Number(n ?? 0).toFixed(4)}`;
const stip = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function GebruikerDetail() {
  const { id } = Route.useParams();
  const monFn = useServerFn(adminGebruikerMonitoring);
  const detFn = useServerFn(adminGebruikerDetail);

  const mon = useQuery({ queryKey: ["admin-gebruiker-monitoring", id], queryFn: () => monFn({ data: { id } }) });
  const det = useQuery({ queryKey: ["admin-gebruiker", id], queryFn: () => detFn({ data: { id } }) });

  const d: any = det.data ?? {};
  const m = mon.data;
  const maxDag = Math.max(1, ...(m?.dagen ?? []).map((x) => x.handelingen));

  return (
    <AdminShell
      titel={d.profiel?.display_name ?? "Gebruiker"}
      omschrijving={d.email ?? ""}
      acties={
        <Link to="/beheer/communicatie" search={{ gebruiker: id }}>
          <Button size="sm">Contacteer gebruiker</Button>
        </Link>
      }
    >
      {!m ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <Tabs defaultValue="overzicht" className="space-y-4">
          <TabsList className="flex flex-wrap bg-white/5">
            {[
              ["overzicht", "Overzicht"],
              ["activiteit", "Activiteit"],
              ["gebruik", "Gebruik"],
              ["ai", "AI & credits"],
              ["connecties", "Connecties"],
              ["meldingen", "Meldingen"],
              ["support", "Support"],
              ["fouten", "Fouten"],
            ].map(([w, l]) => (
              <TabsTrigger key={w} value={w}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overzicht" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(m.segmenten as Segment[]).map((s) => (
                <span key={s} className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                  {SEGMENT_LABEL[s]}
                </span>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Laatst actief" waarde={stip(m.laatsteActiviteit)} extra={`aanmelding ${stip(d.laatsteAanmelding)}`} />
              <Kpi label="Lid sinds" waarde={d.profiel?.created_at ? new Date(d.profiel.created_at).toLocaleDateString("nl-BE") : "—"} />
              <Kpi label="Sessies (30 d)" waarde={m.sessies30} extra={`${m.sessies24} vandaag · ${m.sessies7} deze week`} />
              <Kpi label="Handelingen (30 d)" waarde={m.dertig.handelingen} />
              <Kpi label="AI-oproepen (30 d)" waarde={m.dertig.ai} />
              <Kpi label="Credits gebruikt (30 d)" waarde={m.dertig.credits} extra={`saldo ${m.credits?.balance ?? 0}`} />
              <Kpi label="Kost (30 d)" waarde={euro(m.dertig.kost)} extra={`levenslang ${euro(m.lifetimeKost)}`} />
              <Kpi label="Betaald" waarde={`€ ${m.omzetEur.toFixed(2)}`} extra={`${m.connecties} connecties`} />
            </div>
            <Kaart>
              <p className="mb-3 text-sm font-medium">Activiteit per dag (30 dagen)</p>
              <div className="flex h-28 items-end gap-1">
                {m.dagen.map((x) => (
                  <div
                    key={x.dag}
                    className="flex-1 rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(2, (x.handelingen / maxDag) * 100)}%` }}
                    title={`${x.dag}: ${x.handelingen} handelingen · ${x.ai} AI · ${euro(x.kost)}`}
                  />
                ))}
              </div>
            </Kaart>
          </TabsContent>

          <TabsContent value="activiteit">
            <Kaart>
              <div className="max-h-[600px] space-y-1 overflow-auto text-sm">
                {m.tijdlijn.map((t, i) => (
                  <div key={i} className="flex gap-3 border-b border-white/5 py-1.5">
                    <span className="w-32 shrink-0 text-slate-400">{stip(t.tijd)}</span>
                    <span className={t.type === "fout" ? "text-red-300" : t.type === "ai" ? "text-amber-300" : ""}>
                      {GEBEURTENIS_LABEL[t.titel as keyof typeof GEBEURTENIS_LABEL] ?? t.titel}
                      <span className="ml-2 text-xs text-slate-500">{t.detail}</span>
                    </span>
                    <span className="ml-auto text-xs text-slate-400">
                      {t.type === "ai" ? `${t.credits} cr · ${euro(t.kost)}` : ""}
                    </span>
                  </div>
                ))}
                {!m.tijdlijn.length ? <p className="text-slate-400">Nog geen activiteit.</p> : null}
              </div>
            </Kaart>
          </TabsContent>

          <TabsContent value="gebruik">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Recepten" waarde={(d.recepten ?? []).length} />
              <Kpi label="Favorieten" waarde={d.favorieten ?? 0} />
              <Kpi label="Ingeplande maaltijden" waarde={d.planning ?? 0} />
              <Kpi label="Boodschappenlijsten" waarde={d.lijsten ?? 0} />
              <Kpi label="Klantenkaarten" waarde={d.kaarten ?? 0} />
              <Kpi label="Connecties" waarde={m.connecties} extra={`${m.openUitnodigingen} open uitnodigingen`} />
              <Kpi label="Gezinnen" waarde={m.gezinnen.length} />
              <Kpi label="Fouten (30 d)" waarde={m.dertig.fouten} />
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <Kaart>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Functie</th>
                    <th>Oproepen</th>
                    <th>Credits</th>
                    <th className="text-right">Werkelijke kost</th>
                  </tr>
                </thead>
                <tbody>
                  {m.aiPerFeature.map((f) => (
                    <tr key={f.feature} className="border-t border-white/5">
                      <td className="py-2">{f.feature}</td>
                      <td>{f.aantal}</td>
                      <td>{f.credits}</td>
                      <td className="text-right">{euro(f.kost)}</td>
                    </tr>
                  ))}
                  {!m.aiPerFeature.length ? (
                    <tr>
                      <td className="py-3 text-slate-400" colSpan={4}>
                        Deze gebruiker gebruikte nog geen AI.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-400">
                Credits zijn de munt van de gebruiker. De kost in euro is wat de oproep ons werkelijk kost.
              </p>
            </Kaart>
          </TabsContent>

          <TabsContent value="connecties">
            <Kaart>
              <p className="text-sm">
                {m.connecties} actieve connecties · {m.openUitnodigingen} openstaande uitnodigingen
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {m.gezinnen.map((g: any) => (
                  <li key={g.group_id}>
                    Gezin {g.group_id.slice(0, 8)} · {g.rol} · {g.status}
                  </li>
                ))}
              </ul>
            </Kaart>
          </TabsContent>

          <TabsContent value="meldingen">
            <Kaart>
              <div className="space-y-1 text-sm">
                {m.meldingen.map((n: any, i: number) => (
                  <div key={i} className="flex gap-3 border-b border-white/5 py-1.5">
                    <span className="w-32 text-slate-400">{stip(n.created_at)}</span>
                    <span>{n.titel}</span>
                    <span className="ml-auto text-xs text-slate-400">{n.status}</span>
                  </div>
                ))}
                {!m.meldingen.length ? <p className="text-slate-400">Nog geen meldingen verstuurd.</p> : null}
              </div>
            </Kaart>
          </TabsContent>

          <TabsContent value="support">
            <Kaart>
              <div className="space-y-2 text-sm">
                {m.tickets.map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-white/10 p-3">
                    <p className="text-xs text-slate-400">
                      {stip(t.created_at)} · {t.kind} · {t.status}
                    </p>
                    <p>{t.message}</p>
                  </div>
                ))}
                {!m.tickets.length ? <p className="text-slate-400">Geen supportvragen.</p> : null}
              </div>
            </Kaart>
          </TabsContent>

          <TabsContent value="fouten">
            <Kaart>
              <div className="space-y-2 text-sm">
                {m.fouten.map((f: any, i: number) => (
                  <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs text-slate-400">
                      {stip(f.created_at)} · {f.soort} · {f.feature} · {f.path}
                    </p>
                    <p className="text-red-200">{f.bericht}</p>
                    {f.detail ? <pre className="mt-1 overflow-auto text-xs text-slate-400">{f.detail}</pre> : null}
                  </div>
                ))}
                {!m.fouten.length ? <p className="text-slate-400">Geen fouten geregistreerd.</p> : null}
              </div>
            </Kaart>
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
}
