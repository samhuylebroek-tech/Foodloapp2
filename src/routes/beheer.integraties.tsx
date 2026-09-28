import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminIntegraties } from "@/lib/finance.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/integraties")({ component: Integraties });

function Integraties() {
  const fn = useServerFn(adminIntegraties);
  const q = useQuery({ queryKey: ["integraties"], queryFn: () => fn() });
  return (
    <AdminShell titel="Integraties" omschrijving="Welke externe diensten zijn gekoppeld — nooit meer dan echt zo is.">
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data ?? []).map((i) => (
          <Kaart key={i.naam}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{i.naam}</p>
                <p className="text-xs text-slate-400">{i.type} · {i.data}</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs ${i.gekoppeld ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                {i.gekoppeld ? "Gekoppeld" : "Niet gekoppeld"}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Laatste activiteit: {i.laatste ? new Date(i.laatste).toLocaleString("nl-BE") : "—"}
              {i.fouten ? ` · ${i.fouten} fouten (24 u)` : ""}
            </p>
          </Kaart>
        ))}
        {q.isLoading ? <p className="text-slate-400">Laden…</p> : null}
      </div>
    </AdminShell>
  );
}
