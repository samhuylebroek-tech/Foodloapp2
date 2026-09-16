import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminActiviteit, adminExportCsv, adminGebeurtenissen } from "@/lib/monitoring.functions";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bewaarCsv } from "@/lib/csv-download";
import { GEBEURTENISSEN, GEBEURTENIS_LABEL } from "@/lib/meten";

export const Route = createFileRoute("/beheer/activiteit")({ component: Activiteit });

type Bereik = "vandaag" | "gisteren" | "zeven" | "dertig" | "eigen";
const BEREIKEN: { waarde: Bereik; label: string }[] = [
  { waarde: "vandaag", label: "Vandaag" },
  { waarde: "gisteren", label: "Gisteren" },
  { waarde: "zeven", label: "Laatste 7 dagen" },
  { waarde: "dertig", label: "Laatste 30 dagen" },
  { waarde: "eigen", label: "Eigen periode" },
];

function euro(n: number) {
  return `€ ${n.toFixed(n < 1 ? 4 : 2)}`;
}

function uur(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Activiteit() {
  const [bereik, setBereik] = useState<Bereik>("vandaag");
  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");
  const [event, setEvent] = useState("");
  const [soort, setSoort] = useState<"alles" | "ai" | "fouten">("alles");

  const kpiFn = useServerFn(adminActiviteit);
  const stroomFn = useServerFn(adminGebeurtenissen);
  const exportFn = useServerFn(adminExportCsv);

  const params = { bereik, van: van || undefined, tot: tot || undefined };
  const overzicht = useQuery({
    queryKey: ["admin-activiteit", bereik, van, tot],
    queryFn: () => kpiFn({ data: params }),
    refetchInterval: bereik === "vandaag" ? 60_000 : false,
  });
  const stroom = useQuery({
    queryKey: ["admin-stroom", bereik, van, tot, event, soort],
    queryFn: () => stroomFn({ data: { ...params, event, soort, limiet: 100 } }),
    refetchInterval: bereik === "vandaag" ? 30_000 : false,
  });

  const max = Math.max(1, ...(overzicht.data?.grafiek ?? []).map((g) => Math.max(g.actief, g.recepten, g.ai)));
  const k = overzicht.data?.kpi;

  return (
    <AdminShell
      titel="Activiteit"
      omschrijving="Wat is er vandaag gebeurd?"
      acties={
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await exportFn({ data: { soort: "activiteit" } });
            bewaarCsv(r.bestand, r.inhoud);
            toast.success("Bestand gedownload");
          }}
        >
          Exporteer CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {BEREIKEN.map((b) => (
            <button
              key={b.waarde}
              type="button"
              onClick={() => setBereik(b.waarde)}
              aria-pressed={bereik === b.waarde}
              className={`rounded-full px-3 py-1.5 text-sm ${
                bereik === b.waarde ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-300"
              }`}
            >
              {b.label}
            </button>
          ))}
          {bereik === "eigen" ? (
            <span className="flex items-center gap-2">
              <Input type="date" value={van} onChange={(e) => setVan(e.target.value)} className="h-9 w-40" />
              <Input type="date" value={tot} onChange={(e) => setTot(e.target.value)} className="h-9 w-40" />
            </span>
          ) : null}
        </div>

        {!k ? (
          <p className="text-slate-400">Laden…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Actieve gebruikers" waarde={k.actieveGebruikers} />
              <Kpi label="Nieuwe gebruikers" waarde={k.nieuweGebruikers} />
              <Kpi label="Sessies" waarde={k.sessies} extra={`${k.handelingen} handelingen`} />
              <Kpi label="Nieuwe recepten" waarde={k.nieuweRecepten} extra={`${k.imports} geïmporteerd`} />
              <Kpi label="Weekmenu-items" waarde={k.weekmenus} />
              <Kpi label="Boodschappenlijsten" waarde={k.lijsten} />
              <Kpi label="AI-oproepen" waarde={k.aiCalls} extra={`${k.credits} credits`} />
              <Kpi label="AI-kosten" waarde={euro(k.kostEur)} extra={`${euro(k.kostPerActieve)} per actieve gebruiker`} />
            </div>

            <Kaart>
              <p className="mb-3 text-sm font-medium">Per dag</p>
              <div className="flex h-36 items-end gap-1">
                {(overzicht.data?.grafiek ?? []).map((g) => (
                  <div
                    key={g.dag}
                    className="flex flex-1 items-end gap-0.5"
                    title={`${g.dag}: ${g.actief} actief · ${g.recepten} recepten · ${g.ai} AI · ${euro(g.kost)}`}
                  >
                    <div className="w-full rounded-t bg-sky-400/70" style={{ height: `${(g.actief / max) * 100}%` }} />
                    <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(g.recepten / max) * 100}%` }} />
                    <div className="w-full rounded-t bg-amber-400/70" style={{ height: `${(g.ai / max) * 100}%` }} />
                  </div>
                ))}
              </div>
              <p className="mt-2 flex gap-3 text-xs text-slate-400">
                <span>◼ blauw: actieve gebruikers</span>
                <span>◼ groen: recepten</span>
                <span>◼ geel: AI</span>
              </p>
            </Kaart>
          </>
        )}

        <Kaart>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Gebeurtenissen</p>
            <select
              value={soort}
              onChange={(e) => setSoort(e.target.value as typeof soort)}
              className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-sm"
            >
              <option value="alles">Alles</option>
              <option value="ai">Alleen AI</option>
              <option value="fouten">Alleen fouten</option>
            </select>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-sm"
            >
              <option value="">Alle functies</option>
              {GEBEURTENISSEN.map((g) => (
                <option key={g} value={g}>
                  {GEBEURTENIS_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {(stroom.data ?? []).map((r, i) => (
                  <tr key={`${r.tijd}-${i}`} className="border-b border-white/5">
                    <td className="w-32 py-1.5 text-slate-400">{uur(r.tijd)}</td>
                    <td className="w-40 py-1.5">
                      {r.user_id ? (
                        <Link to="/beheer/gebruiker/$id" params={{ id: r.user_id }} className="text-emerald-300 hover:underline">
                          {r.naam}
                        </Link>
                      ) : (
                        r.naam
                      )}
                    </td>
                    <td className="py-1.5">
                      <span className={r.type === "fout" ? "text-red-300" : r.type === "ai" ? "text-amber-300" : ""}>
                        {GEBEURTENIS_LABEL[r.titel as keyof typeof GEBEURTENIS_LABEL] ?? r.titel}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">{r.detail}</span>
                    </td>
                    <td className="w-32 py-1.5 text-right text-xs text-slate-400">
                      {r.type === "ai" ? `${r.credits} cr · ${euro(r.kost ?? 0)}` : ""}
                    </td>
                  </tr>
                ))}
                {!stroom.isLoading && !(stroom.data ?? []).length ? (
                  <tr>
                    <td className="py-4 text-slate-400">Geen gebeurtenissen in deze periode.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Kaart>
      </div>
    </AdminShell>
  );
}
