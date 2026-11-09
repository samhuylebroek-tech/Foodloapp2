import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CircleHelp, Info as InfoIcoon, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";

export const Route = createFileRoute("/info")({
  component: Info,
  head: () => ({
    meta: [
      { title: "Info & privacy — Foodlo" },
      {
        name: "description",
        content: "Uitleg, privacyverklaring en gebruiksvoorwaarden van de kook-app Foodlo.",
      },
      { property: "og:title", content: "Info & privacy — Foodlo" },
      { property: "og:description", content: "Uitleg, privacy en voorwaarden van Foodlo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Blok = { key: string; title: string; body: string };

function Info() {
  const [blokken, setBlokken] = useState<Blok[]>([]);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("key, title, body")
      .eq("published", true)
      .order("key")
      .then(({ data }) => setBlokken((data as Blok[]) ?? []));
  }, []);

  return (
    <AppShell title="Over Foodlo">
      <div className="space-y-7">
        {blokken.map((b) => (
          <section key={b.key} className="paneel p-5">
            <h2 className="text-kaarttitel">{b.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
              {b.body}
            </p>
          </section>
        ))}
        {blokken.length === 0 ? (
          <EmptyState
            icon={<InfoIcoon />}
            title="Hier komt binnenkort meer uitleg"
            description="Intussen vind je het privacybeleid hieronder, en kan je ons altijd iets laten weten."
          />
        ) : null}
        <Groep titel="Meer weten">
          <LinkRij to="/privacy" icoon={ShieldCheck} tint="grijs" titel="Privacybeleid" />
          <LinkRij
            to="/feedback"
            icoon={MessageSquareHeart}
            tint="terracotta"
            titel="Feedback geven"
            uitleg="Vertel wat beter kan"
          />
          <LinkRij to="/rondleiding" icoon={CircleHelp} tint="groen" titel="Rondleiding" />
        </Groep>
      </div>
    </AppShell>
  );
}
