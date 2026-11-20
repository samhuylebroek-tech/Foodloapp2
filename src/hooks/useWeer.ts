/**
 * Weer voor Vandaag en de voorstellen: bron (testadapter in de demo, anders geen), schakelaar
 * aan/uit en het signaal. Zonder bron of met de schakelaar uit: `weer` is null.
 */
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSuggesties } from "@/hooks/useSuggesties";
import { isAan } from "@/lib/suggesties";
import { weerFactor, type WeerFactor } from "@/lib/weer-seizoen";
import {
  kiesWeerAdapter,
  weerAan,
  weerSignaal,
  WEER_GEWIJZIGD,
  zetWeer,
  type WeerMeting,
  type WeerSignaal,
} from "@/lib/weer-bron";

const PROJECT = String(import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "");

function abonneer(melding: () => void) {
  window.addEventListener(WEER_GEWIJZIGD, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(WEER_GEWIJZIGD, melding);
    window.removeEventListener("storage", melding);
  };
}

/**
 * Fase 7: één instelling. Weer staat aan als de weerschakelaar (toestel) én de suggestiesoort
 * "weer" aan staan; wie het ergens uitzet, zet het overal uit (weerkaart, voorstellen, planner).
 */
export function useWeerAan(): [boolean, (aan: boolean) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const sug = useSuggesties();
  const toestel = useSyncExternalStore(
    abonneer,
    () => weerAan(id),
    () => false,
  );
  const aan = toestel && isAan(sug.inst, "weer");
  return [
    aan,
    (w: boolean) => {
      if (!id) return;
      zetWeer(id, w);
      if (isAan(sug.inst, "weer") !== w) void sug.zet("weer", w).catch(() => undefined);
    },
  ];
}

export function useWeer(): {
  /** Is er een weerbron (nu alleen de testbron in de demo)? */
  heeftBron: boolean;
  aan: boolean;
  weer: WeerMeting | null;
  signaal: WeerSignaal | null;
} {
  const [aan] = useWeerAan();
  const adapter = kiesWeerAdapter(PROJECT);
  const { data } = useQuery({
    queryKey: ["weer", adapter?.naam ?? "geen"],
    enabled: !!adapter && aan,
    staleTime: 30 * 60_000,
    queryFn: () => adapter!.haal(new Date()),
  });
  const weer = adapter && aan ? (data ?? null) : null;
  return { heeftBron: !!adapter, aan, weer, signaal: weerSignaal(weer) };
}

/** Fase 7: weer of seizoen voor de weekplanner, met één zin uitleg. */
export function useWeerFactor(): WeerFactor & { zet: (aan: boolean) => void; heeftBron: boolean } {
  const [aan, zet] = useWeerAan();
  const { heeftBron, weer } = useWeer();
  const f = weerFactor({ aan, heeftBron, meting: weer, maand: new Date().getMonth() });
  return { ...f, zet, heeftBron };
}
