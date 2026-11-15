/**
 * Mee-eters voor de voorstellen (Vanavond en "Laat Foodlo kiezen").
 *
 * - Zonder gezin, of vóór migratie 0010 (tabel ontbreekt), is er niemand: alles werkt als vroeger.
 * - Standaard eet het hele huishouden mee; `gekozen` beperkt dat (bv. in het weekvoorstel).
 * - Voor leden waarvan je de gegevens niet mag lezen, vraagt dit het serveroordeel op
 *   (`maaltijd_veilig_voor`), alleen voor de recepten in `receptIds` (hooguit 12).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { serverOordeel, useHuishouden } from "@/lib/voeding-db";
import type { EtersContext } from "@/lib/voorstel-eters";

/** Het actieve gezin van de gebruiker (zelfde sleutel als de assistent: gedeelde cache). */
export function useEigenGezinId() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["assistent-gezin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "actief")
        .limit(1)
        .maybeSingle();
      return (data?.group_id as string | undefined) ?? null;
    },
  });
  return data ?? null;
}

export function useVoorstelEters(opties: {
  gezinId?: string | null | undefined;
  gekozen?: readonly string[] | null | undefined;
  receptIds?: readonly string[] | undefined;
}): EtersContext & { leden: EtersContext["eters"] } {
  const { user } = useAuth();
  const eigen = useEigenGezinId();
  const gezinId = opties.gezinId === undefined ? eigen : opties.gezinId;
  const { data } = useHuishouden(gezinId);
  const leden = useMemo(() => (data?.beschikbaar ? data.data.leden : []), [data]);
  const voeding = useMemo(() => data?.data.voeding ?? new Map(), [data]);
  const gekozen = opties.gekozen;
  const eters = useMemo(
    () => (gekozen ? leden.filter((l) => gekozen.includes(l.id)) : leden),
    [leden, gekozen],
  );
  // Je eigen regels komen al uit je kennismaking; voor jezelf hoeft de server niets te zeggen.
  const nietLeesbaar = eters
    .filter((l) => !voeding.get(l.id) && l.user_id !== user?.id)
    .map((l) => l.id);
  const ids = (opties.receptIds ?? []).slice(0, 12);
  const { data: server = GEEN } = useQuery({
    queryKey: ["voorstel-eters-server", ids.join(","), nietLeesbaar.join(",")],
    enabled: nietLeesbaar.length > 0 && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const uit: Record<string, Map<string, boolean>> = {};
      await Promise.all(
        ids.map(async (id) => {
          uit[id] = await serverOordeel(id, nietLeesbaar);
        }),
      );
      return uit;
    },
  });
  const kijkerId = user?.id;
  return useMemo(
    () => ({ leden, eters, voeding, kijkerId, server }),
    [leden, eters, voeding, kijkerId, server],
  );
}

const GEEN: Record<string, Map<string, boolean>> = {};
