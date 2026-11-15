import { createContext, useContext, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CreditCard,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Package,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  partnerMag,
  ROL_LABEL,
  type Partner,
  type PartnerActie,
  type PartnerLid,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

/** Wat elk partnerscherm nodig heeft: de organisatie, je rol en of je iets mag. */
export type PartnerCtx = {
  partner: Partner;
  lid: PartnerLid;
  mag: (actie: PartnerActie) => boolean;
};

const Ctx = createContext<PartnerCtx | null>(null);

export function PartnerProvider({
  partner,
  lid,
  children,
}: {
  partner: Partner;
  lid: PartnerLid;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider value={{ partner, lid, mag: (a) => partnerMag(lid.rol, a) }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePartner(): PartnerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePartner buiten de partneromgeving");
  return c;
}

type Item = { pad: string; label: string; icoon: LucideIcon };

export const PARTNER_MENU: Item[] = [
  { pad: "/partner", label: "Overzicht", icoon: LayoutDashboard },
  { pad: "/partner/profiel", label: "Bedrijfsprofiel", icoon: Building2 },
  { pad: "/partner/producten", label: "Producten", icoon: Package },
  { pad: "/partner/campagnes", label: "Campagnes", icoon: Megaphone },
  { pad: "/partner/gesponsord", label: "Gesponsorde content", icoon: Sparkles },
  { pad: "/partner/samenwerkingen", label: "Samenwerkingen", icoon: Handshake },
  { pad: "/partner/rapportage", label: "Rapportage", icoon: BarChart3 },
  { pad: "/partner/team", label: "Team", icoon: Users },
  { pad: "/partner/abonnement", label: "Abonnement", icoon: CreditCard },
];

function isActief(pad: string, item: Item) {
  if (item.pad === "/partner") return pad === "/partner" || pad === "/partner/";
  return pad === item.pad || pad.startsWith(`${item.pad}/`);
}

/**
 * Eigen omgeving voor partners: eigen kop, zijmenu (desktop) of tabbalk (telefoon) en een
 * indigo kleuraccent. Bewust níét de consumentenonderbalk: een partner werkt hier zakelijk.
 */
export function PartnerKader({
  partner,
  rol,
  children,
}: {
  partner?: Pick<Partner, "naam"> | null;
  rol?: PartnerLid["rol"] | null;
  children: ReactNode;
}) {
  const pad = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-indigo-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
              <Handshake className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
                Foodlo Partners
              </p>
              <p className="text-lg font-semibold leading-tight break-words">
                {partner?.naam ?? "Partneromgeving"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {rol ? (
              <span className="rounded-full bg-white/15 px-3 py-1.5">
                Jouw rol: {ROL_LABEL[rol]}
              </span>
            ) : null}
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold underline-offset-4 hover:underline"
            >
              Naar de app
            </Link>
          </div>
        </div>
        {partner ? (
          <nav
            aria-label="Partnermenu"
            className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 lg:hidden"
          >
            {PARTNER_MENU.map((i) => (
              <Link
                key={i.pad}
                to={i.pad}
                aria-current={isActief(pad, i) ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[0.95rem] font-semibold",
                  isActief(pad, i)
                    ? "bg-white text-indigo-900"
                    : "text-indigo-50 hover:bg-white/10",
                )}
              >
                {i.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {partner ? (
          <nav aria-label="Partnermenu" className="hidden w-60 shrink-0 lg:block">
            <ul className="sticky top-4 space-y-1">
              {PARTNER_MENU.map((i) => (
                <li key={i.pad}>
                  <Link
                    to={i.pad}
                    aria-current={isActief(pad, i) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base",
                      isActief(pad, i)
                        ? "bg-indigo-100 font-semibold text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-50"
                        : "hover:bg-muted",
                    )}
                  >
                    <i.icoon className="size-5 shrink-0" aria-hidden />
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <main className="min-w-0 flex-1 space-y-5">{children}</main>
      </div>
    </div>
  );
}

/** Kop van een partnerscherm, met korte uitleg. */
export function PartnerKop({ titel, uitleg }: { titel: string; uitleg?: string }) {
  return (
    <div>
      <h1 className="text-paginatitel">{titel}</h1>
      {uitleg ? <p className="mt-1 text-base text-muted-foreground">{uitleg}</p> : null}
    </div>
  );
}

/** Uitleg als je rol iets niet mag (de databank weigert het ook, voorstel 0011). */
export function AlleenLezen({ wat }: { wat: string }) {
  return (
    <p role="note" className="paneel p-4 text-base text-muted-foreground">
      Je rol mag {wat} niet wijzigen. Vraag een eigenaar van je organisatie als je dit nodig hebt.
    </p>
  );
}

/** Duidelijke markering voor verzonnen of testgegevens. */
export function TestBand({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-base font-medium text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      {children}
    </p>
  );
}
