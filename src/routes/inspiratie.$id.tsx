import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Users, Plus, Check, CalendarPlus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  haalInspiratieRecept,
  haalInspiratieIngredienten,
  voegToeAanMijnRecepten,
} from "@/lib/inspiratie";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/inspiratie/$id")({
  head: () => ({
    meta: [
      { title: "Inspiratie-recept – Foodlo" },
      { name: "description", content: "Bekijk dit recept en voeg het toe aan je eigen recepten." },
      { property: "og:title", content: "Inspiratie-recept – Foodlo" },
      { property: "og:description", content: "Bekijk dit recept en voeg het toe aan je eigen recepten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InspiratieDetailPage,
});

function InspiratieDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);
  const [toegevoegd, setToegevoegd] = useState<{ recipeId: string; bestondAl: boolean } | null>(null);
  const [bereidingOpen, setBereidingOpen] = useState(false);
  const [fotoKapot, setFotoKapot] = useState(false);

  const { data: recept, isLoading } = useQuery({
    queryKey: ["inspiratie", id],
    queryFn: () => haalInspiratieRecept(id),
  });
  const { data: ingredienten = [] } = useQuery({
    queryKey: ["inspiratie-ingredienten", id],
    queryFn: () => haalInspiratieIngredienten(id),
    enabled: !!recept,
  });

  async function voegToe() {
    if (!user || !recept || bezig) return;
    setBezig(true);
    try {
      const res = await voegToeAanMijnRecepten(user.id, id);
      qc.invalidateQueries({ queryKey: ["recipes"] });
      if (res.soort === "bestaatAl") {
        setToegevoegd({ recipeId: res.recipeId, bestondAl: true });
        toast.message("Dit recept staat al in je recepten.");
      } else {
        setToegevoegd({ recipeId: res.recipeId, bestondAl: false });
        toast.success("Toegevoegd aan je recepten");
      }
    } catch {
      toast.error("Toevoegen lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Inspiratie">
        <div className="space-y-3">
          <div className="aspect-[16/9] animate-pulse rounded-xl bg-secondary" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-secondary" />
        </div>
      </AppShell>
    );
  }

  if (!recept) {
    return (
      <AppShell title="Inspiratie">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Dit recept is niet gevonden</p>
          <Button variant="outline" asChild className="mt-4 h-14 px-6 text-base">
            <Link to="/inspiratie">Terug naar inspiratie</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const totaalTijd = recept.prep_minutes + recept.cook_minutes;

  return (
    <AppShell title="Inspiratie">
      <div className="space-y-5 pb-24">
        <Button variant="ghost" asChild className="h-12 px-2 text-base">
          <Link to="/inspiratie">
            <ArrowLeft className="size-5" /> Terug naar inspiratie
          </Link>
        </Button>

        {fotoUrl && !fotoKapot ? (
          <img
            src={fotoUrl}
            alt=""
            onError={() => setFotoKapot(true)}
            className="aspect-[16/9] w-full rounded-xl object-cover"
          />
        ) : null}

        <div>
          <h1 className="font-display text-2xl leading-tight">{recept.title}</h1>
          {recept.description ? (
            <p className="mt-2 text-muted-foreground">{recept.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {totaalTijd > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                <Clock3 className="size-4" /> {totaalTijd} min
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
              <Users className="size-4" /> {recept.servings} personen
            </span>
            {recept.category ? (
              <span className="rounded-full bg-secondary px-3 py-1.5 capitalize">{recept.category}</span>
            ) : null}
            {recept.difficulty ? (
              <span className="rounded-full bg-secondary px-3 py-1.5 capitalize">{recept.difficulty}</span>
            ) : null}
          </div>
        </div>

        {ingredienten.length ? (
          <section aria-label="Ingrediënten" className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-lg">Ingrediënten</h2>
            <ul className="mt-2 space-y-1.5">
              {ingredienten.map((i, idx) => (
                <li key={idx} className="flex min-h-8 items-center gap-2 text-base">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>
                    {i.quantity !== null ? `${toonBelgischeMaat(i.quantity, i.unit)} ` : ""}
                    {i.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {recept.instructions.length ? (
          <section aria-label="Bereiding" className="rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setBereidingOpen((o) => !o)}
              aria-expanded={bereidingOpen}
              className="flex min-h-12 w-full items-center justify-between text-left"
            >
              <h2 className="font-display text-lg">Bereiding</h2>
              <span className="text-sm font-semibold text-primary">
                {bereidingOpen ? "Verberg" : `Toon ${recept.instructions.length} stappen`}
              </span>
            </button>
            {bereidingOpen ? (
              <ol className="mt-2 space-y-3">
                {recept.instructions.map((stap, idx) => (
                  <li key={idx} className="flex gap-3 text-base">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{stap}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Plakkende hoofdactie onderaan */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {toegevoegd ? (
            <div className="grid gap-2">
              <p className="flex items-center justify-center gap-2 text-center text-base font-semibold">
                <Check className="size-5 text-primary" />
                {toegevoegd.bestondAl ? "Dit recept staat al in je recepten" : "Toegevoegd aan je recepten"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="h-14 text-base"
                  onClick={() => navigate({ to: "/recepten/$id", params: { id: toegevoegd.recipeId } })}
                >
                  <BookOpen className="size-5" /> Open recept
                </Button>
                <Button
                  variant="outline"
                  className="h-14 text-base"
                  onClick={() => navigate({ to: "/planner" })}
                >
                  <CalendarPlus className="size-5" /> Aan weekmenu
                </Button>
              </div>
              <Button variant="ghost" className="h-12 text-base" onClick={() => navigate({ to: "/inspiratie" })}>
                Verder inspiratie bekijken
              </Button>
            </div>
          ) : (
            <Button onClick={() => void voegToe()} disabled={bezig} className="h-14 w-full text-base">
              <Plus className="size-5" />
              {bezig ? "Bezig…" : "Toevoegen aan mijn recepten"}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
