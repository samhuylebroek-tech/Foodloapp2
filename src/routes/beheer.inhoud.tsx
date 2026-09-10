import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminHernoemCategorie, adminHernoemTag, adminTaxonomie } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/inhoud")({ component: Inhoud });

function Inhoud() {
  const qc = useQueryClient();
  const taxFn = useServerFn(adminTaxonomie);
  const catFn = useServerFn(adminHernoemCategorie);
  const tagFn = useServerFn(adminHernoemTag);
  const { data, isLoading } = useQuery({ queryKey: ["admin-taxonomie"], queryFn: () => taxFn() });

  const [bewerk, setBewerk] = useState<{ soort: "cat" | "tag"; van: string; naar: string } | null>(null);

  const opslaan = useMutation({
    mutationFn: async () => {
      if (!bewerk) return;
      if (bewerk.soort === "cat") await catFn({ data: { van: bewerk.van, naar: bewerk.naar } });
      else await tagFn({ data: { van: bewerk.van, naar: bewerk.naar } });
    },
    onSuccess: () => {
      toast.success("Bijgewerkt");
      setBewerk(null);
      qc.invalidateQueries({ queryKey: ["admin-taxonomie"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const Blok = ({ titel, soort, items }: { titel: string; soort: "cat" | "tag"; items: { naam: string; aantal: number }[] }) => (
    <Kaart>
      <p className="mb-3 text-sm font-medium">{titel}</p>
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.naam} className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/5">
            <span>
              {i.naam} <span className="text-xs text-slate-500">({i.aantal})</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setBewerk({ soort, van: i.naam, naar: i.naam })}>
              Hernoemen
            </Button>
          </li>
        ))}
      </ul>
    </Kaart>
  );

  return (
    <AdminShell titel="Inhoud & labels" omschrijving="Categorieën en labels van alle recepten opschonen">
      {isLoading || !data ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Blok titel="Categorieën" soort="cat" items={data.categorieen} />
          <Blok titel="Labels" soort="tag" items={data.tags} />
        </div>
      )}

      {bewerk ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-5 text-slate-100">
            <p className="text-sm font-medium">"{bewerk.van}" hernoemen</p>
            <p className="mt-1 text-xs text-slate-400">
              Dit past alle recepten aan. {bewerk.soort === "tag" ? "Laat leeg om het label te verwijderen." : ""}
            </p>
            <Input
              autoFocus
              value={bewerk.naar}
              onChange={(e) => setBewerk({ ...bewerk, naar: e.target.value })}
              className="mt-3 border-white/10 bg-slate-950 text-slate-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBewerk(null)}>
                Annuleren
              </Button>
              <Button onClick={() => opslaan.mutate()} disabled={opslaan.isPending}>
                Toepassen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
