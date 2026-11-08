import { describe, expect, it, vi } from "vitest";
import {
  isInterneHost,
  leesBeperkt,
  leesTekstBeperkt,
  OnveiligeUrlFout,
  TeGrootFout,
  veiligeUrl,
  veiligOphalen,
} from "./veilige-url";

describe("veiligeUrl — toegestane links", () => {
  it.each([
    "https://www.dagelijksekost.vrt.be/gerechten/stoofvlees",
    "http://example.com/recept?id=1",
    "https://example.com:443/pad",
    "https://ÉÉN-recept.be/", // IDN wordt punycode
  ])("laat %s door", (url) => {
    expect(() => veiligeUrl(url)).not.toThrow();
  });
});

describe("veiligeUrl — geblokkeerde links (SSRF)", () => {
  it.each([
    ["localhost", "http://localhost/admin"],
    ["localhost met punt", "http://localhost./admin"],
    ["subdomein van localhost", "http://api.localhost/"],
    ["loopback IPv4", "http://127.0.0.1/"],
    ["decimaal IP", "http://2130706433/"],
    ["hex IP", "http://0x7f000001/"],
    ["kort IP", "http://127.1/"],
    ["privé-IP", "http://10.0.0.5/"],
    ["cloud-metadata", "http://169.254.169.254/latest/meta-data/"],
    ["0.0.0.0", "http://0.0.0.0/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv4-mapped IPv6", "http://[::ffff:127.0.0.1]/"],
    [".internal", "http://metadata.google.internal/"],
    [".local", "http://printer.local/"],
    ["één label", "http://intranet/"],
    ["nip.io-wildcard", "http://127.0.0.1.nip.io/"],
    ["sslip.io-wildcard", "https://10-0-0-1.sslip.io/"],
    ["afwijkende poort", "http://example.com:8080/"],
    ["ssh-poort", "http://example.com:22/"],
    ["inloggegevens in link", "https://user:pass@example.com/"],
    ["file-protocol", "file:///etc/passwd"],
    ["javascript-protocol", "javascript:alert(1)"],
    ["data-URL", "data:text/html,hoi"],
    ["ftp", "ftp://example.com/"],
  ])("blokkeert %s", (_naam, url) => {
    expect(() => veiligeUrl(url)).toThrow(OnveiligeUrlFout);
  });

  it("geeft een begrijpelijke Nederlandse foutmelding", () => {
    expect(() => veiligeUrl("http://localhost/")).toThrow("Deze link kunnen we niet openen.");
    expect(() => veiligeUrl("ftp://x.be/")).toThrow("Alleen gewone weblinks werken.");
    expect(() => veiligeUrl("geen link")).toThrow("Dit is geen geldige weblink.");
  });
});

describe("isInterneHost", () => {
  it("behandelt hoofdletters en afsluitende punten gelijk", () => {
    expect(isInterneHost("LOCALHOST")).toBe(true);
    expect(isInterneHost("Example.COM.")).toBe(false);
  });
  it("lege host is nooit veilig", () => {
    expect(isInterneHost("")).toBe(true);
  });
});

function antwoord(
  status: number,
  headers: Record<string, string> = {},
  body: BodyInit | null = null,
) {
  return new Response(body, { status, headers });
}

describe("veiligOphalen — omleidingen", () => {
  it("volgt een veilige omleiding en geeft de eind-URL terug", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(antwoord(301, { location: "/nieuw" }))
      .mockResolvedValueOnce(antwoord(200, {}, "ok"));
    const { res, url } = await veiligOphalen("https://example.com/oud", {}, { fetchImpl });
    expect(res.status).toBe(200);
    expect(url).toBe("https://example.com/nieuw");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // Nooit automatisch volgen: elke stap wordt zelf gecontroleerd.
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("manual");
  });

  it("weigert een omleiding naar een intern adres en haalt dat nooit op", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        antwoord(302, { location: "http://169.254.169.254/latest/meta-data/" }),
      );
    await expect(veiligOphalen("https://example.com/", {}, { fetchImpl })).rejects.toThrow(
      OnveiligeUrlFout,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stopt na te veel omleidingen", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => antwoord(302, { location: "/lus" }));
    await expect(
      veiligOphalen("https://example.com/", {}, { fetchImpl, maxOmleidingen: 3 }),
    ).rejects.toThrow("te vaak door");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("weigert de eerste URL al als die onveilig is (geen request)", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(veiligOphalen("http://localhost/", {}, { fetchImpl })).rejects.toThrow(
      OnveiligeUrlFout,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("geeft een 304 zonder location gewoon terug", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(antwoord(304));
    const { res } = await veiligOphalen("https://example.com/", {}, { fetchImpl });
    expect(res.status).toBe(304);
  });

  it("zet altijd een tijdslimiet (abort signal)", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(antwoord(200));
    await veiligOphalen("https://example.com/", {}, { fetchImpl, timeoutMs: 50 });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("breekt een trage server af na de tijdslimiet", async () => {
    const fetchImpl: typeof fetch = (_u, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    await expect(
      veiligOphalen("https://example.com/", {}, { fetchImpl, timeoutMs: 20 }),
    ).rejects.toThrow();
  });
});

describe("leesBeperkt — maximale grootte", () => {
  it("leest een klein antwoord volledig", async () => {
    const data = await leesBeperkt(antwoord(200, {}, "hallo"), 100);
    expect(new TextDecoder().decode(data)).toBe("hallo");
  });

  it("weigert meteen op basis van content-length", async () => {
    const res = antwoord(200, { "content-length": "999999" }, "x");
    await expect(leesBeperkt(res, 10)).rejects.toBeInstanceOf(TeGrootFout);
  });

  it("weigert een stroom die groter wordt dan toegestaan (zonder content-length)", async () => {
    let gelezen = 0;
    const stroom = new ReadableStream<Uint8Array>({
      pull(c) {
        gelezen += 1;
        c.enqueue(new Uint8Array(1024));
        if (gelezen > 1000) c.close();
      },
    });
    await expect(leesBeperkt(new Response(stroom), 4096)).rejects.toBeInstanceOf(TeGrootFout);
    // Stopt vroeg in plaats van alles (1 MB) te lezen.
    expect(gelezen).toBeLessThan(10);
  });

  it("decodeert UTF-8 correct (accenten in receptnamen)", async () => {
    expect(await leesTekstBeperkt(antwoord(200, {}, "Crème brûlée – één"), 1000)).toBe(
      "Crème brûlée – één",
    );
  });

  it("precies op de limiet is toegestaan", async () => {
    const data = await leesBeperkt(antwoord(200, {}, "12345"), 5);
    expect(data.byteLength).toBe(5);
  });
});
