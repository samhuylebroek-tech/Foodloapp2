/** Weekbudget van de aangemelde gebruiker (per toestel). */
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BUDGET_GEWIJZIGD, leesWeekbudget, zetWeekbudget } from "@/lib/budget";

function abonneer(melding: () => void) {
  window.addEventListener(BUDGET_GEWIJZIGD, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(BUDGET_GEWIJZIGD, melding);
    window.removeEventListener("storage", melding);
  };
}

export function useWeekbudget(): [number | null, (bedrag: number | null) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const budget = useSyncExternalStore(
    abonneer,
    () => leesWeekbudget(id),
    () => null,
  );
  return [budget, (b: number | null) => id && zetWeekbudget(id, b)];
}
