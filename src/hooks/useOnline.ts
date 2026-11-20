import { useSyncExternalStore } from "react";
import { leesWachtrij, WACHTRIJ_EVENT } from "@/lib/boodschappen-geheugen";

function abonneer(melding: () => void) {
  window.addEventListener("online", melding);
  window.addEventListener("offline", melding);
  return () => {
    window.removeEventListener("online", melding);
    window.removeEventListener("offline", melding);
  };
}

/** Is er verbinding? Op de server (geen navigator) gaan we uit van wel. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    abonneer,
    () => navigator.onLine,
    () => true,
  );
}

function abonneerWachtrij(melding: () => void) {
  window.addEventListener(WACHTRIJ_EVENT, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(WACHTRIJ_EVENT, melding);
    window.removeEventListener("storage", melding);
  };
}

/** Hoeveel lijstwijzigingen wachten om verstuurd te worden (offline gemaakt). */
export function useWachtrijAantal(): number {
  return useSyncExternalStore(
    abonneerWachtrij,
    () => leesWachtrij().length,
    () => 0,
  );
}
