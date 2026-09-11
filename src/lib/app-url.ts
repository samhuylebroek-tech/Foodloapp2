export const APP_ORIGIN = "https://foodloapp.com";

/** Eigen domein gebruiken, nooit een voorbeeld-URL van de bouwomgeving. */
export function appOrigin(): string {
  if (typeof window === "undefined") return APP_ORIGIN;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return window.location.origin;
  if (host.endsWith("lovable.app") || host.endsWith("lovableproject.com")) return APP_ORIGIN;
  return window.location.origin;
}
