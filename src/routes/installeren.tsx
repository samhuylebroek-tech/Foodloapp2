import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import QRCode from "qrcode";
import { Copy, Share2, Download, Smartphone, Check, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";
import { appOrigin } from "@/lib/app-url";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/installeren")({
  head: () => ({
    meta: [
      { title: "App installeren – Foodlo" },
      {
        name: "description",
        content:
          "Scan de QR-code of deel de link om Foodlo als app op je telefoon te zetten. Geen app store nodig.",
      },
      { property: "og:title", content: "App installeren – Foodlo" },
      {
        property: "og:description",
        content: "Zet Foodlo op je telefoon via een QR-code of link.",
      },
    ],
  }),
  component: InstallerenPage,
});

function InstallerenPage() {
  const t = useT();
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = `${appOrigin()}/installeren`;
    setLink(url);

    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      color: { dark: "#0f766e", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(""));

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      toast.success(t("Foodlo wordt geïnstalleerd"));
    }
    setInstallPrompt(null);
  }

  async function deel() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Foodlo", text: t("Bekijk Foodlo"), url: link });
        return;
      } catch {
        // fall through to copy
      }
    }
    await kopieer();
  }

  async function kopieer() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t("Link gekopieerd"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("Kopiëren lukte niet"));
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-10">
      <header className="mx-auto flex max-w-md items-center gap-3">
        <img src={logo} alt="Foodlo" className="size-10" />
        <h1 className="text-2xl font-bold tracking-tight">Foodlo</h1>
      </header>

      <main className="mx-auto mt-6 max-w-md space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="size-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">
            {t("Zet Foodlo op je telefoon")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t(
              "Scan deze QR-code met je camera. Je opent de app meteen in je browser — geen app store nodig."
            )}
          </p>
          <p className="mt-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-base font-semibold text-emerald-700">
            {t("Geen App Store of Play Store nodig")}
          </p>

          <div className="mt-6 flex justify-center rounded-3xl bg-white p-4">
            {qr ? (
              <img
                src={qr}
                alt={t("QR-code om Foodlo te installeren")}
                className="size-64 rounded-2xl sm:size-72"
              />
            ) : (
              <div className="flex size-64 items-center justify-center rounded-2xl bg-muted sm:size-72">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <p className="mt-4 break-all text-base text-muted-foreground">{link}</p>

          <div className="mt-5 flex flex-col gap-3 min-[400px]:flex-row">
            <Button
              variant="outline"
              onClick={kopieer}
              disabled={!link}
              className="h-14 flex-1 rounded-2xl text-base"
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
              {copied ? t("Gekopieerd") : t("Link kopiëren")}
            </Button>
            <Button
              onClick={deel}
              disabled={!link}
              className="h-14 flex-1 rounded-2xl text-base shadow-md shadow-primary/15"
            >
              <Share2 className="size-5" />
              {t("Delen")}
            </Button>
          </div>

          {installPrompt && (
            <Button
              onClick={install}
              className="mt-4 h-14 w-full rounded-2xl text-base shadow-md shadow-primary/15"
            >
              <Download className="size-5" />
              {t("Foodlo installeren")}
            </Button>
          )}

          {isInstalled && (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-base font-medium text-emerald-700">
              {t("Foodlo staat al op je startscherm. Veel kookplezier!")}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-bold">{t("Op een iPhone of iPad")}</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-muted-foreground">
              <li>{t("Open deze pagina in Safari.")}</li>
              <li>{t("Tik onderaan op het deel-icoon (vierkantje met pijltje).")}</li>
              <li>{t("Scroll naar beneden en kies ‘Zet op beginscherm’.")}</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-bold">{t("Op een Android-telefoon")}</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-muted-foreground">
              <li>{t("Open deze pagina in Chrome.")}</li>
              <li>{t("Tik rechtsboven op de drie puntjes.")}</li>
              <li>{t("Kies ‘App installeren’ of ‘Toevoegen aan startscherm’.")}</li>
            </ol>
          </div>
        </section>

        <div className="text-center">
          <Link
            to="/aanmelden"
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-5" />
            {t("Terug naar Foodlo")}
          </Link>
        </div>
      </main>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
