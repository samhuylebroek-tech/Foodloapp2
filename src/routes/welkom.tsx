import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Loader2,
  PlusCircle,
  Share,
  ShoppingCart,
  Smartphone,
  SquarePlus,
  Users,
} from "lucide-react";
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
        content: "Kies je taal, je kleuren en de momenten van de dag. In drie korte stapjes klaar.",
      },
      { property: "og:title", content: "Welkom bij Foodlo — je app instellen" },
      {
        property: "og:description",
        content: "Kies je taal, je kleuren en de momenten van de dag. In drie korte stapjes klaar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welkom,
});

const STAPPEN = [
  "Taal",
  "Kleuren",
  "Momenten van de dag",
  "Zo werkt het",
  "Op je telefoon",
] as const;

const RONDLEIDING = [
  {
    icoon: BookOpen,
    titel: "Recepten",
    tekst: "Al je gerechten op één plek. Zoek, filter op vlees, vis of vega en tik op een recept om te koken.",
  },
  {
    icoon: PlusCircle,
    titel: "Toevoegen",
    tekst: "Plak een link van een receptensite of YouTube, typ zelf, of neem een foto. De app vult de rest in.",
  },
  {
    icoon: CalendarDays,
    titel: "Weekmenu",
    tekst: "Plan per dag wat je eet. Een groene dag is volledig gepland.",
  },
  {
    icoon: ShoppingCart,
    titel: "Boodschappen",
    tekst: "Je boodschappenlijst vult zichzelf vanuit je weekmenu of recepten. Vink af in de winkel.",
  },
  {
    icoon: Users,
    titel: "Vrienden",
    tekst: "Nodig vrienden uit met een link en kook samen: zij zien jouw recepten, jij de hunne.",
  },
] as const;

function Welkom() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { taal, zetTaal, thema, zetThema, momenten, zetMomenten, t } = useVoorkeuren();
  const [stap, setStap] = useState(0);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/aanmelden" });
  }, [loading, user, navigate]);

  const eenBlok = momenten.length === 1 && momenten[0] === EEN_BLOK[0];

  async function klaar() {
    setBezig(true);
    if (user) {
      await supabase
        .from("profiles")
        .update({ taal, thema, momenten, onboarding_klaar: true })
        .eq("id", user.id);
    }
    window.localStorage.setItem("onboarding_klaar", "ja");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
            <img src={logo} alt="Foodlo logo" width={28} height={28} className="size-7" />
          </div>
          <p className="text-2xl font-bold tracking-tight">Foodlo</p>
        </div>

        <div className="mt-6 flex gap-2" aria-hidden>
          {STAPPEN.map((s, i) => (
            <span
              key={s}
              className={
                i <= stap ? "h-2 flex-1 rounded-full bg-primary" : "h-2 flex-1 rounded-full bg-muted"
              }
            />
          ))}
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          {t("Stap")} {stap + 1} {t("van")} {STAPPEN.length}
        </p>

        {stap === 0 && (
          <section className="mt-4">
            <h1 className="text-3xl font-bold tracking-tight">{t("In welke taal wil je koken?")}</h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t("De hele app en je recepten worden dan in die taal getoond.")}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {TALEN.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => zetTaal(l.code)}
                  aria-pressed={taal === l.code}
                  className={
                    taal === l.code
                      ? "min-h-16 rounded-2xl bg-primary px-3 text-base font-semibold text-primary-foreground shadow-md shadow-primary/15"
                      : "min-h-16 rounded-2xl border border-border bg-card px-3 text-base font-semibold hover:bg-muted"
                  }
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {stap === 1 && (
          <section className="mt-4">
            <h1 className="text-3xl font-bold tracking-tight">{t("Kies je kleuren")}</h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t("Je ziet meteen hoe de app eruitziet. Je kan dit later altijd wijzigen.")}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {THEMAS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => zetThema(k.id as ThemaId)}
                  aria-pressed={thema === k.id}
                  className={
                    thema === k.id
                      ? "min-h-16 rounded-2xl bg-primary px-3 text-base font-semibold text-primary-foreground shadow-md shadow-primary/15"
                      : "min-h-16 rounded-2xl border border-border bg-card px-3 text-base font-semibold hover:bg-muted"
                  }
                >
                  {t(k.label)}
                </button>
              ))}
            </div>
          </section>
        )}

        {stap === 2 && (
          <section className="mt-4">
            <h1 className="text-3xl font-bold tracking-tight">{t("Wat plan je per dag?")}</h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t("Kies welke momenten je per dag wil inplannen.")}
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => zetMomenten([...ALLE_MOMENTEN])}
                aria-pressed={!eenBlok}
                className={
                  !eenBlok
                    ? "min-h-16 w-full rounded-2xl bg-primary px-4 text-left text-base font-semibold text-primary-foreground"
                    : "min-h-16 w-full rounded-2xl border border-border bg-card px-4 text-left text-base font-semibold hover:bg-muted"
                }
              >
                {t("Ontbijt, middageten en avondeten")}
              </button>
              <button
                type="button"
                onClick={() => zetMomenten([...EEN_BLOK])}
                aria-pressed={eenBlok}
                className={
                  eenBlok
                    ? "min-h-16 w-full rounded-2xl bg-primary px-4 text-left text-base font-semibold text-primary-foreground"
                    : "min-h-16 w-full rounded-2xl border border-border bg-card px-4 text-left text-base font-semibold hover:bg-muted"
                }
              >
                {t("Eén maaltijd per dag")}
              </button>
            </div>

            {!eenBlok && (
              <div className="mt-4 space-y-2">
                {ALLE_MOMENTEN.map((m) => {
                  const aan = momenten.includes(m);
                  return (
                    <label
                      key={m}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-base font-semibold capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={aan}
                        onChange={(e) =>
                          zetMomenten(
                            e.target.checked
                              ? [...momenten, m]
                              : momenten.filter((x) => x !== m),
                          )
                        }
                        className="size-6 accent-primary"
                      />
                      {t(m)}
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="mt-8 flex gap-3">
          {stap > 0 && (
            <Button
              variant="outline"
              onClick={() => setStap((s) => s - 1)}
              className="h-16 flex-1 text-base"
            >
              <ArrowLeft className="size-5" /> {t("Terug")}
            </Button>
          )}
          {stap < STAPPEN.length - 1 ? (
            <Button onClick={() => setStap((s) => s + 1)} className="h-16 flex-1 text-lg">
              {t("Verder")} <ArrowRight className="size-5" />
            </Button>
          ) : (
            <Button onClick={() => void klaar()} disabled={bezig} className="h-16 flex-1 text-lg">
              {bezig ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {t("Klaar, begin maar")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
