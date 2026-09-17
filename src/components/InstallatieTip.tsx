import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone, X, Share, SquarePlus, MoreHorizontal } from "lucide-react";
import { useT } from "@/lib/voorkeuren";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SLEUTEL = "installatie-tip-weg";
/** Per aanmelding maar één keer tonen. */
const SESSIE_SLEUTEL = "installatie-tip-getoond";

export function isGeinstalleerd(): boolean {
  if (typeof window === "undefined") return true;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(standalone || iosStandalone);
}

export function installatieTipAf(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SLEUTEL) === "ja" || isGeinstalleerd();
  } catch {
    return false;
  }
}

type Toestel = "ios-safari" | "ios-chrome" | "android" | "desktop";

function bepaalToestel(): Toestel {
  const ua = window.navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  if (ios) return /crios|fxios|edgios/i.test(ua) ? "ios-chrome" : "ios-safari";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Duidelijke uitleg om Foodlo op het beginscherm te zetten. Blijft komen tot je zelf kiest. */
export function InstallatieTip({ actief = true }: { actief?: boolean }) {
  const t = useT();
  const [zichtbaar, setZichtbaar] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [toestel, setToestel] = useState<Toestel>("desktop");

  useEffect(() => {
    if (!actief) return;
    if (typeof window === "undefined") return;
    if (installatieTipAf()) return;
    if (window.sessionStorage.getItem(SESSIE_SLEUTEL) === "ja") return;

    setToestel(bepaalToestel());

    const opPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", opPrompt);

    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(SESSIE_SLEUTEL, "ja");
      setZichtbaar(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", opPrompt);
      window.clearTimeout(timer);
    };
  }, [actief]);

  if (!zichtbaar) return null;

  const later = () => setZichtbaar(false);

  const nooitMeer = () => {
    setZichtbaar(false);
    try {
      window.localStorage.setItem(SLEUTEL, "ja");
    } catch {
      /* niets */
    }
  };

  const installeer = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const keuze = await prompt.userChoice;
    if (keuze.outcome === "accepted") nooitMeer();
    else later();
  };

  const stappen: { tekst: string; icoon?: typeof Share }[] =
    toestel === "ios-safari"
      ? [
          { tekst: t("Tik onderaan in de balk op het deel-icoontje."), icoon: Share },
          { tekst: t("Scrol en kies “Zet op beginscherm”."), icoon: SquarePlus },
          { tekst: t("Tik rechtsboven op “Voeg toe”. Klaar!") },
        ]
      : toestel === "ios-chrome"
        ? [
            { tekst: t("Tik rechtsonder op de drie puntjes."), icoon: MoreHorizontal },
            { tekst: t("Kies “Delen”."), icoon: Share },
            { tekst: t("Kies “Zet op beginscherm” en tik op “Voeg toe”."), icoon: SquarePlus },
          ]
        : toestel === "android"
          ? [
              { tekst: t("Tik rechtsboven op de drie puntjes."), icoon: MoreHorizontal },
              { tekst: t("Kies “App installeren” of “Toevoegen aan startscherm”.") },
              { tekst: t("Bevestig met “Installeren”. Klaar!") },
            ]
          : [
              { tekst: t("Klik in de adresbalk op het installatie-icoontje.") },
              { tekst: t("Of open het menu van je browser en kies “Installeren”.") },
            ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Zet Foodlo op je beginscherm")}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Smartphone className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold">{t("Zet Foodlo op je telefoon")}</p>
            <p className="mt-1 text-base text-muted-foreground">
              {t("Zo open je Foodlo met één tik, net als een gewone app.")}
            </p>
          </div>
          <button
            type="button"
            onClick={later}
            aria-label={t("Sluiten")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <ol className="mt-4 space-y-3">
          {stappen.map((s, i) => {
            const Icoon = s.icoon;
            return (
              <li key={s.tekst} className="flex items-start gap-3 rounded-2xl bg-secondary p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="flex flex-1 items-center gap-2 text-base">
                  {Icoon ? <Icoon className="size-5 shrink-0 text-primary" aria-hidden /> : null}
                  {s.tekst}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 space-y-2">
          {prompt ? (
            <button
              type="button"
              onClick={() => void installeer()}
              className="min-h-14 w-full rounded-2xl bg-primary px-5 text-lg font-semibold text-primary-foreground"
            >
              {t("Nu installeren")}
            </button>
          ) : (
            <Link
              to="/installeren"
              onClick={later}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary px-5 text-lg font-semibold text-primary-foreground"
            >
              {t("Toon mij hoe")}
            </Link>
          )}
          <button
            type="button"
            onClick={later}
            className="min-h-14 w-full rounded-2xl border border-border px-5 text-base font-semibold"
          >
            {t("Later")}
          </button>
          <button
            type="button"
            onClick={nooitMeer}
            className="min-h-12 w-full rounded-2xl px-5 text-base font-semibold text-muted-foreground underline"
          >
            {t("Ik heb dit gedaan — niet meer tonen")}
          </button>
        </div>
      </div>
    </div>
  );
}
