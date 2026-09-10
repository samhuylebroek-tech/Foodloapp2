import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mijnAdminProfiel, type AdminProfiel, type Rechten } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/useAuth";

export function useAdmin() {
  const { user, loading } = useAuth();
  const fn = useServerFn(mijnAdminProfiel);
  const q = useQuery({
    queryKey: ["admin-profiel", user?.id],
    queryFn: () => fn(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const profiel: AdminProfiel | null = q.data?.profiel ?? null;
  const rechten: Rechten[] = q.data?.rechten ?? [];

  return {
    profiel,
    rechten,
    mag: (r: Rechten) => rechten.includes(r),
    laden: loading || (Boolean(user) && q.isLoading),
    ingelogd: Boolean(user),
  };
}
