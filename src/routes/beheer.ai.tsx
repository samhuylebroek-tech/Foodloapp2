import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAi } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/ai")({ component: AiBeheer });

function AiBeheer() {
  const fn = useServerFn(adminAi);
  const { data, isLoading } = useQuery({ queryKey: ["admin-ai"], queryFn: () => fn(), refetchInterval: 30_000 });

  return (
    <AdminShell titel="AI & import" omschrijving="Kwaliteit en betrouwbaarheid van de AI-functies">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {data.samenvatting.map((s) => (
              <Kaart key={s.kind}>
                <p className="text-xs uppercase tracking-wide text-slate-400">{s.kind}</p>
                <p className="mt-1 text-2xl font-semibold">{s.totaal}</p>
                <p className="text-xs text-slate-400">
                  {s.fouten} fouten · gem. {s.gemiddeldMs} ms
                </p>
              </Kaart>
            ))}
            {data.samenvatting.length === 0 ? <p className="text-slate-400">Nog geen AI-gebruik gemeten.</p> : null}
          </div>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Laatste imports — nakijken op kwaliteit</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Recept</th>
                  <th>Bron</th>
                  <th>Stappen</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((r: any) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2">{r.title}</td>
                    <td className="max-w-[220px] truncate text-slate-400">{r.source_url}</td>
                    <td className={r.verdacht ? "text-amber-300" : "text-slate-400"}>
                      {r.stappen}
                      {r.verdacht ? " · nakijken" : ""}
                    </td>
                    <td className="text-slate-400">{new Date(r.created_at).toLocaleDateString("nl-BE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Recente AI-oproepen</p>
            <ul className="max-h-80 space-y-1 overflow-auto text-xs">
              {data.events.map((e: any) => (
                <li key={e.id} className="flex justify-between gap-3 border-b border-white/5 py-1">
                  <span className={e.ok ? "text-slate-300" : "text-red-300"}>
                    {e.kind} · {e.ok ? "ok" : e.error}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {e.duration_ms} ms · {new Date(e.created_at).toLocaleString("nl-BE")}
                  </span>
                </li>
              ))}
            </ul>
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
