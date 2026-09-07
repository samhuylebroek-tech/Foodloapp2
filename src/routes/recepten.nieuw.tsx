import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";

export const Route = createFileRoute("/recepten/nieuw")({
  head: () => ({
    meta: [
      { title: "Recept toevoegen – Samen Koken" },
      {
        name: "description",
        content:
          "Voeg een nieuw recept toe: typ het zelf in, lees het in van een website of herken ingrediënten met een foto.",
      },
      { property: "og:title", content: "Recept toevoegen – Samen Koken" },
      {
        property: "og:description",
        content: "Nieuw recept toevoegen met foto, ingrediënten en bereidingsstappen.",
      },
    ],
  }),
  component: NieuwPage,
});

function NieuwPage() {
  return (
    <AppShell title="Nieuw recept">
      <RecipeForm />
    </AppShell>
  );
}
