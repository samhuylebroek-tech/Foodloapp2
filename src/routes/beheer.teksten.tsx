import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAankondigingVerwijderen,
  adminAankondigingZetten,
  adminAankondigingen,
  adminTekstZetten,
  adminTeksten,
} from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/beheer/teksten")({ component: Teksten });

function Teksten() {
  const qc = useQueryClient();
  const tekstenFn = useServerFn(adminTeksten);
  const tekstZetFn = useServerFn(adminTekstZetten);
  const annFn = useServerFn(adminAankondigingen);
  const annZetFn = useServerFn(adminAankondigingZetten);
  const annWisFn = useServerFn(adminAankondigingVerwijderen);

  const teksten = useQuery({ queryKey: ["admin-teksten"], queryFn: () => tekstenFn() });
  const aankondigingen = useQuery({ queryKey: ["admin-aankondigingen"], queryFn: () => annFn() });

  const [concept, setConcept] = useState<Record<string, { title: string; body: string; published: boolean }>>({});
  const [nieuw, setNieuw] = useState({ title: "", body: "", level: "info" as const });

  const bewaar = useMutation({
    mutationFn: (v: { key: string; title: string; body: string; published: boolean }) => tekstZetFn({ data: v }),
    onSuccess: () => {
      toast.success("Tekst opgeslagen");
      qc.invalidateQueries({ queryKey: ["admin-teksten"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const annZet = useMutation({
    mutationFn: (v: any) => annZetFn({ data: v }),
    onSuccess: () => {
      toast.success("Aankondiging bijgewerkt");
      setNieuw({ title: "", body: "", level: "info" });
      qc.invalidateQueries({ queryKey: ["admin-aankondigingen"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell titel="Teksten & aankondigingen" omschrijving="Pas teksten in de app aan zonder code">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {(teksten.data ?? []).map((t: any) => {
            const c = concept[t.key] ?? { title: t.title, body: t.body, published: t.published };
            return (
              <Kaart key={t.key}>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t.key}</p>
                <Input
                  value={c.title}
                  onChange={(e) => setConcept((p) => ({ ...p, [t.key]: { ...c, title: e.target.value } }))}
                  className="mt-2 border-white/10 bg-slate-950 text-slate-100"
                />
                <Textarea
                  value={c.body}
                  rows={4}
                  onChange={(e) => setConcept((p) => ({ ...p, [t.key]: { ...c, body: e.target.value } }))}
                  className="mt-2 border-white/10 bg-slate-950 text-slate-100"
                />
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    Zichtbaar in de app
                    <Switch
                      checked={c.published}
                      onCheckedChange={(v) => setConcept((p) => ({ ...p, [t.key]: { ...c, published: v } }))}
                    />
                  </label>
                  <Button size="sm" onClick={() => bewaar.mutate({ key: t.key, ...c })}>
                    Opslaan
                  </Button>
                </div>
              </Kaart>
            );
          })}
        </div>

        <div className="space-y-4">
          <Kaart>
            <p className="mb-3 text-sm font-medium">Nieuwe aankondiging</p>
            <Input
              value={nieuw.title}
              onChange={(e) => setNieuw({ ...nieuw, title: e.target.value })}
              placeholder="Titel"
              className="border-white/10 bg-slate-950 text-slate-100"
            />
            <Textarea
              value={nieuw.body}
              rows={3}
              onChange={(e) => setNieuw({ ...nieuw, body: e.target.value })}
              placeholder="Bericht voor gebruikers"
              className="mt-2 border-white/10 bg-slate-950 text-slate-100"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["info", "waarschuwing", "onderhoud"] as const).map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={nieuw.level === l ? "default" : "secondary"}
                  onClick={() => setNieuw({ ...nieuw, level: l as any })}
                >
                  {l}
                </Button>
              ))}
              <Button
                size="sm"
                className="ml-auto"
                disabled={!nieuw.title.trim()}
                onClick={() => annZet.mutate({ id: null, ...nieuw, active: true, ends_at: null })}
              >
                Publiceren
              </Button>
            </div>
          </Kaart>

          {(aankondigingen.data ?? []).map((a: any) => (
            <Kaart key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-sm text-slate-300">{a.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.level} · {new Date(a.created_at).toLocaleDateString("nl-BE")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Switch
                    checked={a.active}
                    onCheckedChange={(v) =>
                      annZet.mutate({
                        id: a.id,
                        title: a.title,
                        body: a.body,
                        level: a.level,
                        active: v,
                        ends_at: a.ends_at,
                      })
                    }
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await annWisFn({ data: { id: a.id } });
                        toast.success("Verwijderd");
                        qc.invalidateQueries({ queryKey: ["admin-aankondigingen"] });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Wissen
                  </Button>
                </div>
              </div>
            </Kaart>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
