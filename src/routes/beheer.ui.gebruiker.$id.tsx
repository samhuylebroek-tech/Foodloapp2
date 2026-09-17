import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kruimels, SubNav, duurTekst, euro, geleden, labelVan, stip } from "@/components/UserIntelligence";
import { uiGebruiker } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/gebruiker/$id")({ component: Gebruiker });

function Gebruiker() {
  const { id } = Route.useParams();
  const [zoek, setZoek] = useState("");
  const [feature, setFeature] = useState("");
  const [alleen, setAlleen] = useState<"" | "ai" | "fout">("");
  const fn = useServerFn(uiGebruiker);
  const q = useQuery({
    queryKey: ["ui-gebruiker", id, zoek, feature, alleen],
    queryFn: () =>
      fn({
        data: { id, zoek, feature, event: "", alleenAi: alleen === "ai", alleenFouten: alleen === "fout" },
      }),
  });
  const d = q.data;

  return (
    <AdminShell titel={d?.profiel?.display_name ?? "Gebruiker"} omschrijving="Volledig profiel: alles is aanklikbaar.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gebruikers", to: "/beheer/ui/gebruikers" },
          { label: d?.profiel?.display_name ?? "Gebruiker" },
        ]}
      />

      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : !d || !d.profiel ? (
        <p className="text-slate-400">Deze gebruiker bestaat niet meer.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Sessies" waarde={String(d.totalen.sessies)} />
            <Kpi label="Acties" waarde={String(d.totalen.events)} />
            <Kpi label="Actieve dagen" waarde={String(d.totalen.actieveDagen)} />
            <Kpi label="AI-acties" waarde={String(d.totalen.ai)} />
            <Kpi label="Credits gebruikt" waarde={String(d.totalen.creditsGebruikt)} extra={`saldo: ${d.saldo?.balance ?? 0}`} />
            <Kpi label="Kost (schatting)" waarde={euro(d.totalen.kost)} />
          </div>

          <Kaart className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">Laatst gezien</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Laatste login", d.laatstGezien.login],
                ["Laatste activiteit", d.laatstGezien.activiteit],
                ["Recepten", d.laatstGezien.recept],
                ["AI", d.laatstGezien.ai],
                ["Boodschappen", d.laatstGezien.boodschappen],
                ["Weekmenu", d.laatstGezien.weekmenu],
              ].map(([l, w]) => (
                <div key={l as string}>
                  <p className="text-xs uppercase text-slate-500">{l}</p>
                  <p className="text-slate-200">
                    {w ? `${geleden(w as string)} · ${stip(w as string)}` : "niet beschikbaar"}
                  </p>
                </div>
              ))}
            </div>
            {d.huidigeSessie ? (
              <p className="mt-2 text-sm text-emerald-300">
                Nu bezig —{" "}
                <Link to="/beheer/ui/sessie/$id" params={{ id: d.huidigeSessie.id }} className="underline">
                  volg deze sessie
                </Link>
              </p>
            ) : null}
          </Kaart>

          <Tabs defaultValue="tijdlijn" className="mt-4">
            <TabsList className="flex-wrap">
              {[
                ["tijdlijn", "Tijdlijn"],
                ["sessies", "Sessies"],
                ["functies", "Functiegebruik"],
                ["ai", "AI"],
                ["credits", "Credits"],
                ["fouten", "Fouten"],
                ["gezin", "Gezin & delen"],
              ].map(([w, l]) => (
                <TabsTrigger key={w} value={w}>
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="tijdlijn">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Zoek in de tijdlijn…"
                  defaultValue={zoek}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setZoek((e.target as HTMLInputElement).value);
                  }}
                  className="h-9 w-56 border-white/10 bg-slate-900 text-slate-100"
                />
                <select
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm"
                >
                  <option value="">Alle onderdelen</option>
                  {d.functies.map((f: any) => (
                    <option key={f.feature} value={f.feature}>
                      {f.feature}
                    </option>
                  ))}
                </select>
                {(["", "ai", "fout"] as const).map((w) => (
                  <Button key={w} size="sm" variant={alleen === w ? "default" : "ghost"} onClick={() => setAlleen(w)}>
                    {w === "" ? "Alles" : w === "ai" ? "Enkel AI" : "Enkel fouten"}
                  </Button>
                ))}
              </div>
              <ul className="divide-y divide-white/5">
                {d.tijdlijn.map((t: any) => (
                  <li key={`${t.soort}-${t.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="w-36 shrink-0 text-xs text-slate-500">{stip(t.tijd)}</span>
                    {t.soort === "event" ? (
                      <Link to="/beheer/ui/gebeurtenis/$id" params={{ id: t.id }} className="text-slate-100 hover:underline">
                        {labelVan(t.titel)}
                      </Link>
                    ) : t.soort === "ai" ? (
                      <Link to="/beheer/ui/ai-actie/$id" params={{ id: t.id }} className="text-sky-300 hover:underline">
                        {t.titel}
                      </Link>
                    ) : (
                      <Link to="/beheer/ui/fout/$id" params={{ id: t.id }} className="text-red-300 hover:underline">
                        {t.titel}
                      </Link>
                    )}
                    <span className="text-slate-400">{t.label ?? ""}</span>
                    {t.sessionId ? (
                      <Link
                        to="/beheer/ui/sessie/$id"
                        params={{ id: t.sessionId }}
                        className="text-xs text-slate-500 hover:text-sky-300"
                      >
                        sessie
                      </Link>
                    ) : null}
                  </li>
                ))}
                {d.tijdlijn.length === 0 ? <li className="py-3 text-slate-500">Geen activiteit gevonden.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="sessies">
              <ul className="divide-y divide-white/5 text-sm">
                {d.sessies.map((s: any) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link to="/beheer/ui/sessie/$id" params={{ id: s.id }} className="text-emerald-300 hover:underline">
                      {stip(s.started_at)}
                    </Link>
                    <span className="text-slate-400">
                      {duurTekst(s.duur)} · {s.device ?? "toestel onbekend"} · {s.browser ?? "—"} · v{s.app_version ?? "—"}
                      {s.einde_geschat ? " · einde geschat" : ""}
                    </span>
                  </li>
                ))}
                {d.sessies.length === 0 ? <li className="py-3 text-slate-500">Nog geen sessies geregistreerd.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="functies">
              <ul className="divide-y divide-white/5 text-sm">
                {d.functies.map((f: any) => (
                  <li key={f.feature} className="flex items-center justify-between py-2">
                    <span>{f.feature}</span>
                    <span className="text-slate-400">
                      {f.aantal}× · laatst {geleden(f.laatste)}
                    </span>
                  </li>
                ))}
                {d.functies.length === 0 ? <li className="py-3 text-slate-500">Nog geen functiegebruik.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="ai">
              <ul className="divide-y divide-white/5 text-sm">
                {d.ai.map((a: any) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link to="/beheer/ui/ai-actie/$id" params={{ id: a.id }} className="text-sky-300 hover:underline">
                      {a.feature} · {a.model}
                    </Link>
                    <span className="text-slate-400">
                      {a.credits} credits · {euro(a.kost_eur)} · {stip(a.created_at)}
                    </span>
                  </li>
                ))}
                {d.ai.length === 0 ? <li className="py-3 text-slate-500">Nog geen AI-gebruik.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="credits">
              <ul className="divide-y divide-white/5 text-sm">
                {d.credits.map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {c.type} {c.feature ? `· ${c.feature}` : ""}
                    </span>
                    <span className="text-slate-400">
                      {c.amount} · saldo {c.balance_after - c.amount} → {c.balance_after} · {stip(c.created_at)}
                    </span>
                  </li>
                ))}
                {d.credits.length === 0 ? <li className="py-3 text-slate-500">Nog geen creditbewegingen.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="fouten">
              <ul className="divide-y divide-white/5 text-sm">
                {d.fouten.map((f: any) => (
                  <li key={f.id} className="py-2">
                    <Link to="/beheer/ui/fout/$id" params={{ id: f.id }} className="text-red-300 hover:underline">
                      {f.bericht}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      {f.feature} · {stip(f.created_at)}
                    </span>
                  </li>
                ))}
                {d.fouten.length === 0 ? <li className="py-3 text-slate-500">Geen fouten geregistreerd.</li> : null}
              </ul>
            </TabsContent>

            <TabsContent value="gezin">
              <div className="grid gap-4 lg:grid-cols-2">
                <Kaart>
                  <h3 className="mb-2 text-sm font-semibold">Gezinnen</h3>
                  <ul className="text-sm">
                    {d.groepen.map((g: any) => (
                      <li key={g.group_id} className="py-1">
                        <Link to="/beheer/ui/groep/$id" params={{ id: g.group_id }} className="text-emerald-300 hover:underline">
                          Gezin bekijken
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">
                          {g.rol} · {g.status}
                        </span>
                      </li>
                    ))}
                    {d.groepen.length === 0 ? <li className="text-slate-500">Geen gezin.</li> : null}
                  </ul>
                </Kaart>
                <Kaart>
                  <h3 className="mb-2 text-sm font-semibold">Delen met vrienden</h3>
                  <ul className="text-sm">
                    {d.shares.map((s: any, n: number) => (
                      <li key={n} className="py-1 text-slate-300">
                        {s.owner_id === d.profiel.id ? "deelt met iemand" : "krijgt gedeeld"} · {s.status}
                      </li>
                    ))}
                    {d.shares.length === 0 ? <li className="text-slate-500">Deelt niets.</li> : null}
                  </ul>
                </Kaart>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AdminShell>
  );
}
