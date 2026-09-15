import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CookingPot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/uitnodiging")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? search["code"] : "",
    groep: typeof search["groep"] === "string" ? search["groep"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Uitnodiging – Foodlo" },
      {
        name: "description",
        content: "Je bent uitgenodigd om mee te koken: bekijk gedeelde recepten, planning en lijst.",
      },
      { property: "og:title", content: "Uitnodiging – Foodlo" },
      {
        property: "og:description",
        content: "Neem de uitnodiging aan en kook samen mee.",
      },
    ],
  }),
  component: UitnodigingPage,
});

type TerugKey =
  | "recipes_view"
  | "recipes_edit"
  | "planner_view"
  | "planner_edit"
  | "shopping_view"
  | "shopping_edit";

const TERUG: { key: TerugKey; label: string }[] = [
  { key: "recipes_view", label: "Mijn recepten bekijken" },
  { key: "recipes_edit", label: "Mijn recepten bewerken" },
  { key: "planner_view", label: "Mijn weekplanning bekijken" },
  { key: "planner_edit", label: "Mijn weekplanning bewerken" },
  { key: "shopping_view", label: "Mijn boodschappenlijst bekijken" },
  { key: "shopping_edit", label: "Mijn boodschappenlijst bewerken" },
];

function UitnodigingPage() {
  const { code, groep } = Route.useSearch();
  const [groepNaam, setGroepNaam] = useState<string | null>(null);
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [terugDelen, setTerugDelen] = useState({
    recipes_view: true,
    recipes_edit: false,
    planner_view: false,
    planner_edit: false,
    shopping_view: false,
    shopping_edit: false,
  });

  useEffect(() => {
    if (code) sessionStorage.setItem("uitnodiging", code);
    if (groep) sessionStorage.setItem("gezinsuitnodiging", groep);
  }, [code, groep]);

  useEffect(() => {
    if (!groep || !session) return;
    supabase
      .rpc("groep_naam", { _token: groep })
      .then(({ data }) => setGroepNaam((data as unknown as string) ?? null));
  }, [groep, session]);

  async function gezinAannemen() {
    setBusy(true);
    const { error } = await supabase.rpc("join_group", { _token: groep });
    setBusy(false);
    if (error) {
      toast.error("Deze uitnodiging werkt niet meer. Vraag om een nieuwe.");
      return;
    }
    sessionStorage.removeItem("gezinsuitnodiging");
    toast.success("Je hoort er nu bij!");
    navigate({ to: "/gezin" });
  }

  async function aannemen() {
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_share", { _token: code });
    if (error) {
      setBusy(false);
      toast.error("Deze uitnodiging werkt niet meer. Vraag om een nieuwe.");
      return;
    }
    const eigenaar = data as unknown as string;
    const iets = Object.values(terugDelen).some(Boolean);
    if (eigenaar && iets) {
      const { data: mij } = await supabase.auth.getUser();
      if (mij.user) {
        await supabase.from("shares").insert({
          owner_id: mij.user.id,
          member_id: eigenaar,
          status: "accepted",
          accepted_at: new Date().toISOString(),
          ...terugDelen,
        });
      }
    }
    setBusy(false);
    sessionStorage.removeItem("uitnodiging");
    toast.success("Gelukt! Jullie zijn nu vrienden.");
    navigate({ to: "/vrienden" });
  }

  async function weigeren() {
    setBusy(true);
    const { error } = await supabase.rpc("decline_share", { _token: code });
    setBusy(false);
    if (error) {
      toast.error("Weigeren lukte niet.");
      return;
    }
    sessionStorage.removeItem("uitnodiging");
    toast.success("Uitnodiging geweigerd.");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <CookingPot className="size-9" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-3xl">Je bent uitgenodigd</h1>

        {groep ? (
          loading ? (
            <p className="mt-4 text-lg text-muted-foreground">Even geduld…</p>
          ) : session ? (
            <>
              <p className="mt-4 text-lg leading-relaxed">
                Je mag meedoen met{" "}
                <strong>{groepNaam ?? "dit gezin"}</strong>. Jullie zien en bewerken dan samen
                dezelfde recepten, het weekmenu en de boodschappenlijst.
              </p>
              <Button onClick={gezinAannemen} disabled={busy} className="mt-6 h-16 w-full text-lg">
                {busy ? <Loader2 className="size-5 animate-spin" /> : null} Meedoen
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate({ to: "/" })}
                disabled={busy}
                className="mt-3 h-14 w-full text-base"
              >
                Nee, bedankt
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg leading-relaxed">
                Meld je eerst aan of maak een account. Daarna staat de uitnodiging klaar.
              </p>
              <Button
                onClick={() => navigate({ to: "/aanmelden" })}
                className="mt-6 h-16 w-full text-lg"
              >
                Aanmelden of account maken
              </Button>
            </>
          )
        ) : !code ? (
          <p className="mt-4 text-lg">Deze uitnodiging is niet compleet. Vraag om een nieuwe link.</p>
        ) : loading ? (
          <p className="mt-4 text-lg text-muted-foreground">Even geduld…</p>
        ) : session ? (
          <>
            <p className="mt-4 text-lg leading-relaxed">
              Neem de uitnodiging aan om samen recepten, planning of de boodschappenlijst te delen.
            </p>

            <div className="mt-6 rounded-2xl border border-border p-4 text-left">
              <p className="text-base font-semibold">Wat mag deze persoon bij jou zien?</p>
              <ul className="mt-2 space-y-1">
                {TERUG.map((r) => (
                  <li
                    key={r.key}
                    className="flex min-h-14 items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0"
                  >
                    <Label htmlFor={`terug-${r.key}`} className="text-base font-normal leading-snug">
                      {r.label}
                    </Label>
                    <Switch
                      id={`terug-${r.key}`}
                      checked={terugDelen[r.key]}
                      onCheckedChange={(v) => setTerugDelen((p) => ({ ...p, [r.key]: v }))}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={aannemen} disabled={busy} className="mt-6 h-16 w-full text-lg">
              {busy ? <Loader2 className="size-5 animate-spin" /> : null} Uitnodiging aannemen
            </Button>
            <Button
              variant="secondary"
              onClick={weigeren}
              disabled={busy}
              className="mt-3 h-14 w-full text-base"
            >
              Nee, bedankt
            </Button>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg leading-relaxed">
              Meld je eerst aan of maak een account. Daarna staat de uitnodiging klaar.
            </p>
            <Button
              onClick={() => navigate({ to: "/aanmelden" })}
              className="mt-6 h-16 w-full text-lg"
            >
              Aanmelden of account maken
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
