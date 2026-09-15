// Streepjescode of QR-code lezen uit een foto. Alles gebeurt op de telefoon zelf.
import { BrowserMultiFormatReader } from "@zxing/browser";

export type Gelezen = { waarde: string; formaat: string };

export async function leesCodeUitBestand(file: File): Promise<Gelezen | null> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    const waarde = result?.getText?.();
    if (!waarde) return null;
    return { waarde, formaat: String(result.getBarcodeFormat?.() ?? "") };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ZXing geeft een getal of een naam terug; wij maken er onze eigen naam van.
export function zxingFormaat(formaat: string): string {
  const f = formaat.toLowerCase();
  if (f.includes("qr") || f === "11") return "qr_code";
  if (f.includes("ean_13") || f === "3") return "ean_13";
  if (f.includes("ean_8") || f === "4") return "ean_8";
  if (f.includes("code_39") || f === "1") return "code_39";
  if (f.includes("itf") || f === "6") return "itf";
  return "code_128";
}
