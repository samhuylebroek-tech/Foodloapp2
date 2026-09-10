import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TALEN, THEMAS, useVoorkeuren, type ThemaId } from "@/lib/voorkeuren";

export const Route = createFileRoute("/instellingen")({
  head: () => ({
    meta: [
      { title: "Instellingen – MaJeBa" },
      {
        name: "description",
        content: "Pas je wachtwoord aan, kies een kleurenthema en je taal.",
      },
      { property: "og:title", content: "Instellingen – MaJeBa" },
      {
        property: "og:description",
        content: "Wachtwoord, kleuren en taal: alles op één plek.",
      },
    ],
  }),
  component: InstellingenPage,
});

function InstellingenPage() {
  const { taal, zetTaal, thema, zetThema, t } = useVoorkeuren();

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [wachtwoordBezig, setWachtwoordBezig] = useState(false);

  async function bewaarWachtwoord() {
    if (wachtwoord.length < 8) {
      toast.error(t("Kies een wachtwoord van minstens 8 tekens"));
      return;
    }
    if (wachtwoord !== herhaal) {
      toast.error(t("De twee wachtwoorden zijn niet gelijk"));
      return;
    }
    setWachtwoordBezig(true);
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });
    setWachtwoordBezig(false);
    if (error) toast.error(t("Aanpassen lukte niet"));
    else {
      setWachtwoord("");
      setHerhaal("");
      toast.success(t("Je wachtwoord is aangepast"));
    }
  }

  return (
    <AppShell title={t("Instellingen")}>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Wachtwoord")}</h2>
          <Label htmlFor="pw" className="mt-4 block text-base font-semibold">
            {t("Nieuw wachtwoord")}
          </Label>
          <Input
            id="pw"
            type="password"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base focus-visible:ring-primary/20"
          />
          <Label htmlFor="pw2" className="mt-3 block text-base font-semibold">
            {t("Herhaal het wachtwoord")}
          </Label>
          <Input
            id="pw2"
            type="password"
            value={herhaal}
            onChange={(e) => setHerhaal(e.target.value)}
            className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base focus-visible:ring-primary/20"
          />
          <Button
            onClick={bewaarWachtwoord}
            disabled={wachtwoordBezig}
            className="mt-4 h-14 w-full text-base shadow-md shadow-primary/15"
          >
            {wachtwoordBezig ? <Loader2 className="size-5 animate-spin" /> : null}
            {t("Wachtwoord bewaren")}
          </Button>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Kleuren")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {THEMAS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => zetThema(k.id as ThemaId)}
                aria-pressed={thema === k.id}
                className={
                  thema === k.id
                    ? "min-h-16 rounded-2xl bg-primary px-3 text-base font-semibold text-primary-foreground shadow-md shadow-primary/15"
                    : "min-h-16 rounded-2xl border border-border bg-secondary px-3 text-base font-semibold transition-colors hover:bg-muted"
                }
              >
                {t(k.label)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Taal")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("De hele app en je recepten worden dan in die taal getoond.")}
          </p>
          <select
            value={taal}
            onChange={(e) => zetTaal(e.target.value)}
            aria-label={t("Taal kiezen")}
            className="mt-4 h-14 w-full rounded-2xl border border-input bg-muted px-4 text-base focus-visible:ring-primary/20"
          >
            {TALEN.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </section>

        <BeheerLink />

        <Button
          variant="ghost"
          onClick={() => supabase.auth.signOut()}
          className="h-16 w-full text-lg"
        >
          <LogOut className="size-5" /> {t("Afmelden")}
        </Button>
      </div>
    </AppShell>
  );
}
