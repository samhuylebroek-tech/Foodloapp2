import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Rondleiding } from "@/components/Rondleiding";
import { VoorkeurenProvider } from "@/lib/voorkeuren";
import { synchroniseerTijdzone, verwerkMeldingKlik } from "@/lib/meldingen";
import { meet, meldFout } from "@/lib/meten";
import { supabase } from "@/integrations/supabase/client";
import { meldNieuweGebruiker } from "@/lib/welkom-mail.functions";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina niet gevonden</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Deze pagina bestaat niet meer of is verplaatst.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Naar Start
          </Link>
        </div>
      </div>
    </div>
  );
}

// `error` is `unknown`: er kan van alles gegooid worden, niet alleen Error-objecten.
function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Deze pagina kon niet laden
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Dit lukte niet. Probeer opnieuw of ga terug naar Start.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Opnieuw proberen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent"
          >
            Naar Start
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "referrer", content: "no-referrer" },
      { title: "Foodlo – recepten verzamelen, plannen en koken" },
      {
        name: "description",
        content:
          "Verzamel samen recepten, zoek op ingrediënt, plan je week en maak automatisch je boodschappenlijst.",
      },
      { name: "theme-color", content: "#2F6B4F" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Foodlo" },
      { name: "application-name", content: "Foodlo" },
      { property: "og:title", content: "Foodlo" },
      {
        property: "og:description",
        content: "Recepten verzamelen, plannen en koken – groot en duidelijk voor iedereen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/app-icon-512.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // Fraunces (V2): warme, redactionele titels. Outfit blijft geladen voor bestaande stijlen.
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@500;600;700&family=Figtree:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Offline-hulp: bezochte pagina's blijven werken zonder internet,
  // zodat je je klantenkaart altijd aan de kassa kan tonen.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registratie) => registratie.update())
      .catch(() => undefined);
  }, []);

  // In de iPhone/Android-app: terugknop, app-links en opstartscherm.
  const router = useRouter();
  useEffect(() => {
    void import("@/lib/native").then((m) =>
      m.startNatief((pad) => void router.navigate({ href: pad })),
    );
  }, [router]);

  // Klik op een melding registreren en de tijdzone bijhouden wanneer je reist.
  useEffect(() => {
    void verwerkMeldingKlik();
    void synchroniseerTijdzone();
    void meet("app.open");
  }, []);

  // Eén keer per nieuw profiel een berichtje naar de beheerder.
  useEffect(() => {
    let klaar = false;
    const probeer = async () => {
      if (klaar) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      klaar = true;
      if (sessionStorage.getItem("welkom-mail") === "ok") return;
      sessionStorage.setItem("welkom-mail", "ok");
      try {
        await meldNieuweGebruiker();
      } catch {
        /* nooit de app blokkeren */
      }
    };
    void probeer();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void probeer();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Fouten die een gebruiker echt ervaart, komen in het Control Center terecht.
  useEffect(() => {
    const opFout = (e: ErrorEvent) =>
      void meldFout({ soort: "runtime", bericht: e.message, detail: e.error?.stack ?? "" });
    const opBelofte = (e: PromiseRejectionEvent) =>
      void meldFout({
        soort: "promise",
        bericht: String(e.reason?.message ?? e.reason ?? "onbekend"),
        detail: e.reason?.stack ?? "",
      });
    window.addEventListener("error", opFout);
    window.addEventListener("unhandledrejection", opBelofte);
    return () => {
      window.removeEventListener("error", opFout);
      window.removeEventListener("unhandledrejection", opBelofte);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <VoorkeurenProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Rondleiding />
        <Toaster position="top-center" />
      </VoorkeurenProvider>
    </QueryClientProvider>
  );
}
