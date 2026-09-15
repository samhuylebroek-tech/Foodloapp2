import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Scant een streepjescode of QR-code met de camera van de telefoon.
// Gebruikt de ingebouwde scanner van de browser: geen AI, geen kosten.
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
  const [melding, setMelding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let timer: number | undefined;

    const Detector = (globalThis as any).BarcodeDetector;
    if (!Detector) {
      setMelding(
        "Je telefoon kan hier geen code scannen. Typ het kaartnummer gewoon zelf in — dat werkt even goed.",
      );
      return;
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "itf", "qr_code", "codabar", "upc_a", "upc_e"],
        });
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
            /* even niets gevonden */
          }
          timer = window.setTimeout(zoek, 350);
        };
        zoek();
      } catch {
        setMelding("We kunnen de camera niet openen. Geef toestemming, of typ het nummer zelf in.");
      }
    })();

    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onGevonden]);

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
          <>
            <p className="text-lg text-white">{melding}</p>
            <Button onClick={onSluiten} className="h-14 px-8 text-base">
              Zelf invullen
            </Button>
          </>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full max-w-md rounded-2xl" />
            <p className="text-lg text-white">Houd de streepjescode van je kaart voor de camera.</p>
          </>
        )}
      </div>
    </div>
  );
}
