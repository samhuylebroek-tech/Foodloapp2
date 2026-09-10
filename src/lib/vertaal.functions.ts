import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Vertaalt korte teksten (interface én recepten) naar de gekozen taal. */
export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        texts: z.array(z.string().min(1).max(4000)).min(1).max(80),
        lang: z.string().min(2).max(8),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Vertalen is niet beschikbaar.");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              `Je vertaalt korte teksten uit een kookapp van het Nederlands naar taalcode "${data.lang}". ` +
              "Behoud de volgorde en het aantal items exact. Vertaal natuurlijk en kort, houd het eenvoudig. " +
              "Getallen, eenheden en eigennamen blijven staan. Antwoord uitsluitend met een JSON-array van strings.",
          },
          { role: "user", content: JSON.stringify(data.texts) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Vertaalfout: ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("[");
    if (start < 0) return data.texts;
    try {
      const parsed = JSON.parse(cleaned.slice(start)) as unknown;
      if (!Array.isArray(parsed)) return data.texts;
      return data.texts.map((t, i) => {
        const v = parsed[i];
        return typeof v === "string" && v.trim() ? v : t;
      });
    } catch {
      return data.texts;
    }
  });
