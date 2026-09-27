import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Tekent de streepjescode of QR-code volledig in de browser: geen internet nodig.
export function Barcode({
  waarde,
  formaat,
  hoogte = 110,
  className = "",
}: {
  waarde: string;
  formaat: string;
  hoogte?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    if (formaat === "QR") {
      QRCode.toDataURL(waarde, { margin: 1, width: 640, errorCorrectionLevel: "M" })
        .then((url) => {
          setQr(url);
          setFout(false);
        })
        .catch(() => setFout(true));
      return;
    }
    setQr(null);
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, waarde, {
        format: formaat,
        height: hoogte,
        width: 3,
        displayValue: false,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
      setFout(false);
    } catch {
      // Past het nummer niet in dit formaat, dan tekenen we het als CODE128.
      try {
        JsBarcode(svgRef.current, waarde, {
          format: "CODE128",
          height: hoogte,
          width: 3,
          displayValue: false,
          margin: 8,
          background: "#ffffff",
          lineColor: "#000000",
        });
        setFout(false);
      } catch {
        setFout(true);
      }
    }
  }, [waarde, formaat, hoogte]);

  if (fout) {
    return (
      <p className="rounded-xl bg-muted p-4 text-center text-base text-muted-foreground">
        Deze code kan niet getekend worden. Controleer het kaartnummer.
      </p>
    );
  }

  if (formaat === "QR") {
    return qr ? (
      <img src={qr} alt="QR-code van je klantenkaart" className={`mx-auto w-full max-w-xs ${className}`} />
    ) : null;
  }

  return <svg ref={svgRef} className={`mx-auto block h-auto w-full max-w-full ${className}`} />;
}
