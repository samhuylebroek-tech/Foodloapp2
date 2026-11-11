import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
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

/**
 * Demo en tests draaien tegen een nep-Supabase met een verzonnen project-id. Dan toont het
 * Control Center een vaste band, zodat demogetallen nooit voor echte cijfers doorgaan.
 */
const IS_DEMO = ["demo", "e2e-nep"].includes(
  String(import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? ""),
);

type Sub = { pad: string; label: string; recht: Rechten; ook?: string[] };
type Sectie = { label: string; icoon: typeof Users; subs: Sub[] };

/** Zes hoofdsecties; alle bestaande schermen hangen eronder als tabbladen. */
const SECTIES: Sectie[] = [
  {
    label: "Overzicht",
    icoon: BarChart3,
    subs: [{ pad: "/beheer", label: "Overzicht", recht: "dashboard.view" }],
  },
  {
    label: "Gebruikers",
    icoon: Users,
    subs: [
      {
        pad: "/beheer/gebruikers",
        label: "Alle gebruikers",
        recht: "users.view",
        ook: ["/beheer/gebruiker/", "/beheer/ui/gebruiker"],
      },
      { pad: "/beheer/groepen", label: "Gezinnen", recht: "users.view", ook: ["/beheer/ui/groep"] },
      { pad: "/beheer/ui/segmenten", label: "Segmenten", recht: "dashboard.view" },
      { pad: "/beheer/support", label: "Support", recht: "support.view" },
    ],
  },
  {
    label: "Activiteit",
    icoon: Activity,
    subs: [
      { pad: "/beheer/activiteit", label: "Vandaag & tijdlijn", recht: "dashboard.view" },
      { pad: "/beheer/ui", label: "Diepgaand", recht: "dashboard.view" },
      { pad: "/beheer/analytics", label: "Functies", recht: "dashboard.view" },
      { pad: "/beheer/recepten", label: "Recepten", recht: "recipes.view" },
      { pad: "/beheer/imports", label: "Imports", recht: "ai.view" },
    ],
  },
  {
    label: "Finance",
    icoon: Coins,
    subs: [
      { pad: "/beheer/finance", label: "Overzicht", recht: "finance.view" },
      { pad: "/beheer/credits", label: "Credits", recht: "finance.view" },
      { pad: "/beheer/kosten", label: "Kosten", recht: "finance.view" },
      { pad: "/beheer/ai", label: "AI-gebruik", recht: "ai.view" },
    ],
  },
  {
    label: "Communicatie",
    icoon: Megaphone,
    subs: [
      { pad: "/beheer/communicatie", label: "Berichten", recht: "users.view" },
      { pad: "/beheer/meldingen", label: "Pushmeldingen", recht: "dashboard.view" },
      { pad: "/beheer/teksten", label: "Teksten & aankondigingen", recht: "content.manage" },
    ],
  },
  {
    label: "Systeem",
    icoon: Settings2,
    subs: [
      { pad: "/beheer/systeem", label: "Status", recht: "system.view" },
      { pad: "/beheer/integraties", label: "Integraties", recht: "system.view" },
      { pad: "/beheer/inhoud", label: "Inhoud & labels", recht: "content.manage" },
      { pad: "/beheer/kaarten", label: "Klantenkaarten", recht: "content.manage" },
      { pad: "/beheer/beveiliging", label: "Beveiliging", recht: "dashboard.view" },
      { pad: "/beheer/logboek", label: "Auditlogboek", recht: "audit.view" },
      { pad: "/beheer/instellingen", label: "Instellingen", recht: "settings.manage" },
      { pad: "/beheer/team", label: "Beheerders", recht: "admins.manage" },
    ],
  },
];

function scoor(pad: string, s: Sub): number {
  if (s.pad === "/beheer") return pad === "/beheer" || pad === "/beheer/" ? 100 : 0;
  const kand = [s.pad, ...(s.ook ?? [])];
  let best = 0;
  for (const k of kand) {
    const past =
      pad === k ||
      pad.startsWith(k.endsWith("/") ? k : `${k}/`) ||
      (k.endsWith("/") ? false : pad.startsWith(k) && k.includes("/ui/"));
    if (past && k.length > best) best = k.length;
  }
  return best;
}

function actieveSub(pad: string): { sectie: Sectie; sub: Sub } | null {
  let best: { sectie: Sectie; sub: Sub; score: number } | null = null;
  for (const sectie of SECTIES)
    for (const sub of sectie.subs) {
      const sc = scoor(pad, sub);
      if (sc > (best?.score ?? 0)) best = { sectie, sub, score: sc };
    }
  return best;
}
// ongebruikte iconen behouden voor compatibiliteit
void [
  Bell,
  BookOpen,
  CreditCard,
  Link2,
  FileClock,
  LifeBuoy,
  LineChart,
  Lock,
  ShieldCheck,
  Sparkles,
  Tags,
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
  const huidig = actieveSub(pad);
  // BUG-098: zonder recht nooit een lege tabel tonen ("0 gebruikers"), maar zeggen waarom.
  const geenRecht = Boolean(profiel && huidig && !mag(huidig.sub.recht));

  // Toegankelijkheid: een tabel die horizontaal scrolt, moet met het toetsenbord te bereiken zijn
  // (WCAG 2.1.1) en een naam hebben. De beheerschermen bouwen tabellen los; dit regelt het centraal.
  useEffect(() => {
    const markeer = () => {
      document.querySelectorAll<HTMLElement>(".beheer div:has(> table)").forEach((el) => {
        if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) return;
        if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
        if (!el.hasAttribute("role")) el.setAttribute("role", "region");
        if (!el.hasAttribute("aria-label")) {
          const kop = el.closest("section, div.rounded-xl")?.querySelector("h2, h3, p.font-medium");
          const naam = kop?.textContent?.trim();
          el.setAttribute("aria-label", naam ? `Tabel: ${naam}` : "Tabel");
        }
      });
    };
    markeer();
    const obs = new MutationObserver(() => window.requestAnimationFrame(markeer));
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", markeer);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", markeer);
    };
  }, [pad]);

  return (
    <div className="beheer min-h-screen bg-slate-950 text-slate-100">
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
            {SECTIES.map((s) => {
              const subs = s.subs.filter((x) => mag(x.recht));
              if (!subs.length) return null;
              const actief = huidig?.sectie === s;
              return (
                <Link
                  key={s.label}
                  to={subs[0]!.pad}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${
                    actief
                      ? "bg-emerald-500/15 font-medium text-emerald-300"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <s.icoon className="size-4" />
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-200">{profiel?.role.replace("_", " ")}</p>
            <p className="mt-1">Elke actie wordt gelogd.</p>
            <Link
              to="/"
              className="mt-2 inline-flex min-h-11 items-center text-emerald-400 hover:underline"
            >
              Terug naar de app
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 px-6 pt-4 backdrop-blur">
            <nav className="mb-3 flex gap-1 overflow-x-auto lg:hidden">
              {SECTIES.map((s) => {
                const subs = s.subs.filter((x) => mag(x.recht));
                if (!subs.length) return null;
                return (
                  <Link
                    key={s.label}
                    to={subs[0]!.pad}
                    className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm ${
                      huidig?.sectie === s
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "border border-white/10 text-slate-300"
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                {huidig && huidig.sectie.label !== "Overzicht" ? (
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {huidig.sectie.label}
                  </p>
                ) : null}
                <h1 className="text-xl font-semibold tracking-tight">{titel}</h1>
                {omschrijving ? <p className="text-sm text-slate-400">{omschrijving}</p> : null}
              </div>
              <div className="flex items-center gap-2">{acties}</div>
            </div>
            {huidig && huidig.sectie.subs.filter((x) => mag(x.recht)).length > 1 ? (
              <nav className="-mb-px flex gap-4 overflow-x-auto">
                {huidig.sectie.subs
                  .filter((x) => mag(x.recht))
                  .map((x) => (
                    <Link
                      key={x.pad}
                      to={x.pad}
                      className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-sm ${
                        huidig.sub === x
                          ? "border-emerald-400 text-emerald-300"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {x.label}
                    </Link>
                  ))}
              </nav>
            ) : null}
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
          {IS_DEMO ? (
            <div
              role="note"
              className="border-b border-sky-500/30 bg-sky-500/10 px-6 py-2 text-sm text-sky-100"
            >
              Demogegevens: verzonnen testgegevens, geen echte cijfers van Foodlo.
            </div>
          ) : null}
          <div className="p-6">
            {geenRecht ? (
              <Kaart>
                <p className="font-medium">Je rol heeft dit recht niet.</p>
                <p className="mt-1 text-sm text-slate-300">
                  Dit scherm is voorbehouden aan andere beheerrollen. Vraag de eigenaar om toegang
                  als je het nodig hebt.
                </p>
              </Kaart>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export function Kaart({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-900/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Kpi({
  label,
  waarde,
  extra,
  evolutie,
}: {
  label: string;
  waarde: ReactNode;
  extra?: string;
  evolutie?: number | undefined;
}) {
  return (
    <Kaart>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold">{waarde}</p>
        {typeof evolutie === "number" ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              evolutie > 0
                ? "bg-emerald-500/15 text-emerald-300"
                : evolutie < 0
                  ? "bg-red-500/15 text-red-300"
                  : "bg-white/10 text-slate-300"
            }`}
            title="Vergeleken met de vorige periode"
          >
            {evolutie > 0 ? "+" : ""}
            {evolutie}%
          </span>
        ) : null}
      </div>
      {extra ? <p className="text-xs text-slate-400">{extra}</p> : null}
    </Kaart>
  );
}

export type Periode = "dag" | "week" | "maand" | "jaar";

export const PERIODES: { waarde: Periode; label: string }[] = [
  { waarde: "dag", label: "Dag" },
  { waarde: "week", label: "Week" },
  { waarde: "maand", label: "Maand" },
  { waarde: "jaar", label: "Jaar" },
];

export function PeriodeKiezer({
  waarde,
  onKies,
}: {
  waarde: Periode;
  onKies: (p: Periode) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1"
      role="group"
      aria-label="Tijdsperiode"
    >
      {PERIODES.map((p) => (
        <button
          key={p.waarde}
          type="button"
          onClick={() => onKies(p.waarde)}
          aria-pressed={waarde === p.waarde}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            waarde === p.waarde
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-slate-300 hover:bg-white/5"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export type WieKeuze = { wieModus: "alles" | "in" | "uit"; wieIds: string[] };

export const WIE_ALLES: WieKeuze = { wieModus: "alles", wieIds: [] };

/** Kies over wie de cijfers gaan: iedereen, enkele personen, of iedereen behalve. */
export function WieKiezer({
  waarde,
  onKies,
  personen,
}: {
  waarde: WieKeuze;
  onKies: (w: WieKeuze) => void;
  personen: { id: string; naam: string }[];
}) {
  const [open, setOpen] = useState(false);
  const gekozen = waarde.wieIds.length;
  const samenvatting =
    waarde.wieModus === "alles" || gekozen === 0
      ? "Iedereen"
      : waarde.wieModus === "in"
        ? `${gekozen} ${gekozen === 1 ? "persoon" : "personen"}`
        : `Iedereen behalve ${gekozen}`;

  function wissel(id: string) {
    const nieuw = waarde.wieIds.includes(id)
      ? waarde.wieIds.filter((x) => x !== id)
      : [...waarde.wieIds, id];
    onKies({ wieModus: waarde.wieModus === "alles" ? "in" : waarde.wieModus, wieIds: nieuw });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
      >
        Wie: {samenvatting}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-72 overflow-auto rounded-xl border border-white/10 bg-slate-900 p-3 shadow-xl">
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {(
              [
                { k: "alles", l: "Iedereen" },
                { k: "in", l: "Alleen deze" },
                { k: "uit", l: "Behalve deze" },
              ] as const
            ).map((m) => (
              <button
                key={m.k}
                type="button"
                onClick={() =>
                  onKies({ wieModus: m.k, wieIds: m.k === "alles" ? [] : waarde.wieIds })
                }
                className={`flex-1 rounded-full px-2 py-1 text-xs ${
                  waarde.wieModus === m.k ? "bg-emerald-500/20 text-emerald-300" : "text-slate-300"
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {personen.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={waarde.wieIds.includes(p.id)}
                    onChange={() => wissel(p.id)}
                    className="size-4 accent-emerald-500"
                  />
                  <span className="truncate">{p.naam}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
