import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, Kaart, Kpi } from "@/components/AdminShell";
import {
  BccBinnenkort,
  BccFout,
  BccLaden,
  BccTestmodus,
  BevestigKnop,
  RedenKnop,
} from "@/components/beheer/BccDelen";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { klikratio, procent } from "@/lib/bcc";
import { bccCampagneBeslissen, bccCampagnes, type BccCampagne } from "@/lib/bcc.functions";
import { euro } from "@/lib/betalen/types";
import { korteDatum, STATUS_LABEL, type CampagneStatus } from "@/lib/partners";

export const Route = createFileRoute("/beheer/campagnes")({ component: Campagnes });

const SLEUTEL = ["bcc-campagnes"];
const getal = (n: number) => n.toLocaleString("nl-BE");

function Campagnes() {
  const { mag, alleenLezen } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(bccCampagnes);
  const beslisFn = useServerFn(bccCampagneBeslissen);
  const [partner, setPartner] = useState("alle");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SLEUTEL,
    queryFn: () => lijstFn(),
  });
  const beslis = useMutation({
    mutationFn: (v: {
      id: string;
      besluit: "goedgekeurd" | "afgewezen" | "beeindigd";
      reden: string;
    }) => beslisFn({ data: v }),
    onSuccess: (r, v) => {
      toast.success(
        v.besluit === "goedgekeurd"
          ? r.factuur
            ? `Campagne goedgekeurd. Testfactuur ${r.factuur} klaargezet (niets aangerekend).`
            : "Campagne goedgekeurd."
          : v.besluit === "afgewezen"
            ? "Campagne teruggestuurd naar de partner."
            : "Campagne beëindigd. Ze wordt niet meer getoond.",
      );
      void qc.invalidateQueries({ queryKey: SLEUTEL });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const magBeslissen = mag("partners.manage") && !alleenLezen;
  const alle = data?.campagnes ?? [];
  const partners = [...new Map(alle.map((c) => [c.partner_id, c.partner])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "nl"),
  );
  const lijst = alle.filter((c) => partner === "alle" || c.partner_id === partner);
  const v = lijst.reduce((s, c) => s + c.vertoningen, 0);
  const k = lijst.reduce((s, c) => s + c.klikken, 0);
  const budget = lijst.reduce((s, c) => s + c.testbudget_cent, 0);
  const wachtend = lijst.filter((c) => c.status === "ingediend");

  return (
    <AdminShell
      titel="Campagnes"
      omschrijving="Alle partnercampagnes met status, vertoningen en klikken (alleen dagtotalen, nooit wie)."
    >
      {isLoading ? (
        <BccLaden />
      ) : isError ? (
        <BccFout tekst="De campagnes konden niet geladen worden." opnieuw={() => void refetch()} />
      ) : !data?.beschikbaar ? (
        <BccBinnenkort wat="Het campagnebeheer" />
      ) : (
        <div className="space-y-4">
          <BccTestmodus>
            Budgetten zijn testbudgetten: er wordt niets aangerekend. Een goedgekeurde campagne met
            testbudget krijgt een testfactuur.
          </BccTestmodus>
          <label className="block max-w-sm text-sm text-slate-300">
            Partner
            <select
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-slate-100"
            >
              <option value="alle">Alle partners</option>
              {partners.map(([id, naam]) => (
                <option key={id} value={id}>
                  {naam}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Vertoningen" waarde={getal(v)} />
            <Kpi label="Klikken" waarde={getal(k)} />
            <Kpi label="Klikratio (CTR)" waarde={procent(klikratio(v, k))} />
            <Kpi label="Testbudget" waarde={euro(budget)} extra="niets aangerekend" />
          </div>
          {wachtend.length ? (
            <section aria-labelledby="wacht-titel" className="space-y-2">
              <h2 id="wacht-titel" className="text-base font-semibold">
                Wacht op goedkeuring ({wachtend.length})
              </h2>
              <ul className="space-y-3">
                {wachtend.map((c) => (
                  <li key={c.id}>
                    <CampagneKaart
                      c={c}
                      magBeslissen={magBeslissen}
                      bezig={beslis.isPending}
                      onBeslis={(besluit, reden) => beslis.mutate({ id: c.id, besluit, reden })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="alle-titel" className="space-y-2">
            <h2 id="alle-titel" className="text-base font-semibold">
              Alle campagnes ({lijst.length})
            </h2>
            {!lijst.length ? (
              <Kaart>
                <p className="text-slate-300">Nog geen campagnes.</p>
              </Kaart>
            ) : (
              <ul className="space-y-3">
                {lijst
                  .filter((c) => c.status !== "ingediend")
                  .map((c) => (
                    <li key={c.id}>
                      <CampagneKaart
                        c={c}
                        magBeslissen={magBeslissen}
                        bezig={beslis.isPending}
                        onBeslis={(besluit, reden) => beslis.mutate({ id: c.id, besluit, reden })}
                      />
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function CampagneKaart({
  c,
  magBeslissen,
  bezig,
  onBeslis,
}: {
  c: BccCampagne;
  magBeslissen: boolean;
  bezig: boolean;
  onBeslis: (besluit: "goedgekeurd" | "afgewezen" | "beeindigd", reden: string) => void;
}) {
  return (
    <article aria-label={`Campagne ${c.naam}`}>
      <Kaart className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">{c.naam}</h3>
            <p className="text-sm text-slate-400">{c.partner}</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
            {STATUS_LABEL[c.status as CampagneStatus] ?? c.status}
          </span>
        </div>
        <p className="text-sm text-slate-300">
          {korteDatum(c.start)} tot {korteDatum(c.einde)} · {c.items}{" "}
          {c.items === 1 ? "gesponsord item" : "gesponsorde items"}
          {c.testbudget_cent ? ` · testbudget ${euro(c.testbudget_cent)}` : ""}
        </p>
        {c.doel ? <p className="text-sm">Doel: {c.doel}</p> : null}
        <p className="text-sm" aria-label={`Cijfers van ${c.naam}`}>
          {getal(c.vertoningen)} vertoningen · {getal(c.klikken)} klikken · CTR{" "}
          {procent(c.klikratio)}
        </p>
        {magBeslissen && c.status === "ingediend" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              className="min-h-11"
              disabled={bezig}
              onClick={() => onBeslis("goedgekeurd", "")}
            >
              Campagne goedkeuren
            </Button>
            <RedenKnop
              label="Terugsturen…"
              bevestig="Terugsturen bevestigen"
              uitleg="Wat moet de partner aanpassen? (de partner krijgt dit te zien)"
              bezig={bezig}
              onBevestig={(reden) => onBeslis("afgewezen", reden)}
            />
          </div>
        ) : null}
        {magBeslissen && (c.status === "goedgekeurd" || c.status === "actief") ? (
          <BevestigKnop
            label="Campagne beëindigen…"
            vraag="De campagne wordt meteen niet meer getoond. Beëindigen?"
            bevestig="Ja, beëindigen"
            bezig={bezig}
            onBevestig={() => onBeslis("beeindigd", "")}
          />
        ) : null}
      </Kaart>
    </article>
  );
}
