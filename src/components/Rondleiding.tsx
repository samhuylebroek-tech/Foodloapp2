import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";
import { useAuth } from "@/hooks/useAuth";
import { stappenVoor } from "@/lib/rondleiding-stappen";
import { korteRondleiding, leesKennismaking } from "@/lib/kennismaking";
import {
  bewaardeStap,
  bewaarStap,
  opRondleidingWijziging,
  pauzeerRondleiding,
  rondleidingActief,
  stopRondleiding,
} from "@/lib/rondleiding";

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

  const { user } = useAuth();
  const stappen = stappenVoor(korteRondleiding(leesKennismaking(user?.id)));
  const kop = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const zetStand = () => {
      const actief = rondleidingActief();
      // Hervatten waar je gebleven was ("Later").
      if (actief) setI(Math.min(bewaardeStap(), stappen.length - 1));
      setAan(actief);
    };
    zetStand();
    return opRondleidingWijziging(zetStand);
  }, [stappen.length]);

  // Elke stap bewaren, zodat je na herladen of "Later" verder kan.
  useEffect(() => {
    if (aan) bewaarStap(i);
  }, [aan, i]);

  // Schermlezer en toetsenbord: focus naar de uitleg bij elke stap; Escape = later verder.
  useEffect(() => {
    if (!aan) return;
    const id = window.setTimeout(() => kop.current?.focus(), 50);
    const toets = (e: KeyboardEvent) => {
      if (e.key === "Escape") pauzeerRondleiding(i);
    };
    window.addEventListener("keydown", toets);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", toets);
    };
  }, [aan, i]);

  const stap = stappen[i];

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
    // BUG-063: de eerste meting viel soms vóór de lay-out stond (onderbalk nog bovenaan).
    // Pas tonen als twee metingen na elkaar gelijk zijn; anders even later opnieuw meten.
    let vorige: { top: number; left: number; width: number; height: number } | null = null;
    // Op een trage telefoon staat het aangewezen onderdeel er soms nog niet na 250 ms.
    // Dan meten we opnieuw, tot het verschijnt (hooguit ~5 s).
    function meet() {
      if (stop) return;
      const kandidaten = stap?.doel ? Array.from(document.querySelectorAll(stap.doel)) : [];
      const el = kandidaten.find((k) => k.getBoundingClientRect().width > 0);
      if (el) {
        const r = el.getBoundingClientRect();
        const nu = { top: r.top, left: r.left, width: r.width, height: r.height };
        const stabiel =
          vorige !== null &&
          Math.abs(vorige.top - nu.top) < 1 &&
          Math.abs(vorige.left - nu.left) < 1 &&
          Math.abs(vorige.width - nu.width) < 1 &&
          Math.abs(vorige.height - nu.height) < 1;
        vorige = nu;
        if (stabiel) setKader(nu);
        else if (pogingen++ < 40) id = window.setTimeout(meet, 80);
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

  const laatste = i === stappen.length - 1;
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
          className="absolute rounded-2xl ring-4 ring-primary"
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
          {t("Stap")} {i + 1} {t("van")} {stappen.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((i + 1) / stappen.length) * 100}%` }}
          />
        </div>

        <h2 ref={kop} tabIndex={-1} className="mt-3 text-sectietitel outline-none">
          {t(stap.titel)}
        </h2>
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
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => pauzeerRondleiding(i)} className="h-12 text-base">
            {t("Later verder")}
          </Button>
          <Button variant="ghost" onClick={sluit} className="h-12 text-base">
            {t("Overslaan")}
          </Button>
        </div>
      </div>
    </div>
  );
}
