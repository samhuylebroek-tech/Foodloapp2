import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";

type NieuwSearch = { title?: string | undefined; text?: string | undefined; url?: string | undefined };

export const Route = createFileRoute("/recepten/nieuw")({
  validateSearch: (search: Record<string, unknown>): NieuwSearch => ({
    title: typeof search["title"] === "string" ? search["title"] : undefined,
    text: typeof search["text"] === "string" ? search["text"] : undefined,
    url: typeof search["url"] === "string" ? search["url"] : undefined,
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
    ],
  }),
  component: NieuwPage,
});

function NieuwPage() {
  const gedeeld = Route.useSearch();
  const heeftGedeeld = Boolean(gedeeld.title || gedeeld.text || gedeeld.url);

  return (
    <AppShell title="Nieuw recept">
      {heeftGedeeld && (
        <p className="mb-5 rounded-2xl border border-primary/40 bg-secondary p-4 text-base">
          We hebben wat je deelde alvast overgenomen. Druk op “Recept eruit halen” of “Inlezen” en
          controleer daarna het resultaat.
        </p>
      )}
      <RecipeForm gedeeld={gedeeld} />
    </AppShell>
  );
}
