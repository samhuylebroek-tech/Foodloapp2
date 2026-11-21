import { describe, expect, it } from "vitest";
import { isOntbrekendeFunctie, recenteToestellen, toestelNaam, wanneer } from "./sessies";

describe("sessies", () => {
  it("toestelNaam: browser en systeem, nooit de ruwe user-agent", () => {
    expect(
      toestelNaam(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari op iPhone");
    expect(
      toestelNaam(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome op Android");
    expect(toestelNaam("Mozilla/5.0 (Windows NT 10.0) Chrome/131 Safari/537 Edg/131")).toBe(
      "Edge op Windows",
    );
    expect(toestelNaam(null)).toBe("Onbekend toestel");
  });
  it("isOntbrekendeFunctie: PGRST202 en 42883, geen andere fout", () => {
    expect(isOntbrekendeFunctie({ code: "PGRST202" })).toBe(true);
    expect(isOntbrekendeFunctie({ code: "42883" })).toBe(true);
    expect(isOntbrekendeFunctie({ message: "Could not find the function public.x" })).toBe(true);
    expect(isOntbrekendeFunctie({ code: "42501" })).toBe(false);
    expect(isOntbrekendeFunctie(null)).toBe(false);
  });
  it("recenteToestellen: één rij per toestel, recentste eerst, dit toestel gemarkeerd", () => {
    const r = recenteToestellen(
      [
        { id: "a", browser: "Chrome", device: "Android", last_seen_at: "2026-11-19T10:00:00Z" },
        { id: "b", browser: "Chrome", device: "Android", last_seen_at: "2026-11-20T10:00:00Z" },
        { id: "c", browser: "Safari", device: "iPhone", last_seen_at: "2026-11-18T10:00:00Z" },
      ],
      "a",
    );
    expect(r.map((x) => [x.toestel, x.huidige, x.echt])).toEqual([
      ["Chrome op Android", true, false],
      ["Safari op iPhone", false, false],
    ]);
  });
  it("wanneer: Belgische notatie met 24 uur", () => {
    expect(wanneer("2026-11-20T13:05:00")).toBe("20/11/2026 om 13:05");
    expect(wanneer(null)).toBe("");
  });
});

import { sessieIngetrokken } from "./sessie-bewaker";

describe("sessieIngetrokken (afmelden op dit toestel na afmelden elders)", () => {
  it("alleen een expliciet 'bestaat niet meer' van de server", () => {
    expect(sessieIngetrokken({ status: 403, code: "session_not_found" })).toBe(true);
    expect(sessieIngetrokken({ status: 404, code: "user_not_found" })).toBe(true);
    expect(sessieIngetrokken({ name: "AuthSessionMissingError", status: 400 })).toBe(true);
  });
  it("nooit bij een netwerkfout, verlopen token of andere fout", () => {
    expect(sessieIngetrokken(null)).toBe(false);
    expect(sessieIngetrokken({ status: 0, code: "" })).toBe(false);
    expect(sessieIngetrokken({ status: 401, code: "bad_jwt" })).toBe(false);
    expect(sessieIngetrokken({ status: 500, code: "session_not_found" })).toBe(false);
  });
});
