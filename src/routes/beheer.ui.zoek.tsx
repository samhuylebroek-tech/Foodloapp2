import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Kruimels, SubNav, stip } from "@/components/UserIntelligence";
import { uiZoek } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/zoek")({ component: Zoeken });

function Zoeken() {
  const [term, setTerm] = useState("");
  const fn = useServerFn(uiZoek);
  const q = useQuery({
    queryKey: ["ui-zoek", term],
    queryFn: () => fn({ data: { term } }),
    enabled: term.trim().length >= 2,
  });
  const d = q.data;

  return (
    <AdminShell titel="Zoeken" omschrijving="Zoek een gebruiker, recept, gezin of een ID van een sessie, actie of fout.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Zoeken" },
        ]}
      />
      <Input
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Naam, @handle, recept, gezin of ID…"
        className="mb-4 h-11 max-w-lg border-white/10 bg-slate-900 text-slate-100"
      />

      {term.trim().length < 2 ? (
        <p className="text-slate-400">Typ minstens twee tekens.</p>
      ) : q.isLoading ? (
        <p className="text-slate-400">Zoeken…</p>
      ) : !d ? (
        <p className="text-slate-400">Geen gegevens beschikbaar.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Gebruikers</h2>
            {d.gebruikers.length === 0 ? (
              <p className="text-sm text-slate-500">Geen treffers.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.gebruikers.map((g: any) => (
                  <li key={g.id}>
                    <Link to="/beheer/ui/gebruiker/$id" params={{ id: g.id }} className="text-emerald-300 hover:underline">
                      {g.display_name} {g.handle ? `@${g.handle}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Gezinnen</h2>
            {d.groepen.length === 0 ? (
              <p className="text-sm text-slate-500">Geen treffers.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.groepen.map((g: any) => (
                  <li key={g.id}>
                    <Link to="/beheer/ui/groep/$id" params={{ id: g.id }} className="text-emerald-300 hover:underline">
                      {g.naam}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Recepten</h2>
            {d.recepten.length === 0 ? (
              <p className="text-sm text-slate-500">Geen treffers.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.recepten.map((r: any) => (
                  <li key={r.id} className="flex gap-2">
                    <span className="text-slate-200">{r.title}</span>
                    <Link to="/beheer/ui/gebruiker/$id" params={{ id: r.user_id }} className="text-emerald-300 hover:underline">
                      eigenaar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Kaart>

          <Kaart>
            <h2 className="mb-2 text-sm font-semibold">Op ID gevonden</h2>
            <ul className="space-y-1 text-sm">
              {d.sessies.map((s: any) => (
                <li key={s.id}>
                  <Link to="/beheer/ui/sessie/$id" params={{ id: s.id }} className="text-sky-300 hover:underline">
                    Sessie van {stip(s.started_at)}
                  </Link>
                </li>
              ))}
              {d.events.map((e: any) => (
                <li key={e.id}>
                  <Link to="/beheer/ui/gebeurtenis/$id" params={{ id: e.id }} className="text-sky-300 hover:underline">
                    Gebeurtenis {e.event}
                  </Link>
                </li>
              ))}
              {d.fouten.map((f: any) => (
                <li key={f.id}>
                  <Link to="/beheer/ui/fout/$id" params={{ id: f.id }} className="text-sky-300 hover:underline">
                    Fout: {f.bericht}
                  </Link>
                </li>
              ))}
              {d.aiJobs.map((a: any) => (
                <li key={a.id}>
                  <Link to="/beheer/ui/ai-actie/$id" params={{ id: a.id }} className="text-sky-300 hover:underline">
                    AI-actie {a.feature} · {a.model}
                  </Link>
                </li>
              ))}
              {d.sessies.length + d.events.length + d.fouten.length + d.aiJobs.length === 0 ? (
                <li className="text-slate-500">Geen ID-treffers.</li>
              ) : null}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
