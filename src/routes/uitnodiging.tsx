import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CookingPot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/uitnodiging")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? search["code"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Uitnodiging – Samen Koken" },
      {
        name: "description",
        content: "Je bent uitgenodigd om mee te koken: bekijk gedeelde recepten, planning en lijst.",
      },
      { property: "og:title", content: "Uitnodiging – Samen Koken" },
      {
        property: "og:description",
        content: "Neem de uitnodiging aan en kook samen mee.",
      },
    ],
  }),
  component: UitnodigingPage,
});

function UitnodigingPage() {
  const { code } = Route.useSearch();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (code) sessionStorage.setItem("uitnodiging", code);
  }, [code]);

  async function aannemen() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_share", { _token: code });
    setBusy(false);
    if (error) {
      toast.error("Deze uitnodiging werkt niet meer. Vraag om een nieuwe.");
      return;
    }
    sessionStorage.removeItem("uitnodiging");
    toast.success("Gelukt! Jullie delen nu samen.");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <CookingPot className="size-9" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-3xl">Je bent uitgenodigd</h1>

        {!code ? (
          <p className="mt-4 text-lg">Deze uitnodiging is niet compleet. Vraag om een nieuwe link.</p>
        ) : loading ? (
          <p className="mt-4 text-lg text-muted-foreground">Even geduld…</p>
        ) : session ? (
          <>
            <p className="mt-4 text-lg leading-relaxed">
              Neem de uitnodiging aan om samen recepten, planning of de boodschappenlijst te delen.
            </p>
            <Button onClick={aannemen} disabled={busy} className="mt-6 h-16 w-full text-lg">
              {busy ? <Loader2 className="size-5 animate-spin" /> : null} Uitnodiging aannemen
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
