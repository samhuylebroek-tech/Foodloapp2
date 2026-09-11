import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

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
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    const url = window.location.origin;
    setLink(url);
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#7a3d22", light: "#faf6ee" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, []);

  async function deel() {
    if (navigator.share) {
      await navigator.share({ title: "Foodlo", url: link });
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Link gekopieerd");
    }
  }

  return (
    <AppShell title="App op je telefoon">
      <div className="space-y-6">
        <p className="text-lg leading-relaxed">
          Scan deze code met de camera van je telefoon. De app opent meteen — je hoeft niets te
          downloaden uit een app store.
        </p>

        <div className="flex justify-center rounded-3xl border border-border bg-card p-6">
          {qr ? (
            <img src={qr} alt="QR-code om de app te openen" className="size-64" />
          ) : (
            <div className="size-64 animate-pulse rounded-2xl bg-secondary" />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="break-all text-base text-muted-foreground">{link}</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={deel} className="h-16 flex-1 text-lg">
              <Share2 className="size-5" /> Link delen
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Link gekopieerd");
              }}
              className="h-16 flex-1 text-lg"
            >
              <Copy className="size-5" /> Kopiëren
            </Button>
          </div>
        </div>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg">Op een iPhone of iPad</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-lg leading-relaxed">
              <li>Open de link in Safari.</li>
              <li>Tik onderaan op het deel-icoon (vierkantje met pijltje).</li>
              <li>Kies “Zet op beginscherm”.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg">Op een Android-telefoon</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-lg leading-relaxed">
              <li>Open de link in Chrome.</li>
              <li>Tik rechtsboven op de drie puntjes.</li>
              <li>Kies “App installeren” of “Toevoegen aan startscherm”.</li>
            </ol>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
