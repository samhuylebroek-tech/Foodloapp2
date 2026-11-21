import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkX, Globe, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { ReceptRaster } from "@/components/makers/MakerOnderdelen";
import { VerzamelingBeheer } from "@/components/makers/VerzamelingBeheer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  haalBronnen,
  haalMijnMaker,
  haalVerzameling,
  verwijderVerzameling,
  wijzigVerzameling,
  zichtbareReceptenIn,
} from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { useMakerRechten } from "@/lib/betalen/useMakerRechten";
import { haalMakerPlan, MAKER_PLAN_SLEUTEL } from "@/components/makers/MakerAbonnees";

export const Route = createFileRoute("/verzamelingen/$id")({
  head: () => ({
    meta: [
      { title: "Verzameling – Foodlo" },
      { name: "description", content: "Recepten die samen horen, in één verzameling." },
    ],
  }),
  component: VerzamelingPagina,
});

function VerzamelingPagina() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { beschikbaar, laden } = useModuleBeschikbaar("collections");
  const [hernoem, setHernoem] = useState(false);
  const [naam, setNaam] = useState("");

  const vQ = useQuery({
    queryKey: ["verzameling", id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalVerzameling(id),
  });
  const v = vQ.data ?? null;
  const eigen = !!v && v.user_id === user?.id;
  // Fase 4: exclusieve collectie van een maker — alleen voor abonnees (testmodus).
  const rechten = useMakerRechten();
  const { data: maker = null } = useQuery({
    queryKey: ["maker-van", v?.user_id],
    enabled: !!v && (!!v.exclusief || eigen),
    queryFn: () => haalMijnMaker(v!.user_id),
  });
  const { data: plan = null } = useQuery({
    queryKey: [MAKER_PLAN_SLEUTEL, maker?.id],
    enabled: eigen && !!maker,
    queryFn: () => haalMakerPlan(maker!.id).catch(() => null),
  });
  const opslot = !!v?.exclusief && !eigen && !(maker && rechten.magMaker(maker.id));
  // Tweede laag naast RLS: een privéverzameling van iemand anders nooit tonen.
  const zichtbaar = !!v && (eigen || v.openbaar) && !opslot;
  useEffect(() => setNaam(v?.naam ?? ""), [v?.naam]);

  const { data: recepten = [], isLoading: receptenLaden } = useQuery({
    queryKey: [
      "verzameling-recepten",
      id,
      (v?.collection_recipes ?? []).map((r) => r.recipe_id).join(","),
    ],
    enabled: zichtbaar,
    queryFn: () => zichtbareReceptenIn(v!),
  });
  const { data: bronnen } = useQuery({
    queryKey: ["bronnen", recepten.map((r) => r.id).join(",")],
    enabled: recepten.length > 0,
    queryFn: () => haalBronnen(recepten.map((r) => r.id)),
  });

  if (laden || (beschikbaar && (vQ.isLoading || !user))) {
    return (
      <AppShell title="Verzameling">
        <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      </AppShell>
    );
  }
  if (!beschikbaar) {
    return (
      <AppShell title="Verzameling">
        <ModuleNietBeschikbaar
          naam="Verzamelingen"
          terugNaar="/gerechten"
          terugLabel="Terug naar Keuken"
        />
      </AppShell>
    );
  }
  if (v && opslot) {
    return (
      <AppShell title={v.naam}>
        <EmptyState
          icon={<Lock />}
          title="Deze collectie is voor abonnees"
          description={`${maker?.naam ?? "Deze maker"} deelt deze collectie alleen met abonnees. In testmodus kan je abonneren zonder dat er iets aangerekend wordt.`}
          action={
            maker ? (
              <Button asChild className="h-14 w-full text-base">
                <Link to="/makers/$handle" params={{ handle: maker.handle }}>
                  Bekijk het abonnement
                </Link>
              </Button>
            ) : undefined
          }
        />
      </AppShell>
    );
  }
  if (!v || !zichtbaar) {
    return (
      <AppShell title="Verzameling">
        <EmptyState
          title="Deze verzameling bestaat niet (meer)"
          description="Ze is misschien verwijderd of niet meer gedeeld."
          action={
            <Button asChild variant="outline" className="h-14 w-full text-base">
              <Link to="/gerechten">Naar je Keuken</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  async function bewaarNaam() {
    const n = naam.trim();
    if (!n) return;
    await wijzigVerzameling(v!.id, { naam: n.slice(0, 60) });
    await qc.invalidateQueries({ queryKey: ["verzameling", id] });
    await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
    setHernoem(false);
    toast.success("Naam bewaard");
  }

  async function zetOpenbaar(aan: boolean) {
    await wijzigVerzameling(v!.id, { openbaar: aan });
    await qc.invalidateQueries({ queryKey: ["verzameling", id] });
    await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
    toast.success(aan ? "Openbaar op je makerpagina (alleen openbare recepten)" : "Weer privé");
  }

  async function zetExclusief(aan: boolean) {
    await wijzigVerzameling(v!.id, { exclusief: aan });
    await qc.invalidateQueries({ queryKey: ["verzameling", id] });
    toast.success(aan ? "Alleen voor je abonnees" : "Weer voor iedereen die je pagina bekijkt");
  }

  async function verwijder() {
    try {
      const zetTerug = await verwijderVerzameling(v!);
      await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
      void navigate({ to: "/gerechten" });
      toast.success(`"${v!.naam}" verwijderd. Je recepten blijven staan.`, {
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void zetTerug().then(async () => {
              await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
              await qc.invalidateQueries({ queryKey: ["verzameling", id] });
              toast.success("Verzameling teruggezet");
            }),
        },
      });
    } catch {
      toast.error("Verwijderen lukte niet.");
    }
  }

  return (
    <AppShell
      title={v.naam}
      ondertitel={`${recepten.length} ${recepten.length === 1 ? "recept" : "recepten"}${eigen ? "" : " · gedeeld door een maker"}`}
      breed
    >
      <div className="space-y-5">
        {eigen ? (
          <div className="paneel space-y-3 p-4">
            {hernoem ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void bewaarNaam();
                }}
              >
                <div className="min-w-0 flex-1 basis-48 space-y-1">
                  <Label htmlFor="verz-naam" className="text-base">
                    Naam
                  </Label>
                  <Input
                    id="verz-naam"
                    value={naam}
                    maxLength={60}
                    onChange={(e) => setNaam(e.target.value)}
                    className="h-14 text-base"
                  />
                </div>
                <Button type="submit" className="h-14 px-5 text-base">
                  Bewaren
                </Button>
              </form>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {!hernoem ? (
                <Button
                  variant="outline"
                  onClick={() => setHernoem(true)}
                  className="h-14 px-4 text-base"
                >
                  <Pencil aria-hidden />
                  Naam wijzigen
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void verwijder()}
                className="h-14 px-4 text-base text-destructive"
              >
                <Trash2 aria-hidden />
                Verzameling verwijderen
              </Button>
            </div>
            <div className="flex min-h-14 items-center justify-between gap-3">
              <Label htmlFor="verz-openbaar" className="flex min-w-0 items-center gap-2 text-base">
                {v.openbaar ? (
                  <Globe className="size-5 shrink-0" aria-hidden />
                ) : (
                  <Lock className="size-5 shrink-0" aria-hidden />
                )}
                Tonen op mijn makerpagina
              </Label>
              <Switch
                id="verz-openbaar"
                checked={v.openbaar}
                onCheckedChange={(aan) => void zetOpenbaar(aan)}
              />
            </div>
            {v.openbaar && (plan?.actief || v.exclusief) ? (
              <div className="flex min-h-14 items-center justify-between gap-3">
                <Label htmlFor="verz-exclusief" className="text-base">
                  Alleen voor abonnees (testmodus)
                </Label>
                <Switch
                  id="verz-exclusief"
                  checked={!!v.exclusief}
                  onCheckedChange={(aan) => void zetExclusief(aan)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {receptenLaden ? (
          <div className="h-40 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
        ) : recepten.length && eigen ? (
          <VerzamelingBeheer v={v} recepten={recepten} bron={(r) => bronnen?.get(r.id)?.maker} />
        ) : recepten.length ? (
          <ReceptRaster
            recepten={recepten}
            label={v.naam}
            bron={(r) => bronnen?.get(r.id)?.maker}
          />
        ) : (
          <EmptyState
            icon={<BookmarkX />}
            title="Nog leeg"
            description='Open een recept (ook in Ontdek) en tik op "Bewaar in…" om het hier te bewaren.'
            action={
              eigen ? (
                <Button asChild variant="outline" className="h-14 w-full text-base">
                  <Link to="/inspiratie">Naar Ontdek</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </AppShell>
  );
}
