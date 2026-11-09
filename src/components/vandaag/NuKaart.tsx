/**
 * WP3 — de "Nu"-kaart bovenaan Vandaag: één ding dat nu telt, één knop.
 * Welke stap het is, beslist `hoofdStap` (lib/vandaag.ts); deze kaart toont hem alleen.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ChefHat, Loader2, Plus, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { RecipePhoto } from "@/components/RecipePhoto";
import { VanavondVoorstellen } from "@/components/kringloop/VanavondVoorstellen";
import type { Recipe } from "@/lib/types";
import { duurLabel } from "@/lib/kookstand";
import { opsomming, type ReceptVandaag, type Stap } from "@/lib/vandaag";
import { useT } from "@/lib/voorkeuren";

const knopHoofd =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-inkt-foreground px-6 text-lg font-semibold text-inkt hover:bg-inkt-foreground/90 disabled:opacity-70";
const knopTweede =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-inkt-foreground/40 px-6 text-lg font-semibold text-inkt-foreground hover:bg-white/10";

function momentLabel(moment: string) {
  const m = moment.trim();
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Vandaag";
}

function kooktijd(r: ReceptVandaag) {
  const min = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return min > 0 ? duurLabel(min * 60) : null;
}

export function NuKaart({
  stap,
  datum,
  groet,
  laden,
  recepten,
  bezig,
  onZetOpLijst,
}: {
  stap: Stap | null;
  datum: string;
  groet: string;
  laden: boolean;
  recepten: Recipe[];
  bezig: boolean;
  /** "Zet op mijn lijst" voor wat er vandaag ontbreekt. */
  onZetOpLijst: () => void;
}) {
  const t = useT();
  const recept =
    stap && "recept" in stap
      ? stap.recept
      : stap?.soort === "morgen"
        ? (stap.maaltijd?.recept ?? null)
        : null;

  let label: string | null = null;
  let titel: ReactNode = null;
  let uitleg: ReactNode = null;
  let acties: ReactNode = null;
  let extra: ReactNode = null;

  const naarRecept = (r: ReceptVandaag, tekst: string) => (
    <Link to="/recepten/$id" params={{ id: r.id }} className={knopTweede}>
      {t(tekst)}
    </Link>
  );
  const startKoken = (r: ReceptVandaag, hoofd: boolean) => (
    <Link
      to="/recepten/$id"
      params={{ id: r.id }}
      search={{ koken: true }}
      className={hoofd ? knopHoofd : knopTweede}
    >
      <ChefHat className="size-6" aria-hidden />
      {t("Start koken")}
    </Link>
  );

  switch (stap?.soort) {
    case "hervatten":
      label = t("Je was aan het koken");
      titel = t(stap.recept.title);
      uitleg = `${t("Stap")} ${stap.stap + 1} ${t("van")} ${stap.recept.stappen}`;
      acties = (
        <>
          <Link to="/recepten/$id" params={{ id: stap.recept.id }} className={knopHoofd}>
            <ChefHat className="size-6" aria-hidden />
            {t("Ga verder met koken")}
          </Link>
        </>
      );
      break;
    case "aanvullen":
      label = `${t(momentLabel(stap.maaltijd.meal_type))} ${t("vandaag")}`;
      titel = t(stap.recept.title);
      uitleg = `${t("Nog nodig")}: ${opsomming(stap.ontbreekt)}.`;
      acties = (
        <>
          <button type="button" onClick={onZetOpLijst} disabled={bezig} className={knopHoofd}>
            {bezig ? (
              <Loader2 className="size-6 animate-spin" aria-hidden />
            ) : (
              <ShoppingCart className="size-6" aria-hidden />
            )}
            {t("Zet op mijn lijst")}
          </button>
          {startKoken(stap.recept, false)}
        </>
      );
      break;
    case "winkelen":
      label = `${t(momentLabel(stap.maaltijd.meal_type))} ${t("vandaag")}`;
      titel = t(stap.recept.title);
      uitleg = `${t("Op je lijst, nog te kopen")}: ${opsomming(stap.nogKopen)}.`;
      acties = (
        <>
          <Link to="/boodschappen" className={knopHoofd}>
            <ShoppingCart className="size-6" aria-hidden />
            {t("Naar mijn lijst")}
          </Link>
          {startKoken(stap.recept, false)}
        </>
      );
      break;
    case "koken": {
      label = `${t(momentLabel(stap.maaltijd.meal_type))} ${t("vandaag")}`;
      titel = t(stap.recept.title);
      const duur = kooktijd(stap.recept);
      uitleg = stap.beginOm
        ? `${t("Alles in huis.")} ${t("Begin om")} ${stap.beginOm}${duur ? ` (${duur})` : ""}.`
        : `${t("Alles in huis.")}${duur ? ` ${t("Klaar in")} ${duur}.` : ""}`;
      acties = (
        <>
          {startKoken(stap.recept, true)}
          {naarRecept(stap.recept, "Bekijk recept")}
        </>
      );
      break;
    }
    case "zonder-recept":
      label = `${t(momentLabel(stap.maaltijd.meal_type))} ${t("vandaag")}`;
      titel = t(stap.maaltijd.custom_title ?? "Maaltijd");
      uitleg = t("Nog zonder recept. Koppel er een, dan rekent Foodlo je boodschappen uit.");
      acties = (
        <Link to="/planner" className={knopHoofd}>
          {t("Naar het weekmenu")}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      );
      break;
    case "morgen":
      label = t("Morgen");
      if (!stap.maaltijd) {
        titel = t("Nog niets gepland");
        uitleg = t("Kies vast iets, dan staat je lijst morgen klaar.");
        acties = (
          <Link to="/planner" className={knopHoofd}>
            <CalendarDays className="size-6" aria-hidden />
            {t("Plan morgen")}
          </Link>
        );
      } else {
        titel = t(stap.maaltijd.recept?.title ?? stap.maaltijd.custom_title ?? "Maaltijd");
        uitleg = stap.ontbreekt.length
          ? `${t("Nog nodig voor morgen")}: ${opsomming(stap.ontbreekt)}.`
          : stap.maaltijd.recept
            ? t("Alles in huis of op je lijst.")
            : null;
        acties = stap.ontbreekt.length ? (
          <Link to="/aanvullen" className={knopHoofd}>
            <ShoppingCart className="size-6" aria-hidden />
            {t("Bekijk wat ontbreekt")}
          </Link>
        ) : stap.maaltijd.recept ? (
          <Link to="/recepten/$id" params={{ id: stap.maaltijd.recept.id }} className={knopHoofd}>
            {t("Bekijk recept")}
          </Link>
        ) : null;
      }
      break;
    case "kiezen":
      titel = t("Wat eten we vandaag?");
      uitleg = t("Er staat nog niets gepland. Kies een gerecht uit je recepten.");
      extra = <VanavondVoorstellen recepten={recepten} />;
      acties = (
        <Link to="/planner" className={knopTweede}>
          <Plus className="size-5" aria-hidden />
          {t("Gerecht kiezen")}
        </Link>
      );
      break;
    case "eerste-recept":
      titel = t("Wat eten we vandaag?");
      uitleg = t("Bewaar eerst een recept dat je lekker vindt. Daarna kan je het inplannen.");
      acties = (
        <Link to="/recepten/nieuw" className={knopHoofd}>
          <Plus className="size-5" aria-hidden />
          {t("Recept toevoegen")}
        </Link>
      );
      break;
  }

  return (
    <section
      aria-labelledby="vandaag-groet"
      className="relative mb-8 overflow-hidden rounded-[2rem] bg-inkt text-inkt-foreground shadow-kaart"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col p-6 sm:p-8 lg:p-10">
          <p className="flex items-center gap-2 text-base font-medium text-inkt-zacht">
            <CalendarDays className="size-5" aria-hidden />
            {datum}
          </p>
          <h1 id="vandaag-groet" className="mt-1 text-sectietitel text-inkt-foreground">
            {groet}
          </h1>

          <div className="mt-6 md:mt-auto md:pt-8" aria-live="polite">
            {laden || !stap ? (
              <p className="text-lg text-inkt-zacht">
                {t("Even kijken wat er op het menu staat…")}
              </p>
            ) : (
              <div data-nu={stap.soort}>
                {label ? (
                  <p className="text-base font-semibold uppercase tracking-[0.12em] text-[var(--honing)]">
                    {label}
                  </p>
                ) : null}
                <h2 className="mt-2 text-heldentitel text-inkt-foreground">{titel}</h2>
                {uitleg ? <p className="mt-3 max-w-md text-lg text-inkt-zacht">{uitleg}</p> : null}
                {extra}
                {acties ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                    {acties}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {recept ? (
          <Link
            to="/recepten/$id"
            params={{ id: recept.id }}
            tabIndex={-1}
            aria-hidden
            className="relative block min-h-48 overflow-hidden md:min-h-full"
          >
            <RecipePhoto
              path={recept.image_url ?? null}
              alt=""
              recept={recept}
              className="absolute inset-0 size-full"
              icoonClassName="size-28 max-h-28 max-w-28"
            />
          </Link>
        ) : (
          <div className="omslag omslag-groen hidden min-h-56 md:block" aria-hidden />
        )}
      </div>
    </section>
  );
}
