/**
 * Centrale plek voor de twee Foodlo-adressen.
 * - app: de echte Foodlo-app (PWA) — app.foodloapp.com
 * - marketing: de publieke website — www.foodloapp.com
 * Beide zijn instelbaar via .env.
 */
function schoon(waarde: string | undefined, terugval: string): string {
  const v = (waarde ?? "").trim().replace(/\/+$/, "");
  return v.startsWith("http") ? v : terugval;
}

export const APP_ORIGIN = schoon(
  import.meta.env["VITE_FOODLO_APP_URL"] as string | undefined,
  "https://app.foodloapp.com",
);

export const MARKETING_ORIGIN = schoon(
  import.meta.env["VITE_FOODLO_MARKETING_URL"] as string | undefined,
  "https://www.foodloapp.com",
);

/** Link naar een pagina op de marketingwebsite. */
export function marketingUrl(pad = "/"): string {
  return `${MARKETING_ORIGIN}${pad.startsWith("/") ? pad : `/${pad}`}`;
}

/** Eigen domein gebruiken, nooit een voorbeeld-URL van de bouwomgeving. */
export function appOrigin(): string {
  if (typeof window === "undefined") return APP_ORIGIN;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return window.location.origin;
  if (host.endsWith("lovable.app") || host.endsWith("lovableproject.com")) return APP_ORIGIN;
  return window.location.origin;
}
