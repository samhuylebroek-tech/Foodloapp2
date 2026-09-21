import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
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

const NAV = [
  { to: "/", label: "Start", icon: Home },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Lijst", icon: ShoppingCart },
  { to: "/meer", label: "Meer", icon: MoreHorizontal },
] as const;

const TABS = NAV;

/** Hoofdbestemmingen krijgen geen terugknop; alle andere schermen wel. */
const HOOFDPADEN = new Set<string>(NAV.map((n) => n.to));



export function AppShell({
  title,
  children,
  action,
  sidebar,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  sidebar?: ReactNode;
}) {
  const { session, loading } = useAuth();
  const t = useT();

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  const menu = (
    <nav aria-label="Hoofdmenu">
      <Link to="/" className="flex items-center gap-3 px-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
          <img src={logo} alt="Foodlo logo" width={28} height={28} className="size-7" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">Foodlo</p>
      </Link>
      <ul className="mt-8 space-y-1">
        {NAV.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                data-tour={`nav-${item.to}`}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-6 shrink-0" aria-hidden />
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
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card px-5 py-7 lg:block">
          {menu}
          {sidebar ? <div className="mt-8 border-t border-border pt-6">{sidebar}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link to="/" aria-label="Foodlo Start" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary lg:hidden">
                  <img src={logo} alt="" width={26} height={26} className="size-6" />
                </Link>
              <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold leading-tight">
                {title}
              </h1>
              </div>
              {action}
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-32 sm:px-6 lg:max-w-4xl lg:py-8 lg:pb-16">
            <Aankondigingen />
            {children}
            <MeldingVraag actief={pathname === "/"} />
          </main>
        </div>
      </div>

      {/* Mobiele tabbalk onderaan */}
      <nav
        aria-label="Snelmenu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-stretch px-1">
          {TABS.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  data-tour={`tab-${item.to}`}
                  className={cn(
                    "flex min-h-18 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[0.7rem] font-semibold transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl transition-colors",
                      active ? "bg-primary/12 text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="truncate">{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
