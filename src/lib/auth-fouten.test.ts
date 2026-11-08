import { describe, expect, it } from "vitest";
import { ALGEMENE_AUTH_FOUT, authFoutTekst } from "./auth-fouten";

describe("authFoutTekst", () => {
  it.each([
    [{ message: "Invalid login credentials", code: "invalid_credentials" }, /klopt niet/],
    [{ message: "Email not confirmed" }, /nog niet bevestigd/],
    [{ message: "User already registered" }, /bestaat al een account/],
    [{ code: "weak_password", message: "Password should be at least 6 characters." }, /minstens 6/],
    [{ message: "Unable to validate email address: invalid format" }, /lijkt niet te kloppen/],
    [{ message: "email rate limit exceeded", status: 429 }, /te veel pogingen/],
    [{ message: "x", status: 429 }, /te veel pogingen/],
    [new TypeError("Failed to fetch"), /geen verbinding/],
    [{ code: "same_password" }, /ander wachtwoord/],
  ])("%o → gewone taal", (fout, verwacht) => {
    expect(authFoutTekst(fout)).toMatch(verwacht);
  });

  it("toont nooit de ruwe (Engelse/technische) tekst", () => {
    const geheim = "AuthApiError: unexpected_failure at /auth/v1/token db=pg-17 trace=abc123";
    expect(authFoutTekst({ message: geheim })).toBe(ALGEMENE_AUTH_FOUT);
    expect(authFoutTekst(geheim)).toBe(ALGEMENE_AUTH_FOUT);
  });

  it("verdraagt lege of vreemde invoer", () => {
    expect(authFoutTekst(null)).toBe(ALGEMENE_AUTH_FOUT);
    expect(authFoutTekst(undefined)).toBe(ALGEMENE_AUTH_FOUT);
    expect(authFoutTekst({ message: 42 })).toBe(ALGEMENE_AUTH_FOUT);
  });

  it("elke boodschap is kort genoeg om in één keer te lezen en zegt wat je kunt doen", () => {
    for (const f of [
      { message: "Invalid login credentials" },
      { message: "Email not confirmed" },
      { message: "rate limit" },
    ]) {
      const t = authFoutTekst(f);
      expect(t.length).toBeLessThan(140);
      expect(t).toMatch(/\.$/);
    }
  });
});
