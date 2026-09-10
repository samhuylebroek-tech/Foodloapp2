import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminReceptActie, adminRecepten } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/recepten")({ component: ReceptenBeheer });

type Status = "actief" | "verwijderd" | "alles";

function ReceptenBeheer() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(adminRecepten);
  const actieFn = useServerFn(adminReceptActie);
  const [zoek, setZoek] = useState("");
  const [status, setStatus] = useState<Status>("actief");
  const [pagina, setPagina] = useState(0);

  const lijst = useQuery({
    queryKey: ["admin-recepten", zoek, status, pagina],
    queryFn: () => lijstFn({ data: { zoek, status, pagina } }),
  });

  const actie = useMutation({
    mutationFn: (v: { id: string; actie: "verwijder" | "herstel" }) =>
      actieFn({ data: { id: v.id, actie: v.actie, reden: "" } }),
    onSuccess: () => {
      toast.success("Bijgewerkt");
      qc.invalidateQueries({ queryKey: ["admin-recepten"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell titel="Recepten" omschrijving="Alle recepten van het platform">
      <Kaart>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
              setPagina(0);
            }}
            placeholder="Zoek op titel"
            className="max-w-xs border-white/10 bg-slate-950 text-slate-100"
          />
          {(["actief", "verwijderd", "alles"] as Status[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "secondary"}
              onClick={() => {
                setStatus(s);
                setPagina(0);
              }}
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Titel</th>
                <th>Eigenaar</th>
                <th>Type</th>
                <th>Bron</th>
                <th>Toegevoegd</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(lijst.data?.rijen ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className={`py-2 ${r.deleted_at ? "text-slate-500 line-through" : ""}`}>{r.title}</td>
                  <td className="text-slate-400">{r.eigenaar}</td>
                  <td className="text-slate-400">{r.category}</td>
                  <td className="text-slate-400">{r.source_url ? "import" : "handmatig"}</td>
                  <td className="text-slate-400">{new Date(r.created_at).toLocaleDateString("nl-BE")}</td>
                  <td className="text-right">
                    {mag("recipes.manage") ? (
                      <Button
                        size="sm"
                        variant={r.deleted_at ? "secondary" : "destructive"}
                        onClick={() => actie.mutate({ id: r.id, actie: r.deleted_at ? "herstel" : "verwijder" })}
                      >
                        {r.deleted_at ? "Herstellen" : "Verwijderen"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{lijst.data?.totaal ?? 0} recepten</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Vorige
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={(pagina + 1) * (lijst.data?.perPagina ?? 25) >= (lijst.data?.totaal ?? 0)}
              onClick={() => setPagina((p) => p + 1)}
            >
              Volgende
            </Button>
          </div>
        </div>
      </Kaart>
    </AdminShell>
  );
}
