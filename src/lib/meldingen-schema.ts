/**
 * Invoercontrole voor meldingen (servergrens).
 *
 * Onbekende velden (bv. `user_id`) worden stil weggelaten, zodat een gebruiker
 * nooit andere kolommen of andermans rij kan aanpassen. Bestaande clients
 * blijven werken: zij sturen enkel velden die hier toegelaten zijn.
 */
import { z } from "zod";
import { isInterneHost } from "@/lib/veilige-url";

const tijd = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Ongeldige tijd");

export function isGeldigeTijdzone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const tijdzone = z.string().min(1).max(64).refine(isGeldigeTijdzone, "Ongeldige tijdzone");
const minutenVooraf = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

export const meldingVoorkeurenSchema = z
  .object({
    daily_menu_on: z.boolean(),
    daily_menu_time: tijd,
    daily_menu_moments: z.array(z.string().regex(/^[a-z_]{1,30}$/)).max(8),
    weekly_on: z.boolean(),
    weekly_dow: z.number().int().min(0).max(6),
    weekly_time: tijd,
    meal_on: z.boolean(),
    meal_lead_min: minutenVooraf,
    shopping_on: z.boolean(),
    shopping_time: tijd,
    cooking_on: z.boolean(),
    cooking_lead_min: minutenVooraf,
    lockscreen_details: z.boolean(),
    tijdzone,
    onboarding_gezien: z.boolean(),
  })
  .partial();

/**
 * Een push-endpoint is een adres waar ónze server later naartoe post.
 * Daarom: enkel https en geen interne adressen (anders SSRF via meldingen).
 */
export function isVeiligPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== "443") return false;
    return !isInterneHost(u.hostname);
  } catch {
    return false;
  }
}

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);

export const pushAbonnementSchema = z.object({
  endpoint: z.string().max(2048).refine(isVeiligPushEndpoint, "Ongeldig meldingsadres"),
  p256dh: base64url.min(16).max(200),
  auth: base64url.min(8).max(100),
  userAgent: z.string().max(1000).optional(),
  tijdzone: tijdzone.optional(),
});

export const pushEndpointSchema = z.object({ endpoint: z.string().min(1).max(2048) });
export const tijdzoneSchema = z.object({ tijdzone });
export const meldingSleutelSchema = z.object({ sleutel: z.string().min(1).max(300) });
