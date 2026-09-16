import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  CreditCard,
  PlusCircle,
  Users,
  MessageSquareHeart,
  Settings,
  Sparkles,
  Menu,
  Package,
  Smartphone,

  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Aankondigingen } from "@/components/Aankondigingen";
import { InstallatieTip } from "@/components/InstallatieTip";
import { meet } from "@/lib/meten";

const NAV = [
  { to: "/", label: "Start", icon: Sparkles },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/recepten/nieuw", label: "Toevoegen", icon: PlusCircle },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Boodschappen", icon: ShoppingCart },
  { to: "/voorraad", label: "Voorraadkast", icon: Package },
  { to: "/kaarten", label: "Klantenkaarten", icon: CreditCard },
  { to: "/vrienden", label: "Vrienden", icon: Users },
  { to: "/instellingen", label: "Instellingen", icon: Settings },
  { to: "/feedback", label: "Feedback", icon: MessageSquareHeart },
  { to: "/installeren", label: "Op je telefoon zetten", icon: Smartphone },
] as const;

const TABS = [
  { to: "/", label: "Start", icon: Sparkles },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Lijst", icon: ShoppingCart },
] as const;



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
  const [menuOpen, setMenuOpen] = useState(false);

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
        .eq("id", session!.user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profiel && profiel.onboarding_klaar === false) navigate({ to: "/welkom" });
  }, [profiel, navigate]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (session) meet("pagina", pathname);
  }, [pathname, session]);

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
      <ul className="mt-6 space-y-1">
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
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl px-3 text-lg font-semibold transition-colors",
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
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card px-4 py-6 lg:block">
          {menu}
          {sidebar ? <div className="mt-8 border-t border-border pt-6">{sidebar}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-20 border-b border-border/70 bg-card/80 backdrop-blur-xl"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Menu openen"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card transition-transform active:scale-95 lg:hidden"
              >
                <Menu className="size-6" aria-hidden />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[1.6rem] font-bold leading-tight tracking-tight">
                {title}
              </h1>
              {action}
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-32 lg:max-w-4xl lg:pb-16">
            <Aankondigingen />
            {children}
            <InstallatieTip />
          </main>
        </div>
      </div>

      {/* Mobiele tabbalk onderaan */}
      <nav
        aria-label="Snelmenu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {TABS.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold transition-colors",
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

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Menu sluiten"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-xs overflow-y-auto bg-card px-4 py-6 shadow-xl">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Menu sluiten"
                className="flex size-12 items-center justify-center rounded-2xl border border-border"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>
            {menu}
            {sidebar ? <div className="mt-8 border-t border-border pt-6">{sidebar}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
