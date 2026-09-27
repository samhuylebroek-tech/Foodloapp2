import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  MessageSquareHeart,
  Package,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAdmin } from "@/hooks/useAdmin";
import { useT } from "@/lib/voorkeuren";

export const Route = createFileRoute("/meer")({
  head: () => ({
    meta: [
      { title: "Meer – Foodlo" },
      { name: "description", content: "Vind je gezin, klantenkaarten, meldingen, profiel en instellingen in Foodlo." },
      { property: "og:title", content: "Meer – Foodlo" },
      { property: "og:description", content: "Alle extra mogelijkheden van Foodlo rustig bij elkaar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeerPage,
});

const GROEPEN = [
  {
    titel: "Samen",
    items: [
      { to: "/vrienden", label: "Vrienden en gezin", uitleg: "Samen koken, delen en je gezin beheren", icon: Users },
    ],
  },
  {
    titel: "In de winkel",
    items: [
      { to: "/kaarten", label: "Klantenkaarten", uitleg: "Toon je kaart aan de kassa", icon: WalletCards },
      { to: "/voorraad", label: "Voorraad", uitleg: "Bekijk wat je al in huis hebt", icon: Package },
    ],
  },
  {
    titel: "Jouw Foodlo",
    items: [
      { to: "/meldingen", label: "Meldingen", uitleg: "Kies wanneer Foodlo je helpt", icon: Bell },
      { to: "/credits", label: "Credits", uitleg: "Saldo en slim gebruik", icon: CreditCard },
      { to: "/instellingen", label: "Instellingen", uitleg: "Profiel, voorkeuren en privacy", icon: Settings },
    ],
  },
  {
    titel: "Hulp",
    items: [
      { to: "/installeren", label: "Op je telefoon", uitleg: "Open Foodlo als een gewone app", icon: Smartphone },
      { to: "/rondleiding", label: "Rondleiding", uitleg: "Bekijk de belangrijkste stappen", icon: CircleHelp },
      { to: "/feedback", label: "Feedback", uitleg: "Vertel wat beter kan", icon: MessageSquareHeart },
      { to: "/info", label: "Over Foodlo", uitleg: "Privacy, voorwaarden en gegevens", icon: Download },
    ],
  },
] as const;

function MeerPage() {
  const t = useT();
  const { profiel } = useAdmin();

  return (
    <AppShell title={t("Meer")}>
      <div className="space-y-8">
        {GROEPEN.map((groep) => (
          <section key={groep.titel} aria-labelledby={`meer-${groep.titel.toLowerCase().replaceAll(" ", "-")}`}>
            <h2 id={`meer-${groep.titel.toLowerCase().replaceAll(" ", "-")}`} className="mb-2 px-1 text-label text-muted-foreground">
              {t(groep.titel)}
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {groep.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 hover:bg-muted">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold text-foreground">{t(item.label)}</span>
                      <span className="block truncate text-base text-muted-foreground">{t(item.uitleg)}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {profiel ? (
          <section aria-labelledby="meer-beheer">
            <h2 id="meer-beheer" className="mb-2 px-1 text-label text-muted-foreground">{t("Beheer")}</h2>
            <Link to="/beheer" className="grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <ShieldCheck className="size-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">Control Center</span>
                <span className="block truncate text-base text-muted-foreground">{t("Beheer en opvolging")}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}