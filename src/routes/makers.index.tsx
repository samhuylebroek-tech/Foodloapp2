import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { Geverifieerd, MakerAvatar, VolgKnop } from "@/components/makers/MakerOnderdelen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { filterMakers } from "@/lib/makers";
import { haalGevolgd, haalMakers } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";

export const Route = createFileRoute("/makers/")({
  head: () => ({
    meta: [
      { title: "Makers – Foodlo" },
      { name: "description", content: "Ontdek koks en makers en volg wie jou inspireert." },
    ],
  }),
  component: MakersPage,
});

function MakersPage() {
  const { beschikbaar, laden } = useModuleBeschikbaar("creators");
  const { user } = useAuth();
  const [zoek, setZoek] = useState("");
  const [alleenGevolgd, setAlleenGevolgd] = useState(false);

  const makersQ = useQuery({
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

  const zichtbaar = useMemo(() => {
    const lijst = filterMakers(makersQ.data ?? [], zoek);
    return alleenGevolgd ? lijst.filter((m) => gevolgd.has(m.id)) : lijst;
  }, [makersQ.data, zoek, alleenGevolgd, gevolgd]);

  return (
    <AppShell title="Makers" ondertitel="Koks die je kan volgen">
      {laden ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      ) : !beschikbaar ? (
        <ModuleNietBeschikbaar
          naam="Makers"
          terugNaar="/inspiratie"
          terugLabel="Terug naar Ontdek"
        />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek een maker of keuken"
              aria-label="Zoek een maker"
              className="h-14 pl-12 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Welke makers">
            <Button
              variant={alleenGevolgd ? "outline" : "secondary"}
              aria-pressed={!alleenGevolgd}
              onClick={() => setAlleenGevolgd(false)}
              className="h-12 px-5 text-base"
            >
              Alle makers
            </Button>
            <Button
              variant={alleenGevolgd ? "secondary" : "outline"}
              aria-pressed={alleenGevolgd}
              onClick={() => setAlleenGevolgd(true)}
              className="h-12 px-5 text-base"
            >
              Volgend ({gevolgd.size})
            </Button>
          </div>

          {makersQ.isLoading ? (
            <div className="h-40 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
          ) : makersQ.isError ? (
            <div className="paneel p-5 text-center">
              <p className="text-base">De makers konden niet geladen worden.</p>
              <Button
                variant="outline"
                onClick={() => void makersQ.refetch()}
                className="mt-3 h-14 px-6 text-base"
              >
                Opnieuw proberen
              </Button>
            </div>
          ) : !zichtbaar.length ? (
            <EmptyState
              icon={<ChefHat />}
              title={alleenGevolgd ? "Je volgt nog niemand" : "Geen maker gevonden"}
              description={
                alleenGevolgd
                  ? "Tik bij een maker op Volgen; die verschijnt dan hier."
                  : "Probeer een ander woord, zoals soep of vegetarisch."
              }
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Makers">
              {zichtbaar.map((m) => (
                <li key={m.id} className="paneel flex flex-wrap items-center gap-4 p-4">
                  <MakerAvatar maker={m} />
                  <div className="min-w-0 flex-1 basis-40">
                    <Link
                      to="/makers/$handle"
                      params={{ handle: m.handle }}
                      className="font-display text-xl font-semibold leading-tight underline-offset-4 hover:underline"
                    >
                      {m.naam}
                    </Link>
                    <p className="text-[0.95rem] text-muted-foreground">@{m.handle}</p>
                    <Geverifieerd maker={m} />
                    {m.specialisaties?.length ? (
                      <p className="mt-1 text-[0.95rem]">{m.specialisaties.join(" · ")}</p>
                    ) : null}
                  </div>
                  {m.user_id !== user?.id ? (
                    <VolgKnop maker={m} gevolgd={gevolgd.has(m.id)} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[0.95rem] text-muted-foreground">
            Zelf recepten delen?{" "}
            <Link to="/maker" className="font-semibold text-primary underline underline-offset-4">
              Word maker
            </Link>
          </p>
        </div>
      )}
    </AppShell>
  );
}
