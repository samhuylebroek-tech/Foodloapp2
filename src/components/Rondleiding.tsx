import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";
import { opRondleidingWijziging, rondleidingActief, stopRondleiding } from "@/lib/rondleiding";

type Stap = { route: string; doel?: string; titel: string; tekst: string };

const STAPPEN: Stap[] = [
  // V2: de vijf vaste plekken, dan "Nieuw" en "Meer". Kort: één zin per stap.
  {
    route: "/",
    doel: '[data-tour="nav-/"],[data-tour="tab-/"],[data-tour="zij-/"]',
    titel: "Vandaag",
    tekst: "Wat je vandaag eet en wat er nog moet gebeuren. Altijd één duidelijke knop.",
  },
  {
    route: "/planner",
    doel: '[data-tour="nav-/planner"],[data-tour="tab-/planner"],[data-tour="zij-/planner"]',
    titel: "Week",
    tekst: "Plan wat je deze week eet. Foodlo rekent uit wat je nodig hebt.",
  },
  {
    route: "/boodschappen",
    doel: '[data-tour="nav-/boodschappen"],[data-tour="tab-/boodschappen"],[data-tour="zij-/boodschappen"]',
    titel: "Lijst",
    tekst: "Eén tik zet wat ontbreekt op je lijst. Wat je al hebt, laat Foodlo weg.",
  },
  {
    route: "/gerechten",
    doel: '[data-tour="nav-/gerechten"],[data-tour="tab-/gerechten"],[data-tour="zij-/gerechten"]',
    titel: "Keuken",
    tekst: "Je recepten en je voorraad. Gekocht en gekookt wordt vanzelf bijgewerkt.",
  },
  {
    route: "/inspiratie",
    doel: '[data-tour="nav-/inspiratie"],[data-tour="tab-/inspiratie"],[data-tour="zij-/inspiratie"]',
    titel: "Ontdek",
    tekst: "Nieuwe ideeën om te koken. Eén tik bewaart een recept bij de jouwe.",
  },
  {
    route: "/",
    doel: '[data-tour="nieuw"]',
    titel: "Iets toevoegen",
    tekst: "Een recept, een maaltijd, een boodschap of iets in je voorraad: altijd via deze knop.",
  },
  {
    route: "/",
    doel: '[data-tour="meer"]',
    titel: "Meer",
    tekst:
      "Je gezin, klantenkaarten, meldingen en instellingen. Hier start je deze rondleiding opnieuw.",
  },
];

export function Rondleiding() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const [aan, setAan] = useState(false);
  const [i, setI] = useState(0);
  const [kader, setKader] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setAan(rondleidingActief());
    return opRondleidingWijziging(() => setAan(rondleidingActief()));
  }, []);

  const stap = STAPPEN[i];

  // Elke stap brengt je naar het juiste scherm.
  useEffect(() => {
    if (!aan || !stap) return;
    if (pathname !== stap.route) navigate({ to: stap.route });
  }, [aan, i, stap, pathname, navigate]);

  useLayoutEffect(() => {
    if (!aan || !stap) return;
    let stop = false;
    let pogingen = 0;
    let id = 0;
    // Op een trage telefoon staat het aangewezen onderdeel er soms nog niet na 250 ms.
    // Dan meten we opnieuw, tot het verschijnt (hooguit ~5 s).
    function meet() {
      if (stop) return;
      const kandidaten = stap?.doel ? Array.from(document.querySelectorAll(stap.doel)) : [];
      const el = kandidaten.find((k) => k.getBoundingClientRect().width > 0);
      if (el) {
        const r = el.getBoundingClientRect();
        setKader({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setKader(null);
        if (stap?.doel && pogingen++ < 20) id = window.setTimeout(meet, 250);
      }
    }
    id = window.setTimeout(meet, 250);
    window.addEventListener("resize", meet);
    window.addEventListener("scroll", meet, true);
    return () => {
      stop = true;
      window.clearTimeout(id);
      window.removeEventListener("resize", meet);
      window.removeEventListener("scroll", meet, true);
    };
  }, [aan, i, stap, pathname]);

  if (!aan || !stap) return null;

  const laatste = i === STAPPEN.length - 1;
  // Zit wat we aanwijzen onderaan (de onderbalk op de telefoon)? Dan staat de uitleg bovenaan,
  // anders zou ze het aangewezen onderdeel bedekken.
  const kaartBoven =
    kader !== null && typeof window !== "undefined" && kader.top > window.innerHeight / 2;

  function sluit() {
    stopRondleiding();
    setI(0);
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      role="dialog"
      aria-label={t("Rondleiding")}
    >
      {kader ? (
        <div
          aria-hidden
          data-rondleiding-kader
          className="absolute rounded-2xl ring-4 ring-primary transition-all"
          style={{
            top: kader.top - 6,
            left: kader.left - 6,
            width: kader.width + 12,
            height: kader.height + 12,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.45)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-foreground/35" />
      )}

      <div
        data-rondleiding-kaart
        className={
          kaartBoven
            ? "pointer-events-auto absolute inset-x-0 top-0 mx-auto w-full max-w-lg rounded-b-3xl bg-card p-5 shadow-2xl"
            : "pointer-events-auto absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-2xl"
        }
        style={
          kaartBoven
            ? { paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }
            : { paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }
        }
      >
        <p className="text-base text-muted-foreground">
          {t("Stap")} {i + 1} {t("van")} {STAPPEN.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((i + 1) / STAPPEN.length) * 100}%` }}
          />
        </div>

        <h2 className="mt-3 text-sectietitel">{t(stap.titel)}</h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">{t(stap.tekst)}</p>

        <div className="mt-4 flex gap-3">
          {i > 0 ? (
            <Button
              variant="secondary"
              onClick={() => setI(i - 1)}
              className="h-14 flex-1 text-base"
            >
              {t("Vorige")}
            </Button>
          ) : null}
          <Button
            onClick={() => (laatste ? sluit() : setI(i + 1))}
            className="h-14 flex-1 text-base"
          >
            {laatste ? t("Klaar") : t("Volgende")}
          </Button>
        </div>
        <Button variant="ghost" onClick={sluit} className="mt-2 h-12 w-full text-base">
          {t("Overslaan")}
        </Button>
      </div>
    </div>
  );
}
