/**
 * "Slimme voorstellen" aan of uit (standaard aan). Uit = Foodlo stelt niets uit zichzelf voor:
 * geen voorstellen op Vandaag, geen "Voor morgen nog nodig" in de winkel, geen "Gebruik eerst".
 * Wat je zelf vraagt (Laat Foodlo kiezen, Slim aanvullen) blijft werken.
 * Alleen op dit toestel; geen gezondheidsgegevens.
 */
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";

const sleutel = (userId: string) => `foodlo:slim:${userId}`;
const GEWIJZIGD = "foodlo:slim-gewijzigd";

export function slimAan(userId: string | null | undefined): boolean {
  if (!userId) return true;
  try {
    return window.localStorage.getItem(sleutel(userId)) !== "uit";
  } catch {
    return true;
  }
}

export function zetSlim(userId: string, aan: boolean) {
  try {
    if (aan) window.localStorage.removeItem(sleutel(userId));
    else window.localStorage.setItem(sleutel(userId), "uit");
  } catch {
    // Opslag geblokkeerd: de keuze geldt dan niet na herladen.
  }
  window.dispatchEvent(new Event(GEWIJZIGD));
}

function abonneer(melding: () => void) {
  window.addEventListener(GEWIJZIGD, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(GEWIJZIGD, melding);
    window.removeEventListener("storage", melding);
  };
}

/** [aan, zet] voor de aangemelde gebruiker. */
export function useSlimmeVoorstellen(): [boolean, (aan: boolean) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const aan = useSyncExternalStore(
    abonneer,
    () => slimAan(id),
    () => true,
  );
  return [aan, (waarde: boolean) => id && zetSlim(id, waarde)];
}
