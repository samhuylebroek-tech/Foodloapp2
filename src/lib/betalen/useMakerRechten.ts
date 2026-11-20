import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { heeftRecht, type Entitlement } from "./entitlements";
import { makerRecht } from "./maker-abonnement";
import { mijnMakerRechten } from "./maker-abonnement.functions";

export const MAKER_RECHTEN_SLEUTEL = "maker-rechten";

/** Fase 4: makerrechten van de aangemelde gebruiker (van de server), met `magMaker(id)`. */
export function useMakerRechten() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: [MAKER_RECHTEN_SLEUTEL, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => mijnMakerRechten(),
  });
  const entitlements: Entitlement[] = q.data?.entitlements ?? [];
  const magMaker = (creatorId: string) =>
    heeftRecht(user ? { id: user.id, entitlements } : null, makerRecht(creatorId));
  return { ...q, entitlements, magMaker };
}
