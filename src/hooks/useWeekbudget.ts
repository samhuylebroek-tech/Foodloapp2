/**
 * Weekbudget van de aangemelde gebruiker: op het account (planprofiel, voorstel 0013) en, als
 * terugval, op dit toestel. Bewaren schrijft beide, zodat wissen ook echt wist.
 */
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanProfiel } from "@/hooks/usePlanProfiel";
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
  const plan = usePlanProfiel();
  const toestel = useSyncExternalStore(
    abonneer,
    () => leesWeekbudget(id),
    () => null,
  );
  const budget = plan.opslag === "account" ? (plan.profiel.weekbudget ?? toestel) : toestel;
  return [
    budget,
    (b: number | null) => {
      if (!id) return;
      zetWeekbudget(id, b);
      if (plan.opslag === "account") void plan.bewaar({ weekbudget: b }).catch(() => undefined);
    },
  ];
}
