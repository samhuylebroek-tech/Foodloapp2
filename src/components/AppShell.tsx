import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChefHat,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Compass,
  Home,
  Plus,
  Refrigerator,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import { moduleVoorPad } from "@/lib/functies";
import logo from "@/assets/logo.png";
import { Aankondigingen } from "@/components/Aankondigingen";
import { AccountVoedingLader } from "@/lib/voeding-db";
import { MeldingVraag, telAanmelding } from "@/components/MeldingVraag";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { meet } from "@/lib/meten";
import { MeldingenBel } from "@/components/samenwerking/MeldingenBel";

type Pad =
  "/" | "/gerechten" | "/planner" | "/boodschappen" | "/voorraad" | "/inspiratie" | "/meer";

/**
 * V2-navigatie.
 * Mobiel: 4 bestemmingen + één vaste plek om iets nieuws toe te voegen (midden).
 * Desktop: horizontale topbalk; de voorraadkast is een hoofdbestemming.
 */
const NAV: readonly {
  to: Pad;
  label: string;
  /** Langere naam voor schermlezers ("Week" → "Weekmenu"). */
  lang?: string;
  icon: LucideIcon;
  /** Andere paden die bij deze plek horen (Keuken = recepten + voorraad). */
  ook?: string[];
}[] = [
  { to: "/", label: "Vandaag", icon: Home },
  { to: "/planner", label: "Week", lang: "Weekmenu", icon: CalendarDays },
  {
    to: "/boodschappen",
    label: "Lijst",
    lang: "Boodschappen",
    icon: ShoppingCart,
    ook: ["/aanvullen"],
  },
  {
    to: "/gerechten",
    label: "Keuken",
    lang: "Recepten en voorraad",
    icon: ChefHat,
    ook: ["/recepten", "/voorraad"],
  },
  { to: "/inspiratie", label: "Ontdek", lang: "Ideeën en inspiratie", icon: Compass },
];
/** Hoofdbestemmingen krijgen geen terugknop; alle andere schermen wel. */
const HOOFDPADEN = new Set<string>([
  "/",
  "/gerechten",
  "/planner",
  "/boodschappen",
  "/voorraad",
  "/inspiratie",
  "/meer",
]);
const NIEUW: readonly {
  to: Pad | "/recepten/nieuw";
  titel: string;
  uitleg: string;
  icon: LucideIcon;
}[] = [
  {
    to: "/recepten/nieuw",
    titel: "Recept toevoegen",
    uitleg: "Plak een link, fotografeer een recept of typ het zelf",
    icon: BookOpen,
  },
  {
    to: "/planner",
    titel: "Gerecht inplannen",
    uitleg: "Kies een dag en een maaltijd",
    icon: CalendarPlus,
  },
  {
    to: "/boodschappen",
    titel: "Iets op de lijst",
    uitleg: "Zet iets op je boodschappenlijst",
    icon: ShoppingCart,
  },
  {
    to: "/voorraad",
    titel: "Iets in de voorraad",
    uitleg: "Wat heb je al in huis?",
    icon: Refrigerator,
  },
];

export function AppShell({
  title,
  children,
  action,
  breed = false,
  ondertitel,
  kop,
  vasteInvoer = false,
}: {
  title: string;
  children: ReactNode;
  /** Knoppen naast de paginatitel (bv. favoriet, delen). */
  action?: ReactNode;
  sidebar?: ReactNode;
  /** Brede inhoud op grote schermen (overzichten zoals Vandaag, Recepten, Weekmenu). */
  breed?: boolean;
  /** Korte regel onder de paginatitel. */
  ondertitel?: ReactNode;
  /** Eigen paginakop (bv. de redactionele band op Vandaag). Vervangt titel en ondertitel. */
  kop?: ReactNode;
  /**
   * Er staat een vaste invoerbalk boven de onderbalk (Lijst). Dan krijgt de pagina onderaan extra
   * ruimte ONDER de inhoud, zodat niets achter de balk verdwijnt en er geen leeg vlak ontstaat
   * boven "Hulp bij dit scherm" (BUG-138). Rem-gebaseerd: groeit mee met grote tekst.
   */
  vasteInvoer?: boolean;
}) {
  const { session, loading } = useAuth();
  const t = useT();
  const [nieuwOpen, setNieuwOpen] = useState(false);

  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const toonTerug = !HOOFDPADEN.has(pathname);
  const hulpModule = moduleVoorPad(pathname);

  // Mobiel-eerst: grote titel in de pagina; scrol je eraan voorbij, dan verschijnt hij compact
  // in de bovenbalk (zoals in native apps), zodat je altijd weet waar je bent.
  const [titelWeg, setTitelWeg] = useState(false);
  useEffect(() => {
    setTitelWeg(false);
    if (typeof IntersectionObserver === "undefined") return;
    let obs: IntersectionObserver | null = null;
    const id = window.setTimeout(() => {
      const h1 = document.querySelector("#inhoud h1");
      if (!h1) return;
      obs = new IntersectionObserver(([e]) => setTitelWeg(!(e?.isIntersecting ?? true)), {
        rootMargin: "-72px 0px 0px 0px",
      });
      obs.observe(h1);
    }, 300);
    return () => {
      window.clearTimeout(id);
      obs?.disconnect();
    };
  }, [pathname, loading]);

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

  const onder = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  const isActief = (to: string) =>
    onder(to) || (NAV.find((n) => n.to === to)?.ook ?? []).some(onder);
  // Tablet: de zijbalk neemt links 6 rem; de inhoud krijgt de rest (tot 5xl), desktop zoals voorheen.
  const breedte = breed ? "max-w-6xl" : "max-w-3xl md:max-w-5xl lg:max-w-4xl";

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#inhoud"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-inkt focus:px-4 focus:py-3 focus:text-inkt-foreground"
      >
        {t("Naar de inhoud")}
      </a>

      {/* Topbalk: woordmerk of terug, (desktop) hoofdmenu, Nieuw en Meer. */}
      <header
        className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* BUG-126: op 320 px met tekst 200 % liep de kop uit; kleinere tussenruimtes onder 400 px. */}
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 min-[400px]:gap-3 min-[400px]:px-4 sm:px-6">
          {toonTerug ? (
            <button
              type="button"
              onClick={gaTerug}
              className="-ml-2 flex min-h-12 min-w-12 items-center gap-1.5 rounded-xl px-2 text-base font-semibold text-primary hover:bg-muted"
            >
              <ArrowLeft className="size-6 shrink-0" aria-hidden />
              {/* Mag inkorten bij grote tekst, zodat de kop nooit breder wordt dan het scherm. */}
              <span className="min-w-0 truncate">{t("Terug")}</span>
            </button>
          ) : (
            <Link
              to="/"
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl pr-2"
              aria-label="Foodlo, Vandaag"
            >
              <img
                src={logo}
                alt=""
                width={30}
                height={30}
                className="size-[32px] min-[400px]:size-8"
              />
              <span
                className={cn(
                  "hidden font-display text-[1.6rem] font-semibold leading-none tracking-tight min-[400px]:inline",
                  titelWeg && "min-[400px]:hidden lg:inline",
                )}
              >
                Foodlo
              </span>
            </Link>
          )}

          {/* Compacte titel na het scrollen (telefoon en tablet); bewust één regel met ellips:
              de volledige titel staat bovenaan de pagina. Alleen getekend als hij nodig is, en
              dan zonder woordmerk ernaast, zodat de kop nooit breder wordt (412 px-regressie). */}
          {titelWeg ? (
            <p
              aria-hidden
              className="min-w-0 flex-1 truncate font-display text-lg font-semibold lg:hidden"
            >
              {title}
            </p>
          ) : null}
          <nav aria-label="Hoofdmenu" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => {
                const actief = isActief(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      data-tour={`nav-${item.to}`}
                      aria-current={actief ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-full px-4 text-base font-semibold transition-colors",
                        actief
                          ? "bg-inkt text-inkt-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {t(item.label)}
                      {item.lang ? <span className="sr-only"> ({t(item.lang)})</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 min-[400px]:gap-2">
            {/* P5: meldingen in de app (gezin, restjes), met ongelezen teller. */}
            {session ? <MeldingenBel /> : null}
            <button
              type="button"
              onClick={() => setNieuwOpen(true)}
              aria-haspopup="dialog"
              aria-label={t("Nieuw")}
              data-tour="nieuw"
              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-full bg-primary px-2 text-base font-semibold text-primary-foreground shadow-zacht hover:bg-primary/90 min-[400px]:px-3.5 sm:px-4"
            >
              {/* Pictogram in px: groeit niet mee met grote tekst (BUG-126); het label wel. */}
              <Plus className="size-[24px] min-[400px]:size-5" aria-hidden />
              {/* Smalle telefoon (< 400 px): alleen het plusteken, anders past de kop niet. */}
              <span className="hidden min-[400px]:inline">{t("Nieuw")}</span>
            </button>
            <Link
              to="/meer"
              data-tour="meer"
              aria-label={t("Meer")}
              aria-current={isActief("/meer") ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-full px-2 text-base font-semibold transition-colors min-[400px]:px-3",
                isActief("/meer")
                  ? "bg-inkt text-inkt-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <CircleUserRound className="size-[24px] min-[400px]:size-6" aria-hidden />
              <span className="hidden min-[400px]:inline">{t("Meer")}</span>
            </Link>
          </div>
        </div>
      </header>

      <main
        id="inhoud"
        className={cn(
          "mx-auto w-full overflow-x-clip px-4 pb-36 pt-6 sm:px-6 md:pb-16 md:pl-32 md:pr-8 lg:px-6 lg:pb-16 lg:pt-10",
          vasteInvoer && "pb-[calc(9rem+5.75rem)]",
          breedte,
        )}
      >
        {kop ?? (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 lg:mb-8">
            {/* Titel breekt nooit midden in een woord; knoppen springen desnoods eronder. */}
            <div className="min-w-[min(100%,10rem)] flex-1">
              <h1 className="text-paginatitel">{title}</h1>
              {ondertitel ? (
                <div className="mt-1.5 text-base text-muted-foreground">{ondertitel}</div>
              ) : null}
            </div>
            {/* max-w-full: bij grote tekst mag de knoppenrij binnen het scherm doorlopen. */}
            {action ? <div className="max-w-full shrink-0">{action}</div> : null}
          </div>
        )}
        <Aankondigingen />
        {children}
        {/* Contextuele hulp: onderaan elke pagina (in de kop is geen plek bij grote tekst). */}
        {hulpModule ? (
          <p className="mt-12 flex justify-center">
            <Link
              to="/hulp"
              search={{ module: hulpModule }}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-4 text-base font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CircleHelp className="size-5 shrink-0" aria-hidden />
              {t("Hulp bij dit scherm")}
            </Link>
          </p>
        ) : null}
        <MeldingVraag actief={pathname === "/"} />
        {session ? <AccountVoedingLader /> : null}
      </main>

      {/* Tablet (768–1023 px): dezelfde vijf plekken als zijbalk — duimbereik links, meer ruimte
          voor de inhoud dan een onderbalk, en geen telefoonweergave die uitgerekt wordt. */}
      <nav
        aria-label="Zijmenu"
        className="fixed bottom-0 left-0 z-20 hidden w-24 border-r border-border/60 bg-card/95 backdrop-blur-md md:block lg:hidden"
        style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
      >
        <ul className="flex flex-col items-stretch gap-1 px-2 pt-4">
          {NAV.map((item) => {
            const actief = isActief(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  data-tour={`zij-${item.to}`}
                  aria-current={actief ? "page" : undefined}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl text-[0.9rem] font-semibold transition-colors",
                    actief ? "text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-14 items-center justify-center rounded-full transition-colors",
                      actief ? "bg-inkt text-inkt-foreground" : "",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={actief ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className="max-w-full truncate">
                    {t(item.label)}
                    {item.lang ? <span className="sr-only"> ({t(item.lang)})</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Telefoon: altijd dezelfde vijf plekken, met tekst. */}
      <nav
        aria-label="Snelmenu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 shadow-[0_-8px_24px_-12px_oklch(0.3_0.02_60/0.18)] backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end pt-1">
          {NAV.map((item) => {
            const actief = isActief(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  data-tour={`tab-${item.to}`}
                  aria-current={actief ? "page" : undefined}
                  className={cn(
                    "flex min-h-18 flex-col items-center justify-center gap-1 px-0 pb-2 pt-1 text-[min(0.84rem,15px)] font-semibold tracking-tight transition-colors",
                    actief ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-14 max-w-full items-center justify-center rounded-full transition-colors",
                      actief ? "bg-inkt text-inkt-foreground" : "",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={actief ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className="max-w-full truncate whitespace-nowrap">
                    {t(item.label)}
                    {item.lang ? <span className="sr-only"> ({t(item.lang)})</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Eén vaste plek om iets nieuws te beginnen. */}
      <Sheet open={nieuwOpen} onOpenChange={setNieuwOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-3xl p-0 sm:bottom-6 sm:rounded-3xl"
        >
          <SheetHeader className="px-5 pb-2 pt-5 text-left">
            <SheetTitle className="text-sectietitel">{t("Wat wil je doen?")}</SheetTitle>
            <SheetDescription className="text-base">
              {t("Kies wat je wil toevoegen.")}
            </SheetDescription>
          </SheetHeader>
          <ul className="space-y-2 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
            {NIEUW.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.titel}>
                  <Link
                    to={n.to}
                    onClick={() => setNieuwOpen(false)}
                    className="flex min-h-20 items-center gap-4 rounded-2xl bg-muted/70 p-4 hover:bg-muted"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-inkt text-inkt-foreground">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold">{t(n.titel)}</span>
                      <span className="block text-base text-muted-foreground">{t(n.uitleg)}</span>
                    </span>
                    <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
