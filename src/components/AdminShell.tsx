import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChefHat,
  Coins,
  CreditCard,
  Link2,


  FileClock,
  LifeBuoy,
  LineChart,
  Lock,
  Megaphone,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import type { Rechten } from "@/lib/admin.functions";

const MENU: { pad: string; label: string; icoon: typeof Users; recht: Rechten }[] = [
  { pad: "/beheer", label: "Dashboard", icoon: BarChart3, recht: "dashboard.view" },
  { pad: "/beheer/gebruikers", label: "Gebruikers", icoon: Users, recht: "users.view" },
  { pad: "/beheer/recepten", label: "Recepten", icoon: BookOpen, recht: "recipes.view" },
  { pad: "/beheer/inhoud", label: "Inhoud & labels", icoon: Tags, recht: "content.manage" },
  { pad: "/beheer/ai", label: "AI & import", icoon: Sparkles, recht: "ai.view" },
  { pad: "/beheer/imports", label: "Importcentrum", icoon: Link2, recht: "ai.view" },

  { pad: "/beheer/kaarten", label: "Klantenkaarten", icoon: CreditCard, recht: "content.manage" },
  { pad: "/beheer/teksten", label: "Teksten & berichten", icoon: Megaphone, recht: "content.manage" },
  { pad: "/beheer/analytics", label: "Analytics", icoon: LineChart, recht: "dashboard.view" },
  { pad: "/beheer/credits", label: "Credits & AI-kosten", icoon: Coins, recht: "dashboard.view" },

  { pad: "/beheer/beveiliging", label: "Beveiliging", icoon: Lock, recht: "dashboard.view" },
  { pad: "/beheer/support", label: "Support", icoon: LifeBuoy, recht: "support.view" },
  { pad: "/beheer/systeem", label: "Systeem", icoon: Activity, recht: "system.view" },
  { pad: "/beheer/logboek", label: "Auditlogboek", icoon: FileClock, recht: "audit.view" },
  { pad: "/beheer/instellingen", label: "Instellingen", icoon: Settings2, recht: "settings.manage" },
  { pad: "/beheer/team", label: "Beheerders", icoon: ShieldCheck, recht: "admins.manage" },
];

export function AdminShell({
  titel,
  omschrijving,
  acties,
  children,
}: {
  titel: string;
  omschrijving?: string;
  acties?: ReactNode;
  children: ReactNode;
}) {
  const { profiel, mag, alleenLezen, mfaOk } = useAdmin();
  const pad = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-slate-900/60 p-4 lg:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <ChefHat className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Foodlo</p>
              <p className="text-xs text-slate-400">Control Center</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {MENU.filter((m) => mag(m.recht)).map((m) => {
              const actief = m.pad === "/beheer" ? pad === "/beheer" : pad.startsWith(m.pad);
              return (
                <Link
                  key={m.pad}
                  to={m.pad}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    actief ? "bg-emerald-500/15 text-emerald-300" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <m.icoon className="size-4" />
                  {m.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-200">{profiel?.role.replace("_", " ")}</p>
            <p className="mt-1">Elke actie wordt gelogd.</p>
            <Link to="/" className="mt-2 inline-block text-emerald-400 hover:underline">
              Terug naar de app
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{titel}</h1>
                {omschrijving ? <p className="text-sm text-slate-400">{omschrijving}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {acties}
                <Link
                  to="/"
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  Terug naar de app
                </Link>
              </div>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
              {MENU.filter((m) => mag(m.recht)).map((m) => (
                <Link
                  key={m.pad}
                  to={m.pad}
                  className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300"
                >
                  {m.label}
                </Link>
              ))}
            </nav>
          </header>
          {alleenLezen ? (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-sm text-amber-200">
              Alleen-lezen modus: je kunt meekijken maar niets wijzigen. Elke inzage wordt gelogd.
            </div>
          ) : null}
          {!mfaOk ? (
            <div className="border-b border-red-500/30 bg-red-500/10 px-6 py-2 text-sm text-red-200">
              2-staps verificatie is verplicht voor jouw rol.{" "}
              <Link to="/beheer/beveiliging" className="underline">
                Nu instellen
              </Link>
            </div>
          ) : null}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function Kaart({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-900/60 p-4 ${className}`}>{children}</div>
  );
}

export function Kpi({ label, waarde, extra }: { label: string; waarde: ReactNode; extra?: string }) {
  return (
    <Kaart>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{waarde}</p>
      {extra ? <p className="text-xs text-slate-400">{extra}</p> : null}
    </Kaart>
  );
}
