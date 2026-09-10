import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/info")({
  component: Info,
  head: () => ({
    meta: [
      { title: "Info & privacy — MaJeBa" },
      { name: "description", content: "Uitleg, privacyverklaring en gebruiksvoorwaarden van de kook-app MaJeBa." },
      { property: "og:title", content: "Info & privacy — MaJeBa" },
      { property: "og:description", content: "Uitleg, privacy en voorwaarden van MaJeBa." },
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
    <AppShell title="Info">
      <div className="space-y-4">
        {blokken.map((b) => (
          <section key={b.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-card-foreground">{b.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{b.body}</p>
          </section>
        ))}
        {blokken.length === 0 ? <p className="text-muted-foreground">Nog geen informatie beschikbaar.</p> : null}
      </div>
    </AppShell>
  );
}
