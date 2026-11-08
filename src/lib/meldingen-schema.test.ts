import { describe, expect, it } from "vitest";
import {
  isGeldigeTijdzone,
  isVeiligPushEndpoint,
  meldingVoorkeurenSchema,
  pushAbonnementSchema,
} from "./meldingen-schema";

describe("meldingVoorkeurenSchema — mass assignment", () => {
  it("laat user_id en onbekende kolommen weg", () => {
    const uit = meldingVoorkeurenSchema.parse({
      user_id: "00000000-0000-0000-0000-000000000000",
      created_at: "2000-01-01",
      daily_menu_on: false,
    });
    expect(uit).toEqual({ daily_menu_on: false });
  });

  it("accepteert elk veld dat de instellingenpagina echt verstuurt", () => {
    const echteOproepen = [
      { daily_menu_on: true },
      { daily_menu_time: "10:00" },
      { weekly_on: false },
      { weekly_dow: 0 },
      { weekly_dow: 6 },
      { weekly_time: "09:30" },
      { meal_on: true },
      { meal_lead_min: 60 },
      { shopping_on: true },
      { shopping_time: "17:00" },
      { cooking_on: true },
      { cooking_lead_min: 15 },
      { lockscreen_details: false },
      { daily_menu_moments: ["avondeten", "maaltijd"] },
      { tijdzone: "Europe/Brussels" },
      { onboarding_gezien: true },
    ];
    for (const o of echteOproepen) expect(meldingVoorkeurenSchema.parse(o)).toEqual(o);
  });

  it("aanvaardt tijden zoals Postgres ze teruggeeft (met seconden)", () => {
    expect(() => meldingVoorkeurenSchema.parse({ shopping_time: "17:00:00" })).not.toThrow();
  });

  it.each([
    { daily_menu_time: "25:00" },
    { daily_menu_time: "10:00; drop table" },
    { weekly_dow: 7 },
    { weekly_dow: -1 },
    { weekly_dow: 1.5 },
    { meal_lead_min: -5 },
    { meal_lead_min: 100000 },
    { daily_menu_on: "ja" },
    { tijdzone: "Mars/Olympus" },
    { daily_menu_moments: ["<script>"] },
    { daily_menu_moments: Array(20).fill("x") },
  ])("weigert ongeldige waarde %o", (o) => {
    expect(() => meldingVoorkeurenSchema.parse(o)).toThrow();
  });
});

describe("isVeiligPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:APA91bE",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB",
    "https://web.push.apple.com/QGuQyavXutnMH",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
  ])("echte pushdienst %s is toegestaan", (u) => {
    expect(isVeiligPushEndpoint(u)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/",
    "https://127.0.0.1.nip.io/",
    "https://example.com:8443/",
    "https://u:p@example.com/",
    "javascript:alert(1)",
    "niet een url",
  ])("onveilig endpoint %s wordt geweigerd", (u) => {
    expect(isVeiligPushEndpoint(u)).toBe(false);
  });
});

describe("pushAbonnementSchema", () => {
  const geldig = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
    userAgent: "Mozilla/5.0",
    tijdzone: "Europe/Brussels",
  };
  it("aanvaardt een echt browserabonnement", () => {
    expect(pushAbonnementSchema.parse(geldig)).toEqual(geldig);
  });
  it("weigert een intern endpoint", () => {
    expect(() =>
      pushAbonnementSchema.parse({ ...geldig, endpoint: "https://10.0.0.1/" }),
    ).toThrow();
  });
  it("weigert sleutels met vreemde tekens", () => {
    expect(() => pushAbonnementSchema.parse({ ...geldig, auth: "abc def ghi" })).toThrow();
  });
});

describe("isGeldigeTijdzone", () => {
  it("kent echte zones", () => {
    expect(isGeldigeTijdzone("Europe/Brussels")).toBe(true);
    expect(isGeldigeTijdzone("America/New_York")).toBe(true);
    expect(isGeldigeTijdzone("UTC")).toBe(true);
  });
  it("weigert verzonnen zones", () => {
    expect(isGeldigeTijdzone("Foodlo/Keuken")).toBe(false);
  });
});
