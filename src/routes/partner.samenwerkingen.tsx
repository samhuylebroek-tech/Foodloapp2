import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { haalSamenwerkingen } from "@/lib/partners-db";

export const Route = createFileRoute("/partner/samenwerkingen")({ component: Samenwerkingen });

const STATUS = { voorstel: "Voorstel", lopend: "Lopend", afgerond: "Afgerond" } as const;

function Samenwerkingen() {
  const { partner } = usePartner();
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["partner", partner.id, "samenwerkingen"],
    queryFn: () => haalSamenwerkingen(partner.id),
  });
  return (
    <>
      <PartnerKop
        titel="Samenwerkingen"
        uitleg="Makers met wie je samenwerkt. Een maker vermeldt een samenwerking altijd zichtbaar bij het recept."
      />
      {isLoading ? (
        <p role="status" className="text-muted-foreground">
          Laden…
        </p>
      ) : isError ? (
        <p className="paneel p-4">De samenwerkingen konden niet geladen worden.</p>
      ) : !data.length ? (
        <p className="paneel p-4 text-base text-muted-foreground">
          Nog geen samenwerkingen. Een samenwerking starten loopt voorlopig via het Foodlo-team.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Samenwerkingen met makers">
          {data.map((s) => (
            <li key={s.id} className="paneel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                {s.handle ? (
                  <Link
                    to="/makers/$handle"
                    params={{ handle: s.handle }}
                    className="text-lg font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {s.maker}
                  </Link>
                ) : (
                  <p className="text-lg font-semibold">{s.maker}</p>
                )}
                {s.omschrijving ? (
                  <p className="text-base text-muted-foreground">{s.omschrijving}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-[0.95rem] font-semibold text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-50">
                {STATUS[s.status] ?? s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
