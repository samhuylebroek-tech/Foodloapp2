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

const NAV = [
  { to: "/", label: "Start", icon: Home },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Boodschappen", icon: ShoppingCart },
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
        <img src={logo} alt="" width={36} height={36} className="size-9" />
        <p className="text-2xl font-extrabold tracking-tight text-foreground">Foodlo</p>
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
                  "flex min-h-14 items-center gap-4 rounded-xl px-4 text-lg font-semibold transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-6 shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden />
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
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border px-5 py-8 lg:block">
          {menu}
          {sidebar ? <div className="mt-8 border-t border-border pt-6">{sidebar}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-20 bg-background/95 backdrop-blur-md"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="mx-auto grid min-h-16 w-full max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-2 sm:px-6 lg:max-w-4xl">
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
                  <Link to="/" aria-label="Foodlo Start" className="flex size-11 shrink-0 items-center justify-center lg:hidden">
                    <img src={logo} alt="" width={30} height={30} className="size-8" />
                  </Link>
                )}
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <div className="mx-auto w-full max-w-3xl px-4 pb-3 sm:px-6 lg:max-w-4xl">
              <h1 className="line-clamp-2 break-words text-paginatitel">{title}</h1>
            </div>
            <div className="h-px bg-border" aria-hidden />
          </header>

          <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 pb-36 sm:px-6 lg:max-w-4xl lg:py-8 lg:pb-16">
            <Aankondigingen />
            {children}
            <MeldingVraag actief={pathname === "/"} />
          </main>
        </div>
      </div>

      {/* Mobiele tabbalk onderaan: altijd dezelfde vijf plekken, met tekst */}
      <nav
        aria-label="Snelmenu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch px-0.5 pt-1">
          {TABS.map((item) => {
            const active = isActief(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className={item.to === "/boodschappen" ? "min-w-0 flex-[1.45]" : item.to === "/meer" ? "min-w-0 flex-[0.8]" : "min-w-0 flex-1"}>
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
                  <span className="max-w-full whitespace-nowrap">{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
