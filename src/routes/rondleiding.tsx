import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChefHat,
  CreditCard,
  Home,
  Package,
  PlusCircle,
  ShoppingCart,
  Smartphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/voorkeuren";

export const Route = createFileRoute("/rondleiding")({
  head: () => ({
    meta: [
      { title: "Rondleiding door Foodlo — zo werkt de app" },
      {
        name: "description",
        content:
          "Ontdek stap voor stap hoe je recepten bewaart, je weekmenu plant, boodschappen afvinkt en samen kookt met je gezin.",
      },
      { property: "og:title", content: "Rondleiding door Foodlo — zo werkt de app" },
      {
        property: "og:description",
        content: "In een paar korte stapjes leer je alles wat Foodlo voor je doet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RondleidingPage,
});

export const RONDLEIDING_SLEUTEL = "rondleiding_gezien";

const STAPPEN = [
  {
    icoon: Home,
    titel: "Je startscherm",
    tekst:
      "Hier zie je meteen wat je vandaag eet, wat je laatst bekeek en wat er nog op je lijstje staat. Alles begint hier.",
  },
  {
    icoon: BookOpen,
    titel: "Recepten",
    tekst:
      "Al je gerechten op één plek. Zoek op naam, filter op vlees, vis of vega, en tik op een gerecht om het te bekijken.",
  },
  {
    icoon: PlusCircle,
    titel: "Een gerecht toevoegen",
    tekst:
      "Plak een link van een website, Instagram of YouTube en de app vult het recept zelf in. Of typ het zelf, of neem een foto van je bord.",
  },
  {
    icoon: CalendarDays,
    titel: "Je weekmenu",
    tekst:
      "Plan per dag wat je eet. Kook je samen? Schakel bovenaan tussen “Mijn weekmenu” en “Weekmenu gezin”, zodat iedereen hetzelfde ziet.",
  },
  {
    icoon: ShoppingCart,
    titel: "Boodschappen",
    tekst:
      "Je lijst vult zichzelf vanuit je weekmenu en je recepten. In de winkel vink je gewoon af wat in je kar ligt.",
  },
  {
    icoon: Package,
    titel: "Voorraadkast",
    tekst:
      "Zet erin wat je al in huis hebt. Bij het boodschappen doen vink je in één tik weg wat je al hebt staan.",
  },
  {
    icoon: CreditCard,
    titel: "Klantenkaarten",
    tekst:
      "Scan je winkelkaarten één keer in. Aan de kassa toon je ze groot op je scherm — ook zonder internet.",
  },
  {
    icoon: Users,
    titel: "Vrienden en gezin",
    tekst:
      "Nodig iemand uit met een link of op naam. Jij kiest per persoon wat je deelt: recepten, weekmenu of boodschappen.",
  },
  {
    icoon: ChefHat,
    titel: "Kookstand",
    tekst:
      "Tik op “Start kookstand” en kook stap voor stap met grote letters. Per stap zie je hoeveel je van elk ingrediënt nodig hebt. Op het einde geef je sterren.",
  },
  {
    icoon: Bell,
    titel: "Meldingen",
    tekst:
      "Een seintje wanneer het tijd is om te plannen, te winkelen of te koken. Jij kiest zelf welke je wil — of geen enkele.",
  },
  {
    icoon: Smartphone,
    titel: "Op je telefoon zetten",
    tekst:
      "Zet Foodlo op je beginscherm, dan opent hij als een gewone app. Je vindt dit altijd terug bij Instellingen.",
  },
] as const;

function RondleidingPage() {
  const navigate = useNavigate();
  const t = useT();
  const [i, setI] = useState(0);
  const stap = STAPPEN[i]!;
  const Icoon = stap.icoon;
  const laatste = i === STAPPEN.length - 1;

  function sluit() {
    try {
      window.localStorage.setItem(RONDLEIDING_SLEUTEL, "ja");
    } catch {
      /* niets */
    }
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center bg-background p-5">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-base text-muted-foreground">
          {t("Stap")} {i + 1} {t("van")} {STAPPEN.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((i + 1) / STAPPEN.length) * 100}%` }}
          />
        </div>

        <span className="mt-6 flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icoon className="size-8" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-3xl">{t(stap.titel)}</h1>
        <p className="mt-3 text-xl leading-relaxed text-muted-foreground">{t(stap.tekst)}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {i > 0 ? (
            <Button variant="secondary" onClick={() => setI(i - 1)} className="h-16 text-lg sm:flex-1">
              {t("Vorige")}
            </Button>
          ) : null}
          <Button
            onClick={() => (laatste ? sluit() : setI(i + 1))}
            className="h-16 text-lg sm:flex-1"
          >
            {laatste ? t("Klaar, naar de app") : t("Volgende")}
          </Button>
        </div>
        <Button variant="ghost" onClick={sluit} className="mt-3 h-14 w-full text-base">
          {t("Overslaan")}
        </Button>
      </div>
    </main>
  );
}
