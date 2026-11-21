import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, Kaart } from "@/components/AdminShell";
import {
  BccBinnenkort,
  BccFout,
  BccLaden,
  datumTijd,
  RedenKnop,
} from "@/components/beheer/BccDelen";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { AANVRAAG_STATUS } from "@/lib/bcc";
import { bccAanvraagBeslissen, bccAanvragen, type BccAanvraag } from "@/lib/bcc.functions";
import { PARTNER_SOORTEN } from "@/lib/partners";

export const Route = createFileRoute("/beheer/partners")({ component: Partneraanvragen });

const SLEUTEL = ["bcc-aanvragen"];

function soortLabel(s: string) {
  return PARTNER_SOORTEN.find((x) => x.waarde === s)?.label ?? s;
}

function Partneraanvragen() {
  const { mag, alleenLezen } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(bccAanvragen);
  const beslisFn = useServerFn(bccAanvraagBeslissen);
  const [filter, setFilter] = useState<"open" | "alle">("open");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SLEUTEL,
    queryFn: () => lijstFn(),
  });
  const beslis = useMutation({
    mutationFn: (v: { id: string; besluit: "goedgekeurd" | "geweigerd"; reden: string }) =>
      beslisFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(
        v.besluit === "goedgekeurd"
          ? "Aanvraag goedgekeurd. De partner kan nu inloggen in de partneromgeving."
          : "Aanvraag afgewezen. De aanvrager ziet je reden.",
      );
      void qc.invalidateQueries({ queryKey: SLEUTEL });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const magBeslissen = mag("partners.manage") && !alleenLezen;
  const aanvragen = (data?.aanvragen ?? []).filter(
    (a) => filter === "alle" || a.status === "nieuw" || a.status === "in_behandeling",
  );
  const open = (data?.aanvragen ?? []).filter(
    (a) => a.status === "nieuw" || a.status === "in_behandeling",
  ).length;

  return (
    <AdminShell
      titel="Partneraanvragen"
      omschrijving="Organisaties die partner willen worden. Goedkeuren maakt de partner aan met de aanvrager als eigenaar."
    >
      {isLoading ? (
        <BccLaden />
      ) : isError ? (
        <BccFout tekst="De aanvragen konden niet geladen worden." opnieuw={() => void refetch()} />
      ) : !data?.beschikbaar ? (
        <BccBinnenkort wat="Het partnerbeheer" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Toon">
            <Button
              variant={filter === "open" ? "default" : "secondary"}
              className="min-h-11"
              aria-pressed={filter === "open"}
              onClick={() => setFilter("open")}
            >
              Open ({open})
            </Button>
            <Button
              variant={filter === "alle" ? "default" : "secondary"}
              className="min-h-11"
              aria-pressed={filter === "alle"}
              onClick={() => setFilter("alle")}
            >
              Alle ({data.aanvragen.length})
            </Button>
          </div>
          {!aanvragen.length ? (
            <Kaart>
              <p className="text-slate-300">
                {filter === "open"
                  ? "Geen open aanvragen. Alles is behandeld."
                  : "Nog geen aanvragen."}
              </p>
            </Kaart>
          ) : (
            <ul className="space-y-3" aria-label="Partneraanvragen">
              {aanvragen.map((a) => (
                <li key={a.id}>
                  <AanvraagKaart
                    a={a}
                    magBeslissen={magBeslissen}
                    bezig={beslis.isPending}
                    onBeslis={(besluit, reden) => beslis.mutate({ id: a.id, besluit, reden })}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function AanvraagKaart({
  a,
  magBeslissen,
  bezig,
  onBeslis,
}: {
  a: BccAanvraag;
  magBeslissen: boolean;
  bezig: boolean;
  onBeslis: (besluit: "goedgekeurd" | "geweigerd", reden: string) => void;
}) {
  const open = a.status === "nieuw" || a.status === "in_behandeling";
  return (
    <article aria-label={`Aanvraag ${a.bedrijfsnaam}`}>
      <Kaart className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold break-words">{a.bedrijfsnaam}</h2>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
            {AANVRAAG_STATUS[a.status] ?? a.status}
          </span>
        </div>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-slate-400">Soort</dt>
          <dd>{soortLabel(a.soort)}</dd>
          <dt className="text-slate-400">Aangevraagd door</dt>
          <dd>{a.aanvrager}</dd>
          <dt className="text-slate-400">Ontvangen</dt>
          <dd>{datumTijd(a.created_at)}</dd>
          {a.website ? (
            <>
              <dt className="text-slate-400">Website</dt>
              <dd className="break-words">{a.website}</dd>
            </>
          ) : null}
        </dl>
        {a.bericht ? (
          <p className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-200">“{a.bericht}”</p>
        ) : null}
        {!open ? (
          <p className="text-sm text-slate-300">
            Beslist op {datumTijd(a.beoordeeld_op)}
            {a.beoordeling_reden ? ` · reden: ${a.beoordeling_reden}` : ""}
          </p>
        ) : magBeslissen ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              className="min-h-11"
              disabled={bezig}
              onClick={() => onBeslis("goedgekeurd", "")}
            >
              Aanvraag goedkeuren
            </Button>
            <RedenKnop
              label="Afwijzen…"
              bevestig="Afwijzen bevestigen"
              uitleg="Reden van afwijzen (de aanvrager krijgt die te zien)"
              bezig={bezig}
              onBevestig={(reden) => onBeslis("geweigerd", reden)}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Je rol kan deze aanvraag bekijken, niet beslissen.
          </p>
        )}
      </Kaart>
    </article>
  );
}
