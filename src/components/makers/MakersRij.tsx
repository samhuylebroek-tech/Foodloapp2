/** Rustige rij "Makers om te volgen" op Ontdek. Toont niets zolang de module ontbreekt. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { haalGevolgd, haalMakers } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { Geverifieerd, MakerAvatar } from "./MakerOnderdelen";

export function MakersRij() {
  const { beschikbaar } = useModuleBeschikbaar("creators");
  const { user } = useAuth();
  const { data: makers = [] } = useQuery({
    queryKey: ["makers"],
    enabled: beschikbaar,
    queryFn: haalMakers,
    staleTime: 60 * 1000,
  });
  const { data: gevolgd = new Set<string>() } = useQuery({
    queryKey: ["gevolgd", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalGevolgd(user!.id),
  });
  const anderen = makers.filter((m) => m.user_id !== user?.id).slice(0, 6);
  if (!beschikbaar || !anderen.length) return null;

  return (
    <section aria-labelledby="makers-titel" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="makers-titel" className="text-sectietitel">
          Makers om te volgen
        </h2>
        <Link
          to="/makers"
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary underline-offset-4 hover:underline"
        >
          Alle makers
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>
      <ul className="scroll-rij -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {anderen.map((m) => (
          <li key={m.id} className="w-56 shrink-0 lg:w-auto">
            <Link
              to="/makers/$handle"
              params={{ handle: m.handle }}
              className="paneel flex h-full min-h-24 items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MakerAvatar maker={m} className="size-14 text-lg ring-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug break-words">{m.naam}</span>
                {m.specialisaties?.length ? (
                  <span className="block text-[0.9rem] text-muted-foreground">
                    {m.specialisaties.slice(0, 2).join(" · ")}
                  </span>
                ) : null}
                {gevolgd.has(m.id) ? (
                  <span className="block text-[0.9rem] font-semibold text-primary">
                    Je volgt deze maker
                  </span>
                ) : (
                  <Geverifieerd maker={m} />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
