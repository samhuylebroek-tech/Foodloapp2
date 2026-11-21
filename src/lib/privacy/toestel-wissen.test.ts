import { afterEach, describe, expect, it, vi } from "vitest";
import { wisOpslag, wisToestelGegevens } from "./toestel-wissen";

function opslag(start: Record<string, string>) {
  const m = new Map(Object.entries(start));
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("toestelgegevens wissen na accountverwijdering", () => {
  it("wist elke sleutel, ook oude zonder voorvoegsel en de aanmelding", () => {
    const o = opslag({
      "foodlo:kennismaking:u1": "{allergieen:[noten]}",
      "foodlo:offline-cache": "{}",
      "sb-nep-auth-token": "token",
      "majeba-gelezen-berichten": "[]",
    });
    expect(wisOpslag(o)).toBe(4);
    expect(o.m.size).toBe(0);
  });

  it("wist localStorage, sessionStorage, IndexedDB en de offline-cache", async () => {
    const lokaal = opslag({ "foodlo:ai-cache:u1": "[]", "foodlo:restjes": "[]" });
    const sessie = opslag({ foodlo_sessie: "x" });
    const gewisteDb: string[] = [];
    const gewisteCache: string[] = [];
    vi.stubGlobal("window", {
      localStorage: lokaal,
      sessionStorage: sessie,
      indexedDB: {
        databases: async () => [{ name: "foodlo-wachtrij" }, {}],
        deleteDatabase: (n: string) => gewisteDb.push(n),
      },
      caches: {
        keys: async () => ["foodlo-v3"],
        delete: async (n: string) => (gewisteCache.push(n), true),
      },
    });
    expect(await wisToestelGegevens()).toEqual({ sleutels: 3, databanken: 1, caches: 1 });
    expect(lokaal.m.size + sessie.m.size).toBe(0);
    expect(gewisteDb).toEqual(["foodlo-wachtrij"]);
    expect(gewisteCache).toEqual(["foodlo-v3"]);
  });

  it("faalt nooit, ook als opslag geblokkeerd is", async () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("geblokkeerd");
      },
    });
    expect(await wisToestelGegevens()).toEqual({ sleutels: 0, databanken: 0, caches: 0 });
  });
});
