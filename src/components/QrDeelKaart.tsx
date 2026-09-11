import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";
import { Copy, Share2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function QrDeelKaart({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [url, setUrl] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const appUrl = `${window.location.origin}/installeren`;
    setUrl(appUrl);
    let cancelled = false;
    toDataURL(appUrl, {
      width: compact ? 200 : 512,
      margin: 2,
      color: { dark: "#0f766e", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        toast.error(t("QR-code maken lukte niet"));
      });
    return () => {
      cancelled = true;
    };
  }, [compact, t]);

  async function deel() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Foodlo", text: t("Bekijk Foodlo"), url });
        return;
      } catch {
        // fall through to copy
      }
    }
    await kopieer();
  }

  async function kopieer() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("Link gekopieerd"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("Kopiëren lukte niet"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {qr ? (
          <img
            src={qr}
            alt={t("QR-code om Foodlo te openen")}
            className={compact ? "size-40 rounded-2xl" : "w-full max-w-sm rounded-3xl"}
          />
        ) : (
          <div
            className={
              compact
                ? "flex size-40 items-center justify-center rounded-2xl bg-muted"
                : "flex aspect-square w-full max-w-sm items-center justify-center rounded-3xl bg-muted"
            }
          >
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="break-all text-center text-base text-muted-foreground">{url}</p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={kopieer}
          disabled={!url}
          className="h-14 flex-1 rounded-2xl text-base"
        >
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
          {copied ? t("Gekopieerd") : t("Link kopiëren")}
        </Button>
        <Button
          onClick={deel}
          disabled={!url}
          className="h-14 flex-1 rounded-2xl text-base shadow-md shadow-primary/15"
        >
          <Share2 className="size-5" />
          {t("Delen")}
        </Button>
      </div>
    </div>
  );
}
