/**
 * Verzendlaag voor berichten uit het Control Center (server-only).
 *
 * Eén abstractie met verwisselbare aanbieder. Zolang er geen e-mailaanbieder
 * gekoppeld is, blijft alles binnen de app: het bericht komt in het
 * berichtenoverzicht van de gebruiker (notification_log) terecht en wordt,
 * indien mogelijk, als pushmelding afgeleverd.
 */
import { stuurPush } from "@/lib/webpush.server";

export type Ontvanger = { userId: string; email: string | null; naam: string };
export type Verzending = { userId: string; kanaal: "email" | "in_app"; ok: boolean; fout?: string };

export type MailAanbieder = {
  naam: string;
  beschikbaar: boolean;
  verstuur: (o: { naar: string; onderwerp: string; tekst: string; html?: string }) => Promise<void>;
};

/** Haalt gevaarlijke onderdelen uit geplakte HTML (scripts, iframes, event-handlers). */
function veiligeHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** Standaard: Foodlo's eigen maildomein (notify.foodloapp.com). Resend blijft optioneel. */
export function huidigeAanbieder(): MailAanbieder {
  const sleutel = process.env["RESEND_API_KEY"];
  if (!sleutel) {
    const lovable = !!process.env["LOVABLE_API_KEY"];
    return {
      naam: lovable ? "foodloapp.com" : "geen",
      beschikbaar: lovable,
      verstuur: async ({ naar, onderwerp, tekst, html }) => {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const r = await sendTemplateEmail("admin-bericht", naar, {
          templateData: { onderwerp, bericht: tekst },
          replyTo: "sam@5all.be",
          ...(html ? { html: veiligeHtml(html), text: tekst } : {}),
        });
        if (!r.sent) throw new Error("Deze persoon wil geen e-mails meer ontvangen.");
      },
    };
  }
  return {
    naam: "resend",
    beschikbaar: true,
    verstuur: async ({ naar, onderwerp, tekst }) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${sleutel}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env["MAIL_AFZENDER"] ?? "Foodlo <hallo@foodloapp.com>",
          to: [naar],
          subject: onderwerp,
          text: tekst,
        }),
      });
      if (!res.ok) throw new Error(`mail ${res.status} ${(await res.text()).slice(0, 200)}`);
    },
  };
}

/** Levert één bericht af: e-mail als het kan, anders in de app. */
export async function bezorg(
  db: any,
  ontvanger: Ontvanger,
  onderwerp: string,
  bericht: string,
  voorkeur: "email" | "in_app",
  html?: string,
): Promise<Verzending> {
  const aanbieder = huidigeAanbieder();
  if (voorkeur === "email" && aanbieder.beschikbaar && ontvanger.email) {
    try {
      await aanbieder.verstuur({ naar: ontvanger.email, onderwerp, tekst: bericht, html });
      return { userId: ontvanger.userId, kanaal: "email", ok: true };
    } catch (e) {
      return { userId: ontvanger.userId, kanaal: "email", ok: false, fout: (e as Error).message };
    }
  }

  try {
    const sleutel = `admin:${Date.now()}:${ontvanger.userId}`;
    await db.from("notification_log").insert({
      user_id: ontvanger.userId,
      soort: "bericht",
      titel: onderwerp,
      body: bericht.slice(0, 500),
      url: "/instellingen",
      status: "sent",
      dedupe_key: sleutel,
    });
    const { data: abos } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", ontvanger.userId)
      .eq("actief", true);
    for (const a of abos ?? []) {
      try {
        await stuurPush(a, { title: onderwerp, body: bericht.slice(0, 200), url: "/instellingen" });
      } catch {
        /* push is een extraatje */
      }
    }
    return { userId: ontvanger.userId, kanaal: "in_app", ok: true };
  } catch (e) {
    return { userId: ontvanger.userId, kanaal: "in_app", ok: false, fout: (e as Error).message };
  }
}
