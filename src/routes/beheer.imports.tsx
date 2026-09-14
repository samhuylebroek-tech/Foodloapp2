import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminImports } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";

export const Route = createFileRoute("/beheer/imports")({ component: ImportBeheer });

const LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  pinterest: "Pinterest",
  website: "Websites",
};

const STATUS: Record<string, string> = {
  klaar: "volledig",
  gedeeltelijk: "gedeeltelijk",
  dubbel: "al bekend",
  mislukt: "mislukt",
};

function ImportBeheer() {
  const fn = useServerFn(adminImports);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-imports"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <AdminShell
      titel="Importcentrum"
      omschrijving="Hoe goed de linkimport werkt per platform, en wat hij kost"
    >
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Imports (30 dagen)", waarde: data.totaal, extra: `${data.vandaag} vandaag` },
              { label: "Mislukt", waarde: data.mislukt, extra: `${data.gedeeltelijk} gedeeltelijk` },
              { label: "Credits gebruikt", waarde: data.credits, extra: `${data.gratisPercentage}% zonder AI` },
              { label: "Cache-trefkans", waarde: `${data.cachePercentage}%`, extra: "gratis herhaling" },
            ].map((k) => (
              <Kaart key={k.label}>
                <p className="text-xs uppercase tracking-wide text-slate-400">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold">{k.waarde}</p>
                <p className="text-xs text-slate-400">{k.extra}</p>
              </Kaart>
            ))}
          </div>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Per platform</p>
            {data.perPlatform.length === 0 ? (
              <p className="text-slate-400">Nog geen imports gemeten.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Platform</th>
                    <th>Totaal</th>
                    <th>Volledig</th>
                    <th>Gedeeltelijk</th>
                    <th>Mislukt</th>
                    <th>Al bekend</th>
                    <th>Credits</th>
                    <th>Gem. tijd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perPlatform.map((p) => (
                    <tr key={p.platform} className="border-t border-white/5">
                      <td className="py-2">{LABEL[p.platform] ?? p.platform}</td>
                      <td>{p.totaal}</td>
                      <td className="text-emerald-300">{p.klaar}</td>
                      <td className="text-amber-300">{p.gedeeltelijk}</td>
                      <td className={p.mislukt ? "text-red-300" : "text-slate-400"}>{p.mislukt}</td>
                      <td className="text-slate-400">{p.dubbel}</td>
                      <td className="text-slate-400">{p.credits}</td>
                      <td className="text-slate-400">{p.gemiddeldMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Kaart>

          <Kaart>
            <p className="mb-3 text-sm font-medium">Laatste pogingen</p>
            <ul className="max-h-96 space-y-1 overflow-auto text-xs">
              {data.recent.map((r: any) => (
                <li key={r.id} className="flex justify-between gap-3 border-b border-white/5 py-1">
                  <span className={r.status === "mislukt" ? "text-red-300" : "text-slate-300"}>
                    {LABEL[r.platform] ?? r.platform} · {STATUS[r.status] ?? r.status}
                    {r.extraction_method ? ` · ${r.extraction_method}` : ""}
                    {r.error_message ? ` · ${r.error_message}` : ""}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {r.credits_used} credits · {new Date(r.created_at).toLocaleString("nl-BE")}
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
