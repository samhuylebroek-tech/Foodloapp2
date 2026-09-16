import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";
import { opRondleidingWijziging, rondleidingActief, stopRondleiding } from "@/lib/rondleiding";

type Stap = { route: string; doel?: string; titel: string; tekst: string };

const STAPPEN: Stap[] = [
  {
    route: "/",
    doel: '[data-tour="nav-/"],[data-tour="tab-/"]',
    titel: "Je startscherm",
    tekst: "Hier zie je wat je vandaag eet, wat er op je lijstje staat en je favorieten.",
  },
  {
    route: "/gerechten",
    doel: '[data-tour="nav-/gerechten"],[data-tour="tab-/gerechten"]',
    titel: "Al je recepten",
    tekst: "Zoek op naam of filter, en tik op een gerecht om het te bekijken of te koken.",
  },
  {
    route: "/recepten/nieuw",
    titel: "Een gerecht toevoegen",
    tekst: "Plak een link van een website of video, typ het zelf, of neem een foto van je bord.",
  },
  {
    route: "/planner",
    doel: '[data-tour="nav-/planner"],[data-tour="tab-/planner"]',
    titel: "Je weekmenu",
    tekst: "Plan per dag wat je eet. Kook je samen? Schakel bovenaan naar het gezinsmenu.",
  },
  {
    route: "/boodschappen",
    doel: '[data-tour="nav-/boodschappen"],[data-tour="tab-/boodschappen"]',
    titel: "Boodschappen",
    tekst: "Je lijst vult zichzelf vanuit je weekmenu. In de winkel vink je gewoon af.",
  },
  {
    route: "/voorraad",
    titel: "Voorraadkast",
    tekst: "Zet erin wat je al in huis hebt, dan koop je niets dubbel.",
  },
  {
    route: "/kaarten",
    titel: "Klantenkaarten",
    tekst: "Scan je winkelkaarten in en toon ze groot aan de kassa, ook zonder internet.",
  },
  {
    route: "/vrienden",
    titel: "Vrienden en gezin",
    tekst: "Nodig iemand uit en kies per persoon wat je deelt: recepten, weekmenu of lijst.",
  },
  {
    route: "/meldingen",
    titel: "Meldingen",
    tekst: "Een seintje om te plannen, te winkelen of te koken. Jij kiest zelf welke.",
  },
  {
    route: "/instellingen",
    titel: "Instellingen",
    tekst: "Hier pas je alles aan en kan je deze rondleiding altijd opnieuw starten.",
  },
];

export function Rondleiding() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const [aan, setAan] = useState(false);
  const [i, setI] = useState(0);
  const [kader, setKader] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

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
    function meet() {
      if (stop) return;
      const kandidaten = stap?.doel ? Array.from(document.querySelectorAll(stap.doel)) : [];
      const el = kandidaten.find((k) => k.getBoundingClientRect().width > 0);
      if (el) {
        const r = el.getBoundingClientRect();
        setKader({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setKader(null);
      }
    }
    const id = window.setTimeout(meet, 250);
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

  function sluit() {
    stopRondleiding();
    setI(0);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" role="dialog" aria-label={t("Rondleiding")}>
      {kader ? (
        <div
          aria-hidden
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
        className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <p className="text-sm text-muted-foreground">
          {t("Stap")} {i + 1} {t("van")} {STAPPEN.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + 1) / STAPPEN.length) * 100}%` }} />
        </div>

        <h2 className="mt-3 font-display text-2xl">{t(stap.titel)}</h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">{t(stap.tekst)}</p>

        <div className="mt-4 flex gap-3">
          {i > 0 ? (
            <Button variant="secondary" onClick={() => setI(i - 1)} className="h-14 flex-1 text-base">
              {t("Vorige")}
            </Button>
          ) : null}
          <Button onClick={() => (laatste ? sluit() : setI(i + 1))} className="h-14 flex-1 text-base">
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
