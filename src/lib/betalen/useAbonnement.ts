import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { heeftRecht, type Recht } from "./entitlements";
import { mijnAbonnement } from "./betalen.functions";

/** Abonnement, testfacturen en rechten van de aangemelde gebruiker (of van een partner). */
export function useAbonnement(partnerId?: string) {
  const { user } = useAuth();
  const haal = useServerFn(mijnAbonnement);
  const q = useQuery({
    queryKey: ["abonnement", user?.id, partnerId ?? null],
    enabled: !!user,
    queryFn: () => haal({ data: partnerId ? { partnerId } : {} }),
  });
  const mag = (recht: Recht) =>
    heeftRecht(user ? { id: user.id, entitlements: q.data?.entitlements ?? [] } : null, recht);
  return { ...q, mag };
}
