import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ALLE_MOMENTEN,
  EEN_BLOK,
  TALEN,
  THEMAS,
  useVoorkeuren,
  type ThemaId,
} from "@/lib/voorkeuren";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/welkom")({
  head: () => ({
    meta: [
      { title: "Welkom bij Foodlo — je app instellen" },
      {
        name: "description",
        content: "Kies je taal, je kleuren en de momenten die je plant. Eén scherm en je bent klaar.",
      },
      { property: "og:title", content: "Welkom bij Foodlo — je app instellen" },
      {
        property: "og:description",
        content: "Kies je taal, je kleuren en de momenten die je plant. Eén scherm en je bent klaar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welkom,
});

function Welkom() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { taal, zetTaal, thema, zetThema, momenten, zetMomenten, t } = useVoorkeuren();
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/aanmelden" });
  }, [loading, user, navigate]);

  const eenBlok = momenten.length === 1 && momenten[0] === EEN_BLOK[0];

  async function klaar(naar: "/" | "/kennismaking" = "/kennismaking") {
    setBezig(true);
    if (user) {
      await supabase
        .from("profiles")
        .update({ taal, thema, momenten, onboarding_klaar: true })
        .eq("id", user.id);
      // Anders stuurt de app je meteen terug naar dit scherm (oude gegevens in het geheugen).
      queryClient.setQueryData(["onboarding", user.id], { onboarding_klaar: true });
      await queryClient.invalidateQueries({ queryKey: ["onboarding", user.id] });
    }
    window.localStorage.setItem("onboarding_klaar", "ja");
    navigate({ to: naar });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
            <img src={logo} alt="Foodlo logo" width={28} height={28} className="size-7" />
          </div>
          <p className="text-2xl font-bold tracking-tight">Foodlo</p>
          <button
            type="button"
            onClick={() => void klaar("/")}
            disabled={bezig}
            aria-label={t("Overslaan")}
            className="ml-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-card"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">{t("Even snel instellen")}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(
            "Drie kleine keuzes. Daarna maken we even kennis. Je kan alles later aanpassen in je instellingen.",
          )}
        </p>

        <section className="mt-7">
          <h2 className="text-lg font-bold">{t("Taal")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {TALEN.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => zetTaal(l.code)}
                aria-pressed={taal === l.code}
                className={
                  taal === l.code
                    ? "flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-secondary px-3 text-base font-semibold text-foreground"
                    : "flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-transparent bg-card px-3 text-base font-semibold ring-1 ring-border hover:bg-muted"
                }
              >
                {taal === l.code && <Check className="size-5 text-primary" aria-hidden />}
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-bold">{t("Kleuren")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {THEMAS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => zetThema(k.id as ThemaId)}
                aria-pressed={thema === k.id}
                className={
                  thema === k.id
                    ? "flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-secondary px-3 text-base font-semibold text-foreground"
                    : "flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-transparent bg-card px-3 text-base font-semibold ring-1 ring-border hover:bg-muted"
                }
              >
                {thema === k.id && <Check className="size-5 text-primary" aria-hidden />}
                {t(k.label)}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-bold">{t("Wat plan je per dag?")}</h2>
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => zetMomenten([...ALLE_MOMENTEN])}
              aria-pressed={!eenBlok}
              className={
                !eenBlok
                  ? "flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-secondary px-4 text-left text-base font-semibold"
                  : "flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border-2 border-transparent bg-card px-4 text-left text-base font-semibold ring-1 ring-border hover:bg-muted"
              }
            >
              {t("Ontbijt, middageten en avondeten")}
              {!eenBlok && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => zetMomenten([...EEN_BLOK])}
              aria-pressed={eenBlok}
              className={
                eenBlok
                  ? "flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-secondary px-4 text-left text-base font-semibold"
                  : "flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border-2 border-transparent bg-card px-4 text-left text-base font-semibold ring-1 ring-border hover:bg-muted"
              }
            >
              {t("Eén maaltijd per dag")}
              {eenBlok && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
            </button>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-5 mt-8 bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Button onClick={() => void klaar()} disabled={bezig} className="h-16 w-full text-lg">
          {bezig ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
          {t("Klaar")}
        </Button>
        </div>
      </div>
    </div>
  );
}
