import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { haalTeam, verwijderLid, zetRol } from "@/lib/partners-db";
import { ROL_LABEL, rolWijzigingFout, type PartnerLid, type PartnerRol } from "@/lib/partners";

export const Route = createFileRoute("/partner/team")({ component: Team });

const ROLLEN = Object.keys(ROL_LABEL) as PartnerRol[];
const UITLEG: Record<PartnerRol, string> = {
  eigenaar: "Alles, ook het team en het abonnement.",
  beheerder: "Profiel, producten, campagnes en rapportage.",
  analist: "Alleen de rapportage bekijken.",
  finance: "Abonnement en facturen, en de rapportage.",
};

function Team() {
  const { partner, lid: ik, mag } = usePartner();
  const qc = useQueryClient();
  const sleutel = ["partner", partner.id, "team"];
  const { data = [], isLoading } = useQuery({
    queryKey: sleutel,
    queryFn: () => haalTeam(partner.id),
  });
  const magBeheren = mag("team.beheren");
  const ververs = () => qc.invalidateQueries({ queryKey: sleutel });

  const rol = useMutation({
    mutationFn: ({ lid, nieuw }: { lid: PartnerLid; nieuw: PartnerRol }) => {
      const fout = rolWijzigingFout(data, lid.id, nieuw);
      if (fout) throw new Error(fout);
      return zetRol(lid, nieuw);
    },
    onSuccess: () => {
      toast.success("Rol aangepast.");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const weg = useMutation({
    mutationFn: (lid: PartnerLid) => {
      const fout = rolWijzigingFout(data, lid.id, null);
      if (fout) throw new Error(fout);
      return verwijderLid(lid);
    },
    onSuccess: () => {
      toast.success("Teamlid verwijderd.");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PartnerKop
        titel="Team"
        uitleg="Wie werkt mee in deze partneromgeving, en wat mag elke rol."
      />
      <section aria-labelledby="team-rollen" className="paneel p-4">
        <h2 id="team-rollen" className="text-sectietitel mb-2">
          Rollen
        </h2>
        <dl className="grid gap-2 text-base sm:grid-cols-2">
          {ROLLEN.map((r) => (
            <div key={r}>
              <dt className="font-semibold">{ROL_LABEL[r]}</dt>
              <dd className="text-muted-foreground">{UITLEG[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
      {isLoading ? (
        <p role="status" className="text-muted-foreground">
          Laden…
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Teamleden">
          {data.map((l) => (
            <li key={l.id} className="paneel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-lg font-semibold">
                  {l.naam}
                  {l.user_id === ik.user_id ? " (jij)" : ""}
                </p>
                <p className="text-base text-muted-foreground">{ROL_LABEL[l.rol]}</p>
              </div>
              {magBeheren ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`rol-${l.id}`}>
                    Rol van {l.naam}
                  </label>
                  <select
                    id={`rol-${l.id}`}
                    value={l.rol}
                    onChange={(e) => rol.mutate({ lid: l, nieuw: e.target.value as PartnerRol })}
                    className="min-h-12 rounded-xl border border-input bg-background px-3 text-base"
                  >
                    {ROLLEN.map((r) => (
                      <option key={r} value={r}>
                        {ROL_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  {l.user_id !== ik.user_id ? (
                    <Button variant="outline" className="min-h-12" onClick={() => weg.mutate(l)}>
                      Verwijderen
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-base text-muted-foreground">
        {magBeheren
          ? "Een nieuw teamlid toevoegen loopt voorlopig via het Foodlo-team (uitnodigen per e-mail volgt)."
          : "Alleen een eigenaar kan rollen wijzigen."}
      </p>
    </>
  );
}
