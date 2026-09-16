import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone, X, Share } from "lucide-react";
import { useT } from "@/lib/voorkeuren";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SLEUTEL = "installatie-tip-weg";

function isGeinstalleerd(): boolean {
  if (typeof window === "undefined") return true;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(standalone || iosStandalone);
}

/** Vriendelijke tip om Foodlo op het beginscherm te zetten. Nooit opdringerig. */
export function InstallatieTip() {
  const t = useT();
  const [zichtbaar, setZichtbaar] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isGeinstalleerd()) return;
    if (window.localStorage.getItem(SLEUTEL) === "ja") return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIos(ios);

    const opPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setZichtbaar(true);
    };
    window.addEventListener("beforeinstallprompt", opPrompt);

    // Op iPhone bestaat die melding niet: daar tonen we zelf de uitleg.
    const timer = window.setTimeout(() => {
      if (ios) setZichtbaar(true);
    }, 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", opPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!zichtbaar) return null;

  const sluit = () => {
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
    await prompt.userChoice;
    sluit();
  };

  return (
    <div
      role="region"
      aria-label={t("Foodlo op je beginscherm")}
      className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-border bg-card p-4 shadow-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Smartphone className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{t("Zet Foodlo op je beginscherm")}</p>
          <p className="mt-1 text-base text-muted-foreground">
            {isIos
              ? t("Tik onderaan op Delen en kies “Zet op beginscherm”.")
              : t("Open Foodlo voortaan rechtstreeks vanaf je startscherm, net als een gewone app.")}
          </p>
          {isIos ? (
            <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
              <Share className="size-5" aria-hidden /> {t("Delen")} → {t("Zet op beginscherm")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {prompt ? (
              <button
                type="button"
                onClick={installeer}
                className="min-h-14 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground"
              >
                {t("Installeren")}
              </button>
            ) : (
              <Link
                to="/installeren"
                onClick={sluit}
                className="flex min-h-14 items-center rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground"
              >
                {t("Toon mij hoe")}
              </Link>
            )}
            <button
              type="button"
              onClick={sluit}
              className="min-h-14 rounded-xl border border-border px-5 text-lg font-semibold"
            >
              {t("Later")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={sluit}
          aria-label={t("Sluiten")}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
