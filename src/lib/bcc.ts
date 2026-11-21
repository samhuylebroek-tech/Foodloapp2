/**
 * Business Control Center (fase 5): pure regels zonder databank, uitsluitend TESTMODUS.
 * - Omzet per maand: makerabonnementen, partnerplannen en premium; btw altijd apart; terugbetalingen
 *   apart en afgetrokken. Er bestaan vandaag geen echte betalingen: alles komt uit de testprovider.
 * - Makeruitbetalingen: verdeling maker/platform met één centraal instelbaar percentage. Er wordt
 *   niets uitbetaald; de status is altijd "zou uitbetaald worden". KYC is niet gekoppeld.
 * - Rollen in gewone taal (eigenaar, beheerder, moderator, analist) en rechten per scherm.
 * - Auditlog in gewone taal.
 */
import type { AdminRol, Rechten } from "@/lib/admin.functions";
import { FEE_VOORSTEL, verdeelOpbrengst, type FeeInstelling } from "@/lib/betalen/fee";
import { btwUitInclusief as btwCentraal } from "@/lib/betalen/prijzen";

// ---------- rollen ----------

export const ROL_NAAM: Record<AdminRol, { naam: string; uitleg: string }> = {
  super_admin: { naam: "Eigenaar", uitleg: "Alles, ook het team, de verdeling en instellingen." },
  admin: {
    naam: "Beheerder",
    uitleg: "Partners, campagnes, omzet, gebruikers en inhoud. Geen team of verdeling.",
  },
  content_manager: {
    naam: "Moderator",
    uitleg: "Moderatie, partneraanvragen en campagnes beoordelen. Geen omzet of uitbetalingen.",
  },
  analyst: { naam: "Analist", uitleg: "Alleen cijfers bekijken (campagnes, systeem, AI)." },
  support: { naam: "Support", uitleg: "Hulpvragen en gebruikersinzage." },
};

/** Rollen die je kunt uitnodigen. Eigenaar niet: er is precies één eigenaar. */
export const UITNODIGBARE_ROLLEN: AdminRol[] = ["admin", "content_manager", "analyst", "support"];

export function rolNaam(rol: string | null | undefined): string {
  return (rol && ROL_NAAM[rol as AdminRol]?.naam) || "Onbekende rol";
}

/** De schermen van het Control Center met het recht dat ze vragen (voor de rechtentabel). */
export const BCC_SCHERMEN: { pad: string; label: string; recht: Rechten }[] = [
  { pad: "/beheer/partners", label: "Partneraanvragen", recht: "partners.view" },
  { pad: "/beheer/campagnes", label: "Campagnes", recht: "partners.view" },
  { pad: "/beheer/moderatie", label: "Moderatie", recht: "content.manage" },
  { pad: "/beheer/omzet", label: "Omzet (testmodus)", recht: "finance.view" },
  { pad: "/beheer/uitbetalingen", label: "Uitbetalingen (testmodus)", recht: "finance.view" },
  { pad: "/beheer/gebruikers", label: "Gebruikers", recht: "users.view" },
  { pad: "/beheer/logboek", label: "Auditlog", recht: "audit.view" },
  { pad: "/beheer/team", label: "Team en rollen", recht: "admins.manage" },
];

/** Wat je met dat recht ook mag wijzigen (bovenop bekijken). */
export const WIJZIG_RECHT: Partial<Record<string, Rechten>> = {
  "/beheer/partners": "partners.manage",
  "/beheer/campagnes": "partners.manage",
  "/beheer/uitbetalingen": "finance.manage",
};

// ---------- geld ----------

/** Btw-deel uit een bedrag inclusief btw (België 21 %). */
export function btwUitInclusief(cent: number, procent = FEE_VOORSTEL.btwProcent): number {
  return btwCentraal(cent, procent);
}

/** "2026-11-03T18:00:00Z" of "2026-11-03" → "2026-11". */
export function maandVan(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return null;
  return iso.slice(0, 7);
}

/** "2026-11" → "november 2026". */
export function maandLabel(maand: string): string {
  const d = new Date(`${maand}-15T12:00:00`);
  if (Number.isNaN(d.getTime())) return maand;
  return d.toLocaleDateString("nl-BE", { month: "long", year: "numeric" });
}

export type MakerBetalingRij = {
  creator_id: string | null;
  soort: "betaling" | "terugbetaling";
  bedrag_cent: number;
  btw_cent: number;
  test?: boolean;
  created_at: string;
};

export type FactuurRij = {
  user_id: string | null;
  partner_id: string | null;
  bedrag_cent: number;
  status: "betaald" | "open" | "mislukt";
  test?: boolean;
  datum: string;
  /** Fase 6 (voorstel 0023): een creditnota is een terugbetaling. */
  soort?: "factuur" | "creditnota" | null;
  btw_cent?: number | null;
};

export type Bedrag = { aantal: number; brutoCent: number; btwCent: number };

export type OmzetMaand = {
  maand: string;
  makerAbonnementen: Bedrag;
  partnerplannen: Bedrag;
  premium: Bedrag;
  terugbetalingen: Bedrag;
  /** Inclusief btw, na aftrek van terugbetalingen. */
  totaalBrutoCent: number;
  totaalBtwCent: number;
  totaalExclBtwCent: number;
};

const leeg = (): Bedrag => ({ aantal: 0, brutoCent: 0, btwCent: 0 });

function telOp(b: Bedrag, bruto: number, btw: number) {
  b.aantal += 1;
  b.brutoCent += Math.max(0, Math.round(bruto));
  b.btwCent += Math.max(0, Math.round(btw));
}

/**
 * Omzet per maand (nieuwste eerst). Alleen betaalde facturen tellen; een mislukte of open factuur
 * is geen omzet. Terugbetalingen van makerabonnementen worden apart getoond en afgetrokken.
 * Rijen die niet als test gemarkeerd zijn, worden genegeerd: dit scherm toont uitsluitend testmodus.
 */
export function omzetPerMaand(
  betalingen: readonly MakerBetalingRij[],
  facturen: readonly FactuurRij[],
): OmzetMaand[] {
  const per = new Map<string, OmzetMaand>();
  const rij = (maand: string) => {
    let r = per.get(maand);
    if (!r) {
      r = {
        maand,
        makerAbonnementen: leeg(),
        partnerplannen: leeg(),
        premium: leeg(),
        terugbetalingen: leeg(),
        totaalBrutoCent: 0,
        totaalBtwCent: 0,
        totaalExclBtwCent: 0,
      };
      per.set(maand, r);
    }
    return r;
  };
  for (const b of betalingen) {
    if (b.test === false) continue;
    const maand = maandVan(b.created_at);
    if (!maand) continue;
    const r = rij(maand);
    if (b.soort === "terugbetaling") telOp(r.terugbetalingen, b.bedrag_cent, b.btw_cent);
    else telOp(r.makerAbonnementen, b.bedrag_cent, b.btw_cent);
  }
  for (const f of facturen) {
    if (f.test === false || f.status !== "betaald" || f.bedrag_cent <= 0) continue;
    const maand = maandVan(f.datum);
    if (!maand) continue;
    const r = rij(maand);
    const btw = f.btw_cent ?? btwUitInclusief(f.bedrag_cent);
    if (f.soort === "creditnota") {
      telOp(r.terugbetalingen, f.bedrag_cent, btw);
      continue;
    }
    telOp(f.partner_id ? r.partnerplannen : r.premium, f.bedrag_cent, btw);
  }
  for (const r of per.values()) {
    const plus = [r.makerAbonnementen, r.partnerplannen, r.premium];
    r.totaalBrutoCent = plus.reduce((s, b) => s + b.brutoCent, 0) - r.terugbetalingen.brutoCent;
    r.totaalBtwCent = plus.reduce((s, b) => s + b.btwCent, 0) - r.terugbetalingen.btwCent;
    r.totaalExclBtwCent = r.totaalBrutoCent - r.totaalBtwCent;
  }
  return [...per.values()].sort((a, b) => b.maand.localeCompare(a.maand));
}

// ---------- makeruitbetalingen (testmodus) ----------

export const PLATFORM_PROCENT_SLEUTEL = "maker_platform_procent";

/** Geldig platformpercentage (0–50, max. één decimaal) of `null`. */
export function leesPlatformProcent(invoer: unknown): number | null {
  const t = typeof invoer === "number" ? String(invoer) : String(invoer ?? "").trim();
  const n = Number(t.replace(",", ".").replace(/\s|%/g, ""));
  if (!t || !Number.isFinite(n) || n < 0 || n > 50) return null;
  if (Math.round(n * 10) !== n * 10) return null;
  return n;
}

export type MakerUitbetaling = {
  creator_id: string;
  betalingen: number;
  terugbetalingen: number;
  brutoCent: number;
  btwCent: number;
  betaalkostenCent: number;
  platformCent: number;
  makerCent: number;
};

/**
 * Verdeling per maker met één centraal platformpercentage. Per betaling via `verdeelOpbrengst`
 * (btw eruit, dan betaalkosten, dan platformdeel); een terugbetaling trekt exact dezelfde delen
 * af. Nooit negatief. Er wordt niets uitbetaald: dit is wat een uitbetaling zou zijn.
 */
export function uitbetalingPerMaker(
  betalingen: readonly MakerBetalingRij[],
  platformProcent: number,
  fee: FeeInstelling = FEE_VOORSTEL,
): MakerUitbetaling[] {
  const instelling = { ...fee, platformProcent };
  const per = new Map<string, MakerUitbetaling>();
  for (const b of betalingen) {
    if (!b.creator_id || b.test === false) continue;
    const r = per.get(b.creator_id) ?? {
      creator_id: b.creator_id,
      betalingen: 0,
      terugbetalingen: 0,
      brutoCent: 0,
      btwCent: 0,
      betaalkostenCent: 0,
      platformCent: 0,
      makerCent: 0,
    };
    const v = verdeelOpbrengst(b.bedrag_cent, instelling);
    const teken = b.soort === "terugbetaling" ? -1 : 1;
    if (teken > 0) r.betalingen += 1;
    else r.terugbetalingen += 1;
    r.brutoCent += teken * v.prijsCent;
    r.btwCent += teken * v.btwCent;
    r.betaalkostenCent += teken * v.betaalkostenCent;
    r.platformCent += teken * v.platformCent;
    r.makerCent += teken * v.makerCent;
    per.set(b.creator_id, r);
  }
  return [...per.values()]
    .map((r) => ({
      ...r,
      brutoCent: Math.max(0, r.brutoCent),
      btwCent: Math.max(0, r.btwCent),
      betaalkostenCent: Math.max(0, r.betaalkostenCent),
      platformCent: Math.max(0, r.platformCent),
      makerCent: Math.max(0, r.makerCent),
    }))
    .sort((a, b) => b.makerCent - a.makerCent || a.creator_id.localeCompare(b.creator_id));
}

// ---------- partneraanvragen en campagnes ----------

export type AanvraagBesluit = "goedgekeurd" | "geweigerd";

/** Reden waarom een besluit niet kan, of `null`. Afwijzen vraagt altijd een reden. */
export function aanvraagBesluitFout(
  status: string,
  besluit: AanvraagBesluit,
  reden: string,
): string | null {
  if (status !== "nieuw" && status !== "in_behandeling") return "Over deze aanvraag is al beslist.";
  if (besluit === "geweigerd" && reden.trim().length < 3)
    return "Geef een korte reden bij afwijzen. De aanvrager ziet die.";
  if (reden.length > 500) return "De reden is te lang (max. 500 tekens).";
  return null;
}

export const AANVRAAG_STATUS: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  goedgekeurd: "Goedgekeurd",
  geweigerd: "Afgewezen",
};

/** Testbudget invoeren: "250" of "250,50" euro → cent; leeg = 0; ongeldig of > € 100.000 = null. */
export function leesTestbudget(invoer: string): number | null {
  const t = invoer.trim().replace(/\s|€/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cent = Math.round(Number(t) * 100);
  return cent <= 10_000_000 ? cent : null;
}

/** Klikratio in procent met één decimaal; 0 zonder vertoningen. */
export function klikratio(vertoningen: number, klikken: number): number {
  return vertoningen > 0 ? Math.round((klikken / vertoningen) * 1000) / 10 : 0;
}

/** "3,4 %" (Belgische notatie). */
export function procent(n: number): string {
  return `${n.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} %`;
}

// ---------- teamuitnodigingen (testmodus) ----------

export function uitnodigingFout(
  email: string,
  rol: string,
  bestaande: readonly { email: string; status: string }[],
): string | null {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 200)
    return "Vul een geldig e-mailadres in.";
  if (!UITNODIGBARE_ROLLEN.includes(rol as AdminRol)) return "Kies een rol.";
  if (bestaande.some((b) => b.email.toLowerCase() === e && b.status === "testmodus"))
    return "Voor dit adres staat al een uitnodiging klaar.";
  return null;
}

// ---------- auditlog in gewone taal ----------

const ACTIES: Record<string, string> = {
  "partner.aanvraag.goedgekeurd": "Partneraanvraag goedgekeurd",
  "partner.aanvraag.geweigerd": "Partneraanvraag afgewezen",
  "bcc.campagne.goedgekeurd": "Campagne goedgekeurd",
  "bcc.campagne.afgewezen": "Campagne teruggestuurd",
  "bcc.campagne.beeindigd": "Campagne beëindigd",
  "moderatie.campagne.goedgekeurd": "Campagne goedgekeurd (moderatie)",
  "moderatie.campagne.afgewezen": "Campagne teruggestuurd (moderatie)",
  "bcc.verdeling.gewijzigd": "Verdeling maker/platform gewijzigd",
  "bcc.uitbetaling.testrun": "Testuitbetaling vastgelegd (niets uitbetaald)",
  "bcc.team.uitgenodigd": "Teamlid uitgenodigd (testmodus, geen e-mail)",
  "bcc.team.ingetrokken": "Uitnodiging ingetrokken",
  "admin.upsert": "Beheerder toegevoegd of gewijzigd",
  "admin.remove": "Beheerder verwijderd",
  "settings.update": "Instelling gewijzigd",
  "settings.geweigerd": "Instelling geweigerd",
  "privacy.export": "Gegevens van een gebruiker geëxporteerd",
};

export function auditOmschrijving(action: string): string {
  if (ACTIES[action]) return ACTIES[action];
  if (action.startsWith("moderatie.")) return `Moderatie: ${action.slice(10).replace(/\./g, " ")}`;
  return action;
}
