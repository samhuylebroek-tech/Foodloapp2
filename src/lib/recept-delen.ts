/**
 * Een recept delen (fase 2): de link, of het recept als gewone tekst (voor WhatsApp, mail, sms).
 * Zuiver, zodat de tekst getest is; het scherm doet Web Share of kopiëren.
 */
import { ingredientToLine } from "@/lib/ingredienten";
import type { Zichtbaarheid } from "@/lib/makers";

export function receptLink(origin: string, id: string): string {
  return `${origin.replace(/\/$/, "")}/recepten/${id}`;
}

/** "Stoofvlees\n\nIngrediënten\n- 1 kg rundvlees\n…\n\nBereiding\n1. …\n\nIn Foodlo: <link>" */
export function receptAlsTekst(r: {
  title: string;
  ingredienten: readonly { name: string; quantity: number | null; unit: string | null }[];
  stappen: readonly string[];
  link: string;
  bron?: string | null;
}): string {
  const delen = [r.title.trim()];
  if (r.ingredienten.length)
    delen.push(
      [
        "Ingrediënten",
        ...r.ingredienten.map(
          (i) =>
            `- ${ingredientToLine({ name: i.name, quantity: i.quantity, unit: i.unit ?? "" })}`,
        ),
      ].join("\n"),
    );
  if (r.stappen.length)
    delen.push(["Bereiding", ...r.stappen.map((s, n) => `${n + 1}. ${s.trim()}`)].join("\n"));
  if (r.bron) delen.push(`Bron: ${r.bron}`);
  delen.push(`Bekijk het in Foodlo: ${r.link}`);
  return delen.join("\n\n");
}

export type DeelStatus = { titel: string; uitleg: string; openbaar: boolean };

/**
 * Wie kan de link openen? Privé: alleen jij, je gezin en vrienden met wie je recepten deelt.
 * Openbaar loopt via de maker-moderatie (module B): pas zichtbaar na goedkeuring.
 */
export function deelStatus(p: {
  zichtbaarheid: Zichtbaarheid | null;
  gepubliceerd: boolean;
  moderatie: "wacht" | "goedgekeurd" | "afgewezen" | null;
}): DeelStatus {
  if (p.gepubliceerd && p.zichtbaarheid === "openbaar") {
    if (p.moderatie === "goedgekeurd")
      return {
        titel: "Openbaar",
        uitleg: "Iedereen met de link kan dit recept bekijken en in zijn gerechten zetten.",
        openbaar: true,
      };
    if (p.moderatie === "afgewezen")
      return {
        titel: "Niet goedgekeurd",
        uitleg:
          "Dit recept is niet openbaar. Alleen je gezin en vrienden met wie je deelt kunnen het openen.",
        openbaar: false,
      };
    return {
      titel: "Wacht op controle",
      uitleg:
        "Het Foodlo-team kijkt het recept na. Tot dan kunnen alleen je gezin en vrienden het openen.",
      openbaar: false,
    };
  }
  if (p.gepubliceerd && p.zichtbaarheid === "vrienden")
    return {
      titel: "Vrienden en gezin",
      uitleg: "Je gezin en vrienden met wie je deelt kunnen de link openen.",
      openbaar: false,
    };
  return {
    titel: "Privé",
    uitleg:
      "Alleen jij, je gezin en vrienden met wie je recepten deelt kunnen de link openen. Anderen zien het niet.",
    openbaar: false,
  };
}
