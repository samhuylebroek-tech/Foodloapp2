import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  PlusCircle,
  Users,
  MessageSquareHeart,
  Settings,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "Start", icon: Sparkles },
  { to: "/gerechten", label: "Recepten", icon: BookOpen },
  { to: "/recepten/nieuw", label: "Toevoegen", icon: PlusCircle },
  { to: "/planner", label: "Weekmenu", icon: CalendarDays },
  { to: "/boodschappen", label: "Boodschappen", icon: ShoppingCart },
  { to: "/vrienden", label: "Vrienden", icon: Users },
  { to: "/instellingen", label: "Instellingen", icon: Settings },
  { to: "/feedback", label: "Feedback", icon: MessageSquareHeart },
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
          <img src={logo} alt="MaJeBa logo" width={28} height={28} className="size-7" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">MaJeBa</p>
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
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-4">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Menu openen"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card lg:hidden"
              >
                <Menu className="size-7" aria-hidden />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-2xl font-bold leading-tight tracking-tight">
                {title}
              </h1>
              {action}
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-16 lg:max-w-4xl">{children}</main>
        </div>
      </div>

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
