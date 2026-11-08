import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Home,
  MoreHorizontal,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Aankondigingen } from "@/components/Aankondigingen";
import { MeldingVraag, telAanmelding } from "@/components/MeldingVraag";
import { meet } from "@/lib/meten";

const NAV: readonly {
  to: "/" | "/gerechten" | "/planner" | "/boodschappen" | "/meer";
  label: string;
  /** Korter label voor de mobiele tabbalk (5 gelijke vakken op 360 px). */
  kort?: string;
  icon: typeof Home;
}[] = [
  { to: "/", label: "Start", icon: Home },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Boodschappen", kort: "Lijst", icon: ShoppingCart },
  { to: "/meer", label: "Meer", icon: MoreHorizontal },
];

const TABS = NAV;

/** Hoofdbestemmingen krijgen geen terugknop; alle andere schermen wel. */
const HOOFDPADEN = new Set<string>(NAV.map((n) => n.to));

export function AppShell({
  title,
  children,
  action,
  sidebar,
  breed = false,
  ondertitel,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  sidebar?: ReactNode;
  /** Brede inhoud op grote schermen (overzichten zoals Start en Recepten). */
  breed?: boolean;
  /** Korte regel onder de paginatitel. */
  ondertitel?: ReactNode;
}) {
  const { session, loading } = useAuth();
  const t = useT();

  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const toonTerug = !HOOFDPADEN.has(pathname);

  function gaTerug() {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else navigate({ to: "/" });
  }

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/aanmelden" });
  }, [loading, session, navigate]);

  // Nieuwe gebruikers eerst door de instelstappen loodsen.
  const { data: profiel } = useQuery({
    queryKey: ["onboarding", session?.user.id],
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_klaar")
        .eq("id", session?.user.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profiel && profiel.onboarding_klaar === false) navigate({ to: "/welkom" });
  }, [profiel, navigate]);

  useEffect(() => {
    if (session) meet("pagina", pathname);
  }, [pathname, session]);

  useEffect(() => {
    if (session) telAanmelding();
  }, [session]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">{t("Even geduld…")}</p>
      </div>
    );
  }

  const isActief = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

  const menu = (
    <nav aria-label="Hoofdmenu">
      <Link to="/" className="flex items-center gap-3 px-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-card shadow-zacht">
          <img src={logo} alt="" width={30} height={30} className="size-7" />
        </span>
        <p className="font-display text-[1.65rem] font-semibold tracking-tight text-foreground">
          Foodlo
        </p>
      </Link>
      <ul className="mt-10 space-y-1.5">
        {NAV.map((item) => {
          const active = isActief(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                data-tour={`nav-${item.to}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-4 rounded-2xl px-4 text-lg font-semibold transition-colors",
                  active
                    ? "bg-card text-foreground shadow-zacht"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-6 shrink-0", active ? "text-primary" : "")}
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden
                />
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border/70 bg-muted/40 px-5 py-8 lg:block">
          {menu}
          {sidebar ? <div className="mt-8 border-t border-border pt-6">{sidebar}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-20 bg-background/95 backdrop-blur-md"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div
              className={cn(
                "mx-auto grid min-h-16 w-full max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-2 sm:px-6",
                breed ? "lg:max-w-6xl" : "lg:max-w-4xl",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {toonTerug ? (
                  <button
                    type="button"
                    onClick={gaTerug}
                    className="-ml-2 flex min-h-12 shrink-0 items-center gap-1 rounded-xl px-2 text-base font-semibold text-primary hover:bg-muted"
                  >
                    <ArrowLeft className="size-6" aria-hidden />
                    {t("Terug")}
                  </button>
                ) : (
                  <Link
                    to="/"
                    aria-label="Foodlo Start"
                    className="flex size-11 shrink-0 items-center justify-center lg:hidden"
                  >
                    <img src={logo} alt="" width={30} height={30} className="size-8" />
                  </Link>
                )}
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <div
              className={cn(
                "mx-auto w-full max-w-3xl px-4 pb-3 sm:px-6",
                breed ? "lg:max-w-6xl" : "lg:max-w-4xl",
              )}
            >
              <h1 className="line-clamp-2 break-words text-paginatitel">{title}</h1>
              {ondertitel ? (
                <div className="mt-1 text-base text-muted-foreground">{ondertitel}</div>
              ) : null}
            </div>
            <div className="h-px bg-border/70" aria-hidden />
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 pb-36 sm:px-6 lg:py-8 lg:pb-16",
              breed ? "lg:max-w-6xl" : "lg:max-w-4xl",
            )}
          >
            <Aankondigingen />
            {children}
            <MeldingVraag actief={pathname === "/"} />
          </main>
        </div>
      </div>

      {/* Mobiele tabbalk onderaan: altijd dezelfde vijf plekken, met tekst */}
      <nav
        aria-label="Snelmenu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 shadow-[0_-8px_24px_-12px_oklch(0.3_0.02_60/0.18)] backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Kolommen naar labellengte: zo past "Weekmenu" ook op 360 px zonder afkappen. */}
        <ul className="mx-auto grid max-w-lg grid-cols-[0.95fr_1.15fr_1.2fr_0.9fr_0.8fr] items-stretch pt-1">
          {TABS.map((item) => {
            const active = isActief(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  data-tour={`tab-${item.to}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-18 flex-col items-center justify-center gap-1 px-0 pb-2 pt-1 text-[0.84rem] font-semibold tracking-tight transition-colors",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                      active ? "bg-secondary text-primary" : "",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className="max-w-full truncate whitespace-nowrap">
                    {t(item.kort ?? item.label)}
                    {/* Volledige naam voor schermlezers, na de zichtbare tekst (WCAG 2.5.3). */}
                    {item.kort ? <span className="sr-only"> ({t(item.label)})</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
