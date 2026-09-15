import { useEffect, useRef, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leesCodeUitBestand, zxingFormaat } from "@/lib/kaart-scan";

// Scant een streepjescode of QR-code met de camera van de telefoon.
// Eerst de ingebouwde lezer van de browser; kan die het niet, dan onze eigen lezer.
// Alles gebeurt op het toestel zelf: geen AI, geen kosten.
export function KaartScanner({
  open,
  onSluiten,
  onGevonden,
}: {
  open: boolean;
  onSluiten: () => void;
  onGevonden: (waarde: string, formaat: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMelding(null);
    let stream: MediaStream | null = null;
    let stop = false;
    let timer: number | undefined;
    let controls: { stop: () => void } | null = null;

    const Detector = (globalThis as any).BarcodeDetector;

    const startEigenLezer = async () => {
      const video = videoRef.current;
      if (stop || !video) return;
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoElement(video, (result) => {
        if (stop || !result) return;
        const waarde = result.getText?.();
        if (!waarde) return;
        stop = true;
        controls?.stop();
        onGevonden(waarde, zxingFormaat(String(result.getBarcodeFormat?.() ?? "")));
      });
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera-niet-beschikbaar");
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
        } catch {
          // Sommige oudere telefoons begrijpen de achtercamera-voorkeur niet.
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        if (Detector) {
          try {
            const gewenst = [
              "ean_13",
              "ean_8",
              "code_128",
              "code_39",
              "itf",
              "qr_code",
              "codabar",
              "upc_a",
              "upc_e",
            ];
            const ondersteund = typeof Detector.getSupportedFormats === "function"
              ? await Detector.getSupportedFormats()
              : gewenst;
            const formats = gewenst.filter((formaat) => ondersteund.includes(formaat));
            if (!formats.length) throw new Error("geen-ondersteund-formaat");

            const detector = new Detector({ formats });
            const zoek = async () => {
              if (stop || !videoRef.current) return;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes?.length) {
                  const code = codes[0];
                  if (code.rawValue) {
                    stop = true;
                    onGevonden(code.rawValue, code.format ?? "code_128");
                    return;
                  }
                }
              } catch {
                // De ingebouwde lezer blijkt onbruikbaar: schakel meteen over.
                if (timer) window.clearTimeout(timer);
                await startEigenLezer();
                return;
              }
              timer = window.setTimeout(zoek, 350);
            };
            void zoek();
            return;
          } catch {
            // Een gedeeltelijk aanwezige BarcodeDetector komt veel voor op telefoons.
            // Gebruik dan zonder foutmelding onze eigen lezer.
          }
        }

        // Geen ingebouwde lezer (bv. iPhone): onze eigen lezer op hetzelfde beeld.
        await startEigenLezer();
      } catch {
        setMelding("We kunnen de camera niet openen. Kies een foto van je kaart, of typ het nummer zelf in.");
      }
    })();

    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onGevonden]);

  const kiesFoto = async (file: File | undefined) => {
    if (!file) return;
    setBezig(true);
    const gelezen = await leesCodeUitBestand(file);
    setBezig(false);
    if (!gelezen) {
      setMelding(
        "We zien geen code op die foto. Probeer opnieuw, recht van boven en dichterbij — of typ het nummer zelf in.",
      );
      return;
    }
    onGevonden(gelezen.waarde, zxingFormaat(gelezen.formaat));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex justify-end p-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
        <button
          type="button"
          onClick={onSluiten}
          aria-label="Scannen stoppen"
          className="flex size-12 items-center justify-center rounded-2xl bg-white/15 text-white"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10 text-center">
        {melding ? (
          <p className="text-lg text-white">{melding}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full max-w-md rounded-2xl" />
            <p className="text-lg text-white">Houd de streepjescode van je kaart voor de camera.</p>
          </>
        )}
        <div className="flex w-full max-w-md flex-col gap-3">
          <Button
            variant="secondary"
            disabled={bezig}
            onClick={() => fotoRef.current?.click()}
            className="h-14 gap-2 text-base"
          >
            <ImageIcon className="size-5" aria-hidden />
            {bezig ? "Even kijken…" : "Foto van je kaart kiezen"}
          </Button>
          <Button variant="outline" onClick={onSluiten} className="h-14 text-base">
            Zelf invullen
          </Button>
        </div>
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void kiesFoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
