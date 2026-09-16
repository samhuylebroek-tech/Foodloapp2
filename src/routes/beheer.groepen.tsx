import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminExportCsv, adminGroepen } from "@/lib/monitoring.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { bewaarCsv } from "@/lib/csv-download";

export const Route = createFileRoute("/beheer/groepen")({ component: Groepen });

function Groepen() {
  const fn = useServerFn(adminGroepen);
  const exportFn = useServerFn(adminExportCsv);
  const { data, isLoading } = useQuery({ queryKey: ["admin-groepen"], queryFn: () => fn() });

  return (
    <AdminShell
      titel="Gezinnen & groepen"
      omschrijving="Wie werkt er samen in de keuken?"
      acties={
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await exportFn({ data: { soort: "groepen" } });
            bewaarCsv(r.bestand, r.inhoud);
            toast.success("Bestand gedownload");
          }}
        >
          Exporteer CSV
        </Button>
      }
    >
      <Kaart>
        {isLoading ? (
          <p className="text-slate-400">Laden…</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Gezin</th>
                  <th>Leden</th>
                  <th>Actief</th>
                  <th>Laatste activiteit</th>
                  <th>Recepten</th>
                  <th>Weekmenu</th>
                  <th>Lijsten</th>
                  <th>AI</th>
                  <th>Credits</th>
                  <th className="text-right">Kost</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((g) => (
                  <tr key={g.id} className="border-t border-white/5">
                    <td className="py-2 font-medium">{g.naam}</td>
                    <td>{g.leden}</td>
                    <td>{g.actieveLeden}</td>
                    <td className="text-slate-400">{g.laatsteActiviteit ?? "—"}</td>
                    <td>{g.recepten}</td>
                    <td>{g.weekmenuItems}</td>
                    <td>{g.lijsten}</td>
                    <td>{g.aiCalls}</td>
                    <td>{g.credits}</td>
                    <td className="text-right">€ {g.kostEur.toFixed(4)}</td>
                  </tr>
                ))}
                {!(data ?? []).length ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={10}>
                      Er zijn nog geen gezinnen.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Kaart>
    </AdminShell>
  );
}
