import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ORIGIN } from "@/lib/app-url";

/**
 * Stuurt één keer per gebruiker een berichtje naar de beheerder wanneer er een
 * nieuw profiel is aangemaakt. De vlag profiles.welkom_mail_op zorgt ervoor dat
 * er nooit twee keer gemaild wordt, ook niet bij herladen.
 */
export const meldNieuweGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiel } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, handle, welkom_mail_op, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (!profiel || (profiel as { welkom_mail_op: string | null }).welkom_mail_op) {
      return { gemaild: false as const };
    }

    // Vlag meteen zetten: liever een gemiste mail dan tien dezelfde mails.
    const nu = new Date().toISOString();
    const { error: vlagFout } = await supabaseAdmin
      .from("profiles")
      .update({ welkom_mail_op: nu })
      .eq("id", userId)
      .is("welkom_mail_op", null);
    if (vlagFout) return { gemaild: false as const };

    const { data: instellingen } = await supabaseAdmin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["nieuw_gebruiker_mail_aan", "nieuw_gebruiker_mail_adres"]);
    const lees = (k: string) => (instellingen ?? []).find((r: any) => r.key === k)?.value;
    const aan = lees("nieuw_gebruiker_mail_aan");
    const adresWaarde = lees("nieuw_gebruiker_mail_adres");
    const actief = aan === undefined || aan === null ? true : Boolean(aan);
    const adres = typeof adresWaarde === "string" && adresWaarde.includes("@") ? adresWaarde : "sam@5all.be";
    if (!actief) return { gemaild: false as const };

    const { data: authGebruiker } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authGebruiker?.user?.email ?? null;
    const taal = (authGebruiker?.user?.user_metadata?.["taal"] as string | undefined) ?? "nl";

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      await sendTemplateEmail("nieuwe-gebruiker", adres, {
        idempotencyKey: `nieuwe-gebruiker-${userId}`,
        templateData: {
          naam: (profiel as { display_name: string | null }).display_name ?? "Onbekend",
          handle: (profiel as { handle: string | null }).handle ?? "",
          email,
          taal,
          moment: new Date((profiel as { created_at: string }).created_at ?? nu).toLocaleString("nl-BE", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Brussels",
          }),
          profielUrl: `${APP_ORIGIN}/beheer/gebruiker/${userId}`,
        },
      });
      return { gemaild: true as const };
    } catch (e) {
      console.error("welkom-mail mislukt", (e as Error).message);
      return { gemaild: false as const };
    }
  });
