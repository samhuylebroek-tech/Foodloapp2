import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";
import { useAuth } from "@/hooks/useAuth";
import { useLimiet } from "@/lib/limiet";

type NieuwSearch = { title?: string | undefined; text?: string | undefined; url?: string | undefined; koppel?: string | undefined };

export const Route = createFileRoute("/recepten/nieuw")({
  validateSearch: (search: Record<string, unknown>): NieuwSearch => ({
    title: typeof search["title"] === "string" ? search["title"] : undefined,
    text: typeof search["text"] === "string" ? search["text"] : undefined,
    url: typeof search["url"] === "string" ? search["url"] : undefined,
    koppel: typeof search["koppel"] === "string" ? search["koppel"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recept toevoegen – Foodlo" },
      {
        name: "description",
        content:
          "Voeg een nieuw recept toe: typ het zelf in, lees het in van een website, plak een tekst of herken ingrediënten met een foto.",
      },
      { property: "og:title", content: "Recept toevoegen – Foodlo" },
      {
        property: "og:description",
        content: "Nieuw recept toevoegen met foto, ingrediënten en bereidingsstappen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NieuwPage,
});

function NieuwPage() {
  const gedeeld = Route.useSearch();
  const heeftGedeeld = !gedeeld.koppel && Boolean(gedeeld.title || gedeeld.text || gedeeld.url);
  const { user, loading: authLaden } = useAuth();
  const { data: limiet, isLoading: limietLaden } = useLimiet(user?.id);

  const volzet =
    !authLaden && !limietLaden && limiet?.betalenActief === true && !limiet.magToevoegen;

  return (
    <AppShell title="Nieuw recept">
      {limiet?.betalenActief && !volzet && Number.isFinite(limiet.totaal) && (
        <p className="mb-5 rounded-2xl border border-border bg-card p-4 text-base text-muted-foreground">
          Je hebt {limiet.gebruikt} van {limiet.totaal} gerechten in gebruik — nog {limiet.over}{" "}
          beschikbaar.
        </p>
      )}
      {volzet ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Je limiet is bereikt</p>
          <p className="mt-2 text-muted-foreground">
            Je hebt al {limiet.gebruikt} van {limiet.totaal} gerechten. Koop een extra pakket om
            meer recepten te bewaren.
          </p>
          <Link
            to="/instellingen"
            className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground"
          >
            Bekijk pakketten
          </Link>
        </div>
      ) : (
        <>
          {heeftGedeeld && (
            <p className="mb-5 rounded-2xl border border-primary/40 bg-secondary p-4 text-base">
              We hebben wat je deelde alvast overgenomen. Druk op “Recept eruit halen” of “Inlezen”
              en controleer daarna het resultaat.
            </p>
          )}
          {gedeeld.koppel ? (
            <RecipeForm koppelMaaltijd={gedeeld.koppel} startNaam={gedeeld.title} />
          ) : (
            <RecipeForm gedeeld={gedeeld} />
          )}
          <Link
            to="/inspiratie"
            className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-primary hover:bg-muted"
          >
            Nog geen idee? Bekijk ideeën om te koken <span aria-hidden>→</span>
          </Link>
        </>
      )}
    </AppShell>
  );
}
