import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacybeleid – Foodlo" },
      { name: "description", content: "Hoe Foodlo omgaat met je gegevens, en hoe je je account verwijdert." },
      { property: "og:title", content: "Privacybeleid – Foodlo" },
      { property: "og:description", content: "Hoe Foodlo omgaat met je gegevens, en hoe je je account verwijdert." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-semibold">{titel}</h2>
      <div className="space-y-2 text-lg leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <Link to="/" className="inline-flex min-h-11 items-center text-lg font-semibold text-primary">← Naar Foodlo</Link>
      <h1 className="font-display text-4xl font-bold">Privacybeleid</h1>
      <p className="text-lg text-muted-foreground">Laatst bijgewerkt: 28 september 2026</p>

      <Blok titel="Wie zijn wij">
        <p>Foodlo is een app om samen recepten te verzamelen, je week te plannen en boodschappen te doen. Vragen? Mail naar sam@5all.be.</p>
      </Blok>
      <Blok titel="Welke gegevens we bewaren">
        <p>Je naam en e-mailadres, je recepten, foto's, weekmenu's, boodschappenlijsten, voorraad, klantenkaarten, scores en instellingen. Daarnaast bewaren we hoe je de app gebruikt, zodat we fouten kunnen oplossen en Foodlo beter kunnen maken.</p>
      </Blok>
      <Blok titel="Waarvoor we ze gebruiken">
        <p>Alleen om Foodlo te laten werken: je gegevens tonen op al je toestellen, delen met je gezin of vrienden als jij dat kiest, meldingen sturen die je hebt aangezet en AI-functies uitvoeren die je zelf start. We verkopen je gegevens nooit en tonen geen advertenties.</p>
      </Blok>
      <Blok titel="Met wie we delen">
        <p>Met de diensten die Foodlo nodig heeft: onze hosting en database, de AI-dienst voor het herkennen van recepten en het maken van foto's, en onze e-maildienst. Zij gebruiken je gegevens alleen voor Foodlo.</p>
      </Blok>
      <Blok titel="Je rechten">
        <p>Je kan je gegevens op elk moment downloaden bij Instellingen. Je kan ze laten verbeteren of volledig laten verwijderen.</p>
      </Blok>
      <Blok titel="Je account verwijderen">
        <p>Ga in de app naar <strong>Meer → Instellingen → Account verwijderen</strong>. Je account en al je eigen gegevens worden meteen en definitief gewist. Lukt dat niet, mail dan naar sam@5all.be en we doen het binnen 30 dagen voor je.</p>
      </Blok>
    </main>
  );
}
