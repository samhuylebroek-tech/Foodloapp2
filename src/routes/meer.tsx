import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LifeBuoy,
  ListChecks,
  Bell,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Info,
  MessageSquareHeart,
  Refrigerator,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  ChefHat,
  WalletCards,
  Sparkles,
  Handshake,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/voorkeuren";

export const Route = createFileRoute("/meer")({
  head: () => ({
    meta: [
      { title: "Meer – Foodlo" },
      {
        name: "description",
        content: "Vind je gezin, klantenkaarten, meldingen, profiel en instellingen in Foodlo.",
      },
      { property: "og:title", content: "Meer – Foodlo" },
      {
        property: "og:description",
        content: "Alle extra mogelijkheden van Foodlo rustig bij elkaar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeerPage,
});

function initialen(naam: string) {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  return (
    (delen[0]?.[0] ?? "") + (delen.length > 1 ? (delen.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

function MeerPage() {
  const t = useT();
  const { profiel: beheer } = useAdmin();
  const { user } = useAuth();

  const { data: profiel } = useQuery({
    queryKey: ["meer-profiel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  const naam = profiel?.display_name?.trim() || user?.email?.split("@")[0] || t("Jouw profiel");

  return (
    <AppShell title={t("Meer")}>
      <div className="space-y-7">
        {/* Profielkaart: wie ben je en waar pas je dat aan. */}
        <Link
          to="/instellingen"
          className="flex items-center gap-4 rounded-[1.5rem] bg-inkt p-4 text-inkt-foreground shadow-kaart transition-transform active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-honing font-display text-2xl font-semibold text-op-honing"
          >
            {initialen(naam) || "F"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[1.4rem] font-semibold leading-tight">
              {naam}
            </span>
            <span className="mt-0.5 block truncate text-[0.95rem] text-inkt-zacht">
              {profiel?.handle ? `@${profiel.handle}` : (user?.email ?? "")}
            </span>
            <span className="mt-1 block text-[0.95rem] font-semibold">
              {t("Profiel en instellingen")}
            </span>
          </span>
          <ChevronRight className="size-6 shrink-0" aria-hidden />
        </Link>

        <Groep titel={t("Samen")}>
          <LinkRij
            to="/vrienden"
            icoon={Users}
            tint="terracotta"
            titel={t("Vrienden en gezin")}
            uitleg={t("Samen koken, delen en je gezin beheren")}
          />
          <LinkRij
            to="/makers"
            icoon={ChefHat}
            tint="honing"
            titel={t("Makers")}
            uitleg={t("Volg koks en deel zelf recepten")}
          />
        </Groep>

        <Groep titel={t("In huis en in de winkel")}>
          <LinkRij
            to="/voorraad"
            icoon={Refrigerator}
            tint="groen"
            titel={t("Voorraad")}
            uitleg={t("Bekijk wat je al in huis hebt")}
          />
          <LinkRij
            to="/kaarten"
            icoon={WalletCards}
            tint="blauw"
            titel={t("Klantenkaarten")}
            uitleg={t("Toon je kaart aan de kassa")}
          />
        </Groep>

        <Groep titel={t("Jouw Foodlo")}>
          <LinkRij
            to="/meldingen"
            icoon={Bell}
            tint="honing"
            titel={t("Meldingen")}
            uitleg={t("Kies wanneer Foodlo je helpt")}
          />
          <LinkRij
            to="/credits"
            icoon={CreditCard}
            tint="honing"
            titel={t("Credits")}
            uitleg={t("Saldo en slim gebruik")}
          />
          <LinkRij
            to="/premium"
            icoon={Sparkles}
            tint="honing"
            titel={t("Premium")}
            uitleg={t("Extra's in testmodus, nog niet te koop")}
          />
          <LinkRij
            to="/instellingen"
            icoon={Settings}
            tint="grijs"
            titel={t("Instellingen")}
            uitleg={t("Profiel, voorkeuren en privacy")}
          />
          <LinkRij
            to="/partner"
            icoon={Handshake}
            tint="grijs"
            titel={t("Voor bedrijven")}
            uitleg={t("Partneromgeving voor merken en producenten")}
          />
        </Groep>

        <Groep titel={t("Hulp")}>
          <LinkRij
            to="/hulp"
            icoon={LifeBuoy}
            tint="groen"
            titel={t("Help Center")}
            uitleg={t("Uitleg, tutorials en antwoorden")}
          />
          <LinkRij
            to="/eerste-stappen"
            icoon={ListChecks}
            tint="groen"
            titel={t("Eerste stappen")}
            uitleg={t("Zes korte oefeningen in de echte app")}
          />
          <LinkRij
            to="/installeren"
            icoon={Smartphone}
            tint="groen"
            titel={t("Op je telefoon")}
            uitleg={t("Open Foodlo als een gewone app")}
          />
          <LinkRij
            to="/rondleiding"
            icoon={CircleHelp}
            tint="groen"
            titel={t("Rondleiding")}
            uitleg={t("Bekijk de belangrijkste stappen")}
          />
          <LinkRij
            to="/feedback"
            icoon={MessageSquareHeart}
            tint="terracotta"
            titel={t("Feedback")}
            uitleg={t("Vertel wat beter kan")}
          />
          <LinkRij
            to="/info"
            icoon={Info}
            tint="grijs"
            titel={t("Over Foodlo")}
            uitleg={t("Privacy, voorwaarden en gegevens")}
          />
        </Groep>

        {beheer ? (
          <Groep titel={t("Beheer")}>
            <LinkRij
              to="/beheer"
              icoon={ShieldCheck}
              tint="inkt"
              titel="Control Center"
              uitleg={t("Beheer en opvolging")}
            />
          </Groep>
        ) : null}
      </div>
    </AppShell>
  );
}
