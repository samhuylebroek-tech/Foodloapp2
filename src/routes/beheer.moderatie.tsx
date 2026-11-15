import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { MELD_REDENEN } from "@/lib/makers";
import {
  moderatieBijdrageZichtbaar,
  moderatieCampagneBeslissen,
  moderatieMeldingAfsluiten,
  moderatieReceptBeslissen,
  moderatieWachtrij,
} from "@/lib/moderatie.functions";

export const Route = createFileRoute("/beheer/moderatie")({ component: Moderatie });

const SLEUTEL = ["admin-moderatie"];

function datum(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function redenLabel(r: string) {
  return MELD_REDENEN.find((x) => x.waarde === r)?.label ?? r;
}

/** Afwijzen vraagt altijd een korte reden (die komt in het auditlogboek). */
function AfwijsVeld({
  bezig,
  onAfwijzen,
}: {
  bezig: boolean;
  onAfwijzen: (reden: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  if (!open)
    return (
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        Afwijzen…
      </Button>
    );
  return (
    <div className="w-full space-y-2">
      <label className="block text-sm text-slate-300">
        Reden van afwijzen (de maker of partner krijgt die te zien)
        <textarea
          value={reden}
          onChange={(e) => setReden(e.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-slate-100"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={bezig || reden.trim().length < 3}
          onClick={() => onAfwijzen(reden.trim())}
        >
          Afwijzen bevestigen
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={() => setOpen(false)}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

function Moderatie() {
  const qc = useQueryClient();
  const wachtrijFn = useServerFn(moderatieWachtrij);
  const receptFn = useServerFn(moderatieReceptBeslissen);
  const bijdrageFn = useServerFn(moderatieBijdrageZichtbaar);
  const meldingFn = useServerFn(moderatieMeldingAfsluiten);
  const campagneFn = useServerFn(moderatieCampagneBeslissen);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SLEUTEL,
    queryFn: () => wachtrijFn(),
  });

  const klaar = (bericht: string) => {
    toast.success(bericht);
    void qc.invalidateQueries({ queryKey: SLEUTEL });
  };
  const fout = (e: Error) => toast.error(e.message);

  const recept = useMutation({
    mutationFn: (v: {
      publicatieId: string;
      besluit: "goedgekeurd" | "afgewezen";
      reden: string;
    }) => receptFn({ data: v }),
    onSuccess: (_, v) =>
      klaar(v.besluit === "goedgekeurd" ? "Goedgekeurd: het recept is nu openbaar." : "Afgewezen."),
    onError: fout,
  });
  const bijdrage = useMutation({
    mutationFn: (v: { bijdrageId: string; verborgen: boolean }) => bijdrageFn({ data: v }),
    onSuccess: (_, v) => klaar(v.verborgen ? "Bijdrage verborgen." : "Bijdrage teruggezet."),
    onError: fout,
  });
  const melding = useMutation({
    mutationFn: (v: { meldingId: string; status: "behandeld" | "afgewezen" }) =>
      meldingFn({ data: v }),
    onSuccess: () => klaar("Melding afgesloten."),
    onError: fout,
  });
  const campagne = useMutation({
    mutationFn: (v: { campagneId: string; besluit: "goedgekeurd" | "afgewezen"; reden: string }) =>
      campagneFn({ data: v }),
    onSuccess: (_, v) =>
      klaar(v.besluit === "goedgekeurd" ? "Campagne goedgekeurd." : "Campagne teruggestuurd."),
    onError: fout,
  });
  const bezig = recept.isPending || bijdrage.isPending || melding.isPending || campagne.isPending;

  return (
    <AdminShell
      titel="Moderatie"
      omschrijving="Openbare recepten, meldingen en partnercampagnes nakijken. Elke beslissing wordt gelogd."
    >
      {isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : isError || !data ? (
        <Kaart>
          <p className="font-medium">De wachtrij kon niet geladen worden.</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => void refetch()}>
            Opnieuw proberen
          </Button>
        </Kaart>
      ) : !data.beschikbaar ? (
        <Kaart>
          <p className="font-medium">Moderatie wordt binnenkort geactiveerd.</p>
          <p className="mt-1 text-sm text-slate-300">
            De tabellen voor makers en meldingen bestaan pas na migratievoorstel 0008.
          </p>
        </Kaart>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section aria-labelledby="mod-recepten" className="space-y-3">
            <h2 id="mod-recepten" className="text-lg font-semibold">
              Wacht op controle ({data.recepten.length})
            </h2>
            {!data.recepten.length ? (
              <Kaart>
                <p className="text-sm text-slate-300">Geen openbare recepten die wachten.</p>
              </Kaart>
            ) : (
              data.recepten.map((r) => (
                <Kaart key={r.publicatie_id}>
                  <article aria-label={r.titel} className="space-y-3">
                    <div>
                      <p className="font-medium">{r.titel}</p>
                      <p className="text-sm text-slate-400">
                        van {r.maker}
                        {r.handle ? ` (@${r.handle})` : ""} · ingediend {datum(r.gepubliceerd_op)}
                      </p>
                      <Link
                        to="/recepten/$id"
                        params={{ id: r.recipe_id }}
                        className="inline-flex min-h-11 items-center text-sm text-emerald-400 hover:underline"
                      >
                        Recept bekijken
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={bezig}
                        onClick={() =>
                          recept.mutate({
                            publicatieId: r.publicatie_id,
                            besluit: "goedgekeurd",
                            reden: "",
                          })
                        }
                      >
                        Goedkeuren
                      </Button>
                      <AfwijsVeld
                        bezig={bezig}
                        onAfwijzen={(reden) =>
                          recept.mutate({
                            publicatieId: r.publicatie_id,
                            besluit: "afgewezen",
                            reden,
                          })
                        }
                      />
                    </div>
                  </article>
                </Kaart>
              ))
            )}
          </section>

          <section aria-labelledby="mod-meldingen" className="space-y-3">
            <h2 id="mod-meldingen" className="text-lg font-semibold">
              Open meldingen ({data.meldingen.length})
            </h2>
            {!data.meldingen.length ? (
              <Kaart>
                <p className="text-sm text-slate-300">Geen open meldingen.</p>
              </Kaart>
            ) : (
              data.meldingen.map((m) => (
                <Kaart key={m.id}>
                  <article aria-label={`Melding: ${redenLabel(m.reden)}`} className="space-y-2">
                    <p className="font-medium">
                      {redenLabel(m.reden)}{" "}
                      <span className="text-sm font-normal text-slate-400">
                        · {m.soort} · {datum(m.created_at)}
                      </span>
                    </p>
                    {m.toelichting ? (
                      <p className="text-sm text-slate-300">“{m.toelichting}”</p>
                    ) : null}
                    {m.bijdrage ? (
                      <p className="rounded-lg border border-white/10 bg-slate-950/60 p-2 text-sm">
                        {m.bijdrage.weergavenaam ? `${m.bijdrage.weergavenaam}: ` : ""}
                        {m.bijdrage.tekst}
                        {m.bijdrage.verborgen ? (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-xs text-amber-200">
                            verborgen
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {m.receptTitel ? (
                      <p className="text-sm text-slate-300">Recept: {m.receptTitel}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {m.bijdrage ? (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={bezig}
                          onClick={() =>
                            bijdrage.mutate({
                              bijdrageId: m.doel_id,
                              verborgen: !m.bijdrage!.verborgen,
                            })
                          }
                        >
                          {m.bijdrage.verborgen ? "Bijdrage terugzetten" : "Bijdrage verbergen"}
                        </Button>
                      ) : null}
                      <Button
                        className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={bezig}
                        onClick={() => melding.mutate({ meldingId: m.id, status: "behandeld" })}
                      >
                        Afsluiten: behandeld
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11"
                        disabled={bezig}
                        onClick={() => melding.mutate({ meldingId: m.id, status: "afgewezen" })}
                      >
                        Afsluiten: niets aan de hand
                      </Button>
                    </div>
                  </article>
                </Kaart>
              ))
            )}
          </section>

          <section aria-labelledby="mod-campagnes" className="space-y-3 xl:col-span-2">
            <h2 id="mod-campagnes" className="text-lg font-semibold">
              Partnercampagnes ter goedkeuring ({data.campagnes.length})
            </h2>
            <p className="text-sm text-slate-400">
              Controleer of elk item duidelijk als commercieel gelabeld is en niets misleidend
              belooft. Allergieregels gelden ook voor gesponsorde recepten.
            </p>
            {!data.campagnesBeschikbaar ? (
              <Kaart>
                <p className="text-sm text-slate-300">
                  Partnercampagnes worden actief na migratievoorstel 0011.
                </p>
              </Kaart>
            ) : !data.campagnes.length ? (
              <Kaart>
                <p className="text-sm text-slate-300">Geen ingediende campagnes.</p>
              </Kaart>
            ) : (
              data.campagnes.map((c) => (
                <Kaart key={c.id}>
                  <article aria-label={`Campagne ${c.naam}`} className="space-y-2">
                    <p className="font-medium">
                      {c.naam}{" "}
                      <span className="text-sm font-normal text-slate-400">· {c.partner}</span>
                    </p>
                    {c.doel ? <p className="text-sm text-slate-300">Doel: {c.doel}</p> : null}
                    <p className="text-sm text-slate-400">
                      {c.start ?? "?"} tot {c.einde ?? "?"}
                    </p>
                    <ul className="list-disc pl-5 text-sm text-slate-200">
                      {c.items.length ? (
                        c.items.map((i, n) => (
                          <li key={n}>
                            {i.soort === "recept" ? "Recept" : "Product"}: {i.label} — label “
                            {i.label_tekst}”
                          </li>
                        ))
                      ) : (
                        <li>Nog geen gesponsorde items gekoppeld.</li>
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={bezig}
                        onClick={() =>
                          campagne.mutate({ campagneId: c.id, besluit: "goedgekeurd", reden: "" })
                        }
                      >
                        Campagne goedkeuren
                      </Button>
                      <AfwijsVeld
                        bezig={bezig}
                        onAfwijzen={(reden) =>
                          campagne.mutate({ campagneId: c.id, besluit: "afgewezen", reden })
                        }
                      />
                    </div>
                  </article>
                </Kaart>
              ))
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
