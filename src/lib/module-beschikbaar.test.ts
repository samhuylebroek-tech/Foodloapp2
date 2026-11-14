import { describe, expect, it } from "vitest";
import { isOntbrekendeTabel } from "./module-beschikbaar";

describe("isOntbrekendeTabel", () => {
  it("herkent de Postgres-code 42P01", () => {
    expect(isOntbrekendeTabel({ code: "42P01", message: "x" })).toBe(true);
  });
  it("herkent PostgREST PGRST205", () => {
    expect(isOntbrekendeTabel({ code: "PGRST205", message: "y" })).toBe(true);
  });
  it("herkent de tekst 'relation ... does not exist'", () => {
    expect(isOntbrekendeTabel({ message: 'relation "public.creators" does not exist' })).toBe(true);
  });
  it("herkent 'Could not find the table' in de details", () => {
    expect(
      isOntbrekendeTabel({
        code: "",
        message: "fout",
        details: "Could not find the table 'public.follows' in the schema cache",
      }),
    ).toBe(true);
  });
  it("andere fouten zijn geen ontbrekende tabel", () => {
    expect(isOntbrekendeTabel({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isOntbrekendeTabel({ code: "PGRST116", message: "0 rows" })).toBe(false);
    expect(isOntbrekendeTabel(new Error("Failed to fetch"))).toBe(false);
  });
  it("niets of geen object is geen ontbrekende tabel", () => {
    expect(isOntbrekendeTabel(null)).toBe(false);
    expect(isOntbrekendeTabel(undefined)).toBe(false);
    expect(isOntbrekendeTabel("42P01")).toBe(false);
  });
});
