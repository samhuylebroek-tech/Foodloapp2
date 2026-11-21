import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { bewaarOfflineCache, herstelOfflineCache } from "@/lib/offline-cache";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // P6: laatst bekende Week, Lijst en Vandaag ook na herladen zonder internet.
  herstelOfflineCache(queryClient);
  bewaarOfflineCache(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
