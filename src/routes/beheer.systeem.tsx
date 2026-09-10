import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminSysteem } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/systeem")({ component: Systeem });

function Systeem() {
  const fn = useServerFn(adminSysteem);
  const { data, isLoading } = useQuery({ queryKey: ["admin-systeem"], queryFn: () => fn(), refetchInterval: 30_000 });

  return (
    <AdminShell titel="Systeem" omschrijving="Werkt alles nog naar behoren?">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { naam: "Database", ok: data.database.ok, detail: data.database.melding ?? `${data.database.ms} ms` },
              { naam: "AI", ok: data.ai.ok, detail: data.ai.melding ?? "Beschikbaar" },
              { naam: "Opslag", ok: data.opslag.ok, detail: data.opslag.melding ?? "Beschikbaar" },
            ].map((c) => (
              <Kaart key={c.naam}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                  <p className="text-sm font-medium">{c.naam}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">{c.detail}</p>
              </Kaart>
            ))}
          </div>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Recente fouten</p>
            {data.fouten.length === 0 ? (
              <p className="text-sm text-slate-400">Geen fouten in de laatste 24 uur.</p>
            ) : (
              <ul className="max-h-96 space-y-1 overflow-auto text-xs">
                {data.fouten.map((f: any) => (
                  <li key={f.id} className="border-b border-white/5 py-1">
                    <span className="text-red-300">{f.kind}</span> — {f.error}
                    <span className="ml-2 text-slate-500">{new Date(f.created_at).toLocaleString("nl-BE")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Kaart>
        </div>
      )}
    </AdminShell>
  );
}
