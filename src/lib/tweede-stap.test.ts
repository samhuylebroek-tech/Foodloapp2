import { describe, expect, it } from "vitest";
import {
  codeGeldig,
  factorStatusTekst,
  mfaFoutTekst,
  reserveTip,
  schoonCode,
  verwijderWaarschuwing,
} from "./tweede-stap";

describe("code invoeren", () => {
  it("aanvaardt 6 cijfers, ook met spatie of streepje", () => {
    expect(codeGeldig("123456")).toBe(true);
    expect(codeGeldig("123 456")).toBe(true);
    expect(codeGeldig("123-456")).toBe(true);
    expect(schoonCode(" 12 34 56 ")).toBe("123456");
  });
  it("weigert te kort, te lang of letters", () => {
    for (const c of ["12345", "1234567", "12a456", "", "      "]) expect(codeGeldig(c)).toBe(false);
  });
});

describe("mfaFoutTekst", () => {
  it("vertaalt een foute code naar begrijpelijke uitleg", () => {
    expect(mfaFoutTekst({ code: "mfa_verification_failed", message: "Invalid TOTP code entered" })).toMatch(
      /klopt niet/,
    );
  });
  it("te veel pogingen en verlopen uitdaging", () => {
    expect(mfaFoutTekst({ code: "over_request_rate_limit" })).toMatch(/Te veel pogingen/);
    expect(mfaFoutTekst({ message: "MFA challenge expired" })).toMatch(/te lang/);
  });
  it("toont nooit de Engelse ruwe fout", () => {
    expect(mfaFoutTekst({ message: "Something internal xyz" })).toBe("Dat lukte niet. Probeer het opnieuw.");
    expect(mfaFoutTekst(null)).toBe("Dat lukte niet. Probeer het opnieuw.");
  });
});

describe("factoren beheren", () => {
  const a = { id: "a", status: "verified" };
  const b = { id: "b", status: "verified" };
  const c = { id: "c", status: "unverified" };
  it("status in gewone taal", () => {
    expect(factorStatusTekst("verified")).toBe("actief");
    expect(factorStatusTekst("unverified")).toBe("niet afgewerkt");
  });
  it("waarschuwt streng bij de laatste factor als 2FA verplicht is", () => {
    expect(verwijderWaarschuwing([a, c], "a", true)).toMatch(/laatste authenticator.*verplicht/);
    expect(verwijderWaarschuwing([a], "a", false)).toMatch(/alleen je wachtwoord/);
    expect(verwijderWaarschuwing([a, b], "a", true)).toMatch(/nog 1 actieve authenticator\./);
    expect(verwijderWaarschuwing([a, c], "c", true)).toMatch(/onafgewerkte/);
  });
  it("reservetip alleen bij precies één actieve factor", () => {
    expect(reserveTip([a])).toMatch(/reserve/);
    expect(reserveTip([a, b])).toBeNull();
    expect(reserveTip([c])).toBeNull();
  });
});
