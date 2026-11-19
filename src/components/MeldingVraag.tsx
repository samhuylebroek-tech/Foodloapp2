import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/voorkeuren";
import { huidigeStatus, meldingenMogelijk, zetMeldingenAan, zetMeldingenUit } from "@/lib/meldingen";

const TELLER = "aanmeld-teller";
const SESSIE = "aanmeld-geteld";
const KEUZE = "melding-keuze-gemaakt";
const WEG = "melding-vraag-weg";

/** Telt één keer per aanmelding (per browsersessie). */
export function telAanmelding(): number {
  if (typeof window === "undefined") return 0;
  try {
    if (window.sessionStorage.getItem(SESSIE) === "ja") {
      return Number(window.localStorage.getItem(TELLER) ?? "0");
    }
    const nieuw = Number(window.localStorage.getItem(TELLER) ?? "0") + 1;
    window.localStorage.setItem(TELLER, String(nieuw));
    window.sessionStorage.setItem(SESSIE, "ja");
    return nieuw;
  } catch {
    return 0;
  }
}

export function meldingVraagAf(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEUZE) === "ja" || window.localStorage.getItem(WEG) === "ja";
  } catch {
    return true;
  }
}

/** Vraagt om de tien aanmeldingen één keer of je meldingen wil, tot je zelf kiest. */
export function MeldingVraag({ actief = true }: { actief?: boolean }) {
  const t = useT();
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!actief) return;
    if (typeof window === "undefined") return;
    if (!meldingenMogelijk()) return;
    if (meldingVraagAf()) return;

    let stop = false;
    void (async () => {
      // Al aan staan telt als een keuze.
      const status = await huidigeStatus();
      if (status === "aan") {
        window.localStorage.setItem(KEUZE, "ja");
        return;
      }
      const teller = Number(window.localStorage.getItem(TELLER) ?? "0");
      if (teller > 0 && teller % 10 === 0 && !stop) setZichtbaar(true);
    })();

    return () => {
      stop = true;
    };
  }, [actief]);

  if (!zichtbaar) return null;

  const onthoudKeuze = () => {
    try {
      window.localStorage.setItem(KEUZE, "ja");
    } catch {
      /* niets */
    }
    setZichtbaar(false);
  };

  const aanzetten = async () => {
    setBezig(true);
    const status = await zetMeldingenAan();
    setBezig(false);
    if (status === "aan") toast.success(t("Herinneringen staan aan"));
    else if (status === "geweigerd")
      toast.error(t("Je telefoon blokkeert meldingen. Je kan ze later alsnog aanzetten."));
    else if (status === "open-in-eigen-tab")
      toast.message(t("Open Foodlo vanaf je beginscherm om meldingen aan te zetten."));
    onthoudKeuze();
  };

  const uitzetten = async () => {
    setBezig(true);
    await zetMeldingenUit();
    setBezig(false);
    toast.message(t("Herinneringen blijven uit"));
    onthoudKeuze();
  };

  const nietMeerTonen = () => {
    try {
      window.localStorage.setItem(WEG, "ja");
    } catch {
      /* niets */
    }
    setZichtbaar(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-5 md:left-28 lg:left-3">
      <div
        role="region"
        aria-label={t("Wil je een seintje krijgen?")}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Bell className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{t("Een seintje op het juiste moment?")}</p>
            <p className="mt-1 text-base text-muted-foreground">
              {t("Bijvoorbeeld wanneer het tijd is om te koken.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setZichtbaar(false)}
            aria-label={t("Sluiten")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={bezig}
            onClick={() => void aanzetten()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
          >
            <Bell className="size-5" aria-hidden /> {t("Ja, zet aan")}
          </button>
          <button
            type="button"
            disabled={bezig}
            onClick={() => void uitzetten()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border px-3 text-base font-semibold"
          >
            <BellOff className="size-5" aria-hidden /> {t("Nee, houd ze uit")}
          </button>
          <button
            type="button"
            onClick={nietMeerTonen}
            className="col-span-2 min-h-12 w-full rounded-xl px-3 text-base font-semibold text-muted-foreground underline"
          >
            {t("Toon me dit niet meer")}
          </button>
        </div>
      </div>
    </div>
  );
}
