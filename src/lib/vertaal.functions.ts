import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { begrensdeLijst } from "@/lib/zod-hulp";
import { KleineCache, VERTAAL_GRENZEN, Venster } from "@/lib/kostrem";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

// Kostenrem (zie masterplan §16): dezelfde interfacetekst is voor iedereen gelijk, dus één keer
// vertalen volstaat; per bezoeker en per uur een plafond, zodat niemand de rekening kan opdrijven.
const cache = new KleineCache<string>(VERTAAL_GRENZEN.cache);
const perBezoeker = new Venster(VERTAAL_GRENZEN.perBezoeker, 10 * 60_000);
const perUur = new Venster(VERTAAL_GRENZEN.perUur, 60 * 60_000);

async function meetVertalen(ok: boolean, ms: number, aantal: number, fout?: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_events").insert({
      kind: `vertalen:${aantal}`,
      model: MODEL,
      ok,
      duration_ms: Math.round(ms),
      error: fout ? fout.slice(0, 500) : null,
    });
  } catch {
    // meten mag vertalen nooit breken
  }
}

/** Vertaalt korte teksten (interface én recepten) naar de gekozen taal. */
export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        texts: begrensdeLijst(z.string().min(1).max(4000), 80, 1),
        lang: z.string().min(2).max(8),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const sleutel = (t: string) => `${data.lang}|${t}`;
    const uit = data.texts.map((t) => cache.get(sleutel(t)));
    const open = [...new Set(data.texts.filter((_t, i) => uit[i] === undefined))];
    if (!open.length) return uit as string[];

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Vertalen is niet beschikbaar.");
    // Over de grens? Dan blijft de tekst gewoon Nederlands — geen fout, geen kosten.
    const { verzoekInfo } = await import("@/lib/admin-headers.server");
    const bezoeker = verzoekInfo().ip?.split(",")[0]?.trim() || "onbekend";
    if (!perBezoeker.neem(bezoeker) || !perUur.neem("alles")) {
      void meetVertalen(false, 0, open.length, "KOSTENREM");
      return data.texts.map((t, i) => uit[i] ?? t);
    }

    const start = Date.now();
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              `Je vertaalt korte teksten uit een kookapp van het Nederlands naar taalcode "${data.lang}". ` +
              "Behoud de volgorde en het aantal items exact. Vertaal natuurlijk en kort, houd het eenvoudig. " +
              "Getallen, eenheden en eigennamen blijven staan. Antwoord uitsluitend met een JSON-array van strings.",
          },
          { role: "user", content: JSON.stringify(open) },
        ],
      }),
    });

    if (!res.ok) {
      void meetVertalen(false, Date.now() - start, open.length, `HTTP ${res.status}`);
      throw new Error(`Vertaalfout: ${res.status}`);
    }
    void meetVertalen(true, Date.now() - start, open.length);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const begin = cleaned.indexOf("[");
    let parsed: unknown = null;
    if (begin >= 0) {
      try {
        parsed = JSON.parse(cleaned.slice(begin)) as unknown;
      } catch {
        parsed = null;
      }
    }
    if (Array.isArray(parsed) && parsed.length === open.length) {
      open.forEach((t, i) => {
        const v = parsed[i];
        if (typeof v === "string" && v.trim()) cache.set(sleutel(t), v);
      });
    }
    return data.texts.map((t, i) => uit[i] ?? cache.get(sleutel(t)) ?? t);
  });
