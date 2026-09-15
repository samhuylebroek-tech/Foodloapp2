/** Clientkant van de meldingen: toestemming vragen, abonneren en afmelden. */
import {
  bewaarPushAbonnement,
  bewaarTijdzone,
  meldingAangetikt,
  vapidSleutel,
  verwijderPushAbonnement,
} from "@/lib/meldingen.functions";

export type MeldingStatus =
  | "aan"
  | "uit"
  | "geweigerd"
  | "niet-ondersteund"
  | "open-in-eigen-tab";

function naarBytes(base64url: string) {
  const pad = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function naarB64url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  let s = "";
  for (const x of new Uint8Array(buffer)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function meldingenMogelijk() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function huidigeStatus(): Promise<MeldingStatus> {
  if (!meldingenMogelijk()) return "niet-ondersteund";
  if (Notification.permission === "denied") return "geweigerd";
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo ? "aan" : "uit";
}

/** Vraagt toestemming en meldt het toestel aan. Alleen op een gebruikersactie oproepen. */
export async function zetMeldingenAan(): Promise<MeldingStatus> {
  if (!meldingenMogelijk()) return "niet-ondersteund";
  if (window.top !== window.self && Notification.permission !== "granted") return "open-in-eigen-tab";

  const toestemming =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (toestemming !== "granted") return "geweigerd";

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  const { sleutel } = await vapidSleutel();
  if (!sleutel) return "uit";

  const bestaand = await reg.pushManager.getSubscription();
  const abo =
    bestaand ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: naarBytes(sleutel) as BufferSource,
    }));

  await bewaarPushAbonnement({
    data: {
      endpoint: abo.endpoint,
      p256dh: naarB64url(abo.getKey("p256dh")),
      auth: naarB64url(abo.getKey("auth")),
      userAgent: navigator.userAgent,
      tijdzone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  return "aan";
}

export async function zetMeldingenUit() {
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) {
    await verwijderPushAbonnement({ data: { endpoint: abo.endpoint } });
    await abo.unsubscribe();
  }
  return "uit" as const;
}

/** Tijdzone bijwerken wanneer de gebruiker reist. */
export async function synchroniseerTijdzone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || window.localStorage.getItem("tijdzone") === tz) return;
    await bewaarTijdzone({ data: { tijdzone: tz } });
    window.localStorage.setItem("tijdzone", tz);
  } catch {
    // niet erg
  }
}

/** Melden dat de gebruiker op een melding heeft getikt (?mld=… in de URL). */
export async function verwerkMeldingKlik() {
  try {
    const url = new URL(window.location.href);
    const sleutel = url.searchParams.get("mld");
    if (!sleutel) return;
    url.searchParams.delete("mld");
    window.history.replaceState({}, "", url.toString());
    await meldingAangetikt({ data: { sleutel } });
  } catch {
    // niet erg
  }
}
