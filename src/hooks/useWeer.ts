/**
 * Weer voor Vandaag en de voorstellen: bron (testadapter in de demo, anders geen), schakelaar
 * aan/uit en het signaal. Zonder bron of met de schakelaar uit: `weer` is null.
 */
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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

export function useWeerAan(): [boolean, (aan: boolean) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const aan = useSyncExternalStore(
    abonneer,
    () => weerAan(id),
    () => false,
  );
  return [aan, (w: boolean) => id && zetWeer(id, w)];
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
