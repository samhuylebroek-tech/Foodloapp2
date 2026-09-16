/** Vaste vertalingen voor meldingen: geen AI, geen credits. */

export type Soort =
  | "daily_menu"
  | "weekly"
  | "meal"
  | "shopping"
  | "cooking"
  | "uitnodiging"
  | "uitnodiging_ok";

type Regels = {
  merk: string;
  prive: string;
  daily_titel: string;
  daily_body: (gerecht: string) => string;
  weekly_titel: string;
  weekly_body: string;
  meal_titel: string;
  meal_body: (gerecht: string) => string;
  shopping_titel: string;
  shopping_body: (aantal: number) => string;
  cooking_titel: string;
  cooking_body: (gerecht: string) => string;
  test_titel: string;
  test_body: string;
  uitnodiging_titel: string;
  uitnodiging_body: (naam: string) => string;
  uitnodiging_ok_titel: string;
  uitnodiging_ok_body: (naam: string) => string;
};

const nl: Regels = {
  merk: "Foodlo",
  prive: "Open Foodlo om te zien wat er op het menu staat.",
  daily_titel: "Menu van vandaag 🍽️",
  daily_body: (g) => `Vandaag eet je ${g}.`,
  weekly_titel: "Plan je week 🗓️",
  weekly_body: "Neem even de tijd om je maaltijden te kiezen.",
  meal_titel: "Straks eten 🍝",
  meal_body: (g) => `${g} staat zo op het menu.`,
  shopping_titel: "Boodschappen 🛒",
  shopping_body: (n) => `Je lijst staat klaar met ${n} dingen.`,
  cooking_titel: "Tijd om te koken 👨‍🍳",
  cooking_body: (g) => `Klaar om aan ${g} te beginnen?`,
  test_titel: "Testmelding ✅",
  test_body: "Zo zien je Foodlo-meldingen eruit.",
  uitnodiging_titel: "Nieuwe uitnodiging 👋",
  uitnodiging_body: (n) => `${n} wil met jou delen in Foodlo.`,
  uitnodiging_ok_titel: "Jullie zijn verbonden 🎉",
  uitnodiging_ok_body: (n) => `${n} heeft je uitnodiging aangenomen.`,
};

const en: Regels = {
  merk: "Foodlo",
  prive: "Open Foodlo to see what's on the menu.",
  daily_titel: "Today's menu 🍽️",
  daily_body: (g) => `Today you're making ${g}.`,
  weekly_titel: "Plan your week 🗓️",
  weekly_body: "Take a few minutes to choose your meals.",
  meal_titel: "Meal coming up 🍝",
  meal_body: (g) => `${g} is coming up soon.`,
  shopping_titel: "Shopping reminder 🛒",
  shopping_body: (n) => `Your list is ready with ${n} items.`,
  cooking_titel: "Time to cook 👨‍🍳",
  cooking_body: (g) => `Ready to start ${g}?`,
  test_titel: "Test notification ✅",
  test_body: "This is how your Foodlo reminders look.",
  uitnodiging_titel: "New invitation 👋",
  uitnodiging_body: (n) => `${n} wants to share with you on Foodlo.`,
  uitnodiging_ok_titel: "You're connected 🎉",
  uitnodiging_ok_body: (n) => `${n} accepted your invitation.`,
};

const fr: Regels = {
  merk: "Foodlo",
  prive: "Ouvrez Foodlo pour voir le menu.",
  daily_titel: "Le menu du jour 🍽️",
  daily_body: (g) => `Aujourd'hui : ${g}.`,
  weekly_titel: "Planifiez votre semaine 🗓️",
  weekly_body: "Prenez un instant pour choisir vos repas.",
  meal_titel: "Bientôt à table 🍝",
  meal_body: (g) => `${g} arrive bientôt.`,
  shopping_titel: "Courses 🛒",
  shopping_body: (n) => `Votre liste est prête avec ${n} articles.`,
  cooking_titel: "C'est l'heure de cuisiner 👨‍🍳",
  cooking_body: (g) => `Prêt à commencer ${g} ?`,
  test_titel: "Notification test ✅",
  test_body: "Voilà à quoi ressemblent vos rappels Foodlo.",
  uitnodiging_titel: "Nouvelle invitation 👋",
  uitnodiging_body: (n) => `${n} souhaite partager avec vous sur Foodlo.`,
  uitnodiging_ok_titel: "Vous êtes connectés 🎉",
  uitnodiging_ok_body: (n) => `${n} a accepté votre invitation.`,
};

const de: Regels = {
  merk: "Foodlo",
  prive: "Öffne Foodlo, um das Menü zu sehen.",
  daily_titel: "Menü von heute 🍽️",
  daily_body: (g) => `Heute gibt es ${g}.`,
  weekly_titel: "Plane deine Woche 🗓️",
  weekly_body: "Nimm dir kurz Zeit, um deine Mahlzeiten zu wählen.",
  meal_titel: "Bald Essenszeit 🍝",
  meal_body: (g) => `${g} steht bald an.`,
  shopping_titel: "Einkaufen 🛒",
  shopping_body: (n) => `Deine Liste ist fertig mit ${n} Dingen.`,
  cooking_titel: "Zeit zu kochen 👨‍🍳",
  cooking_body: (g) => `Bereit für ${g}?`,
  test_titel: "Testbenachrichtigung ✅",
  test_body: "So sehen deine Foodlo-Erinnerungen aus.",
  uitnodiging_titel: "Neue Einladung 👋",
  uitnodiging_body: (n) => `${n} möchte mit dir in Foodlo teilen.`,
  uitnodiging_ok_titel: "Ihr seid verbunden 🎉",
  uitnodiging_ok_body: (n) => `${n} hat deine Einladung angenommen.`,
};

const TALEN: Record<string, Regels> = { nl, en, fr, de };

export function teksten(taal: string | null | undefined): Regels {
  return TALEN[(taal ?? "nl").slice(0, 2)] ?? en;
}
