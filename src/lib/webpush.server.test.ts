import { afterEach, describe, expect, it, vi } from "vitest";
import { stuurPush } from "./webpush.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("stuurPush — SSRF via push-endpoint", () => {
  it("post nooit naar een intern adres en markeert het abonnement als verlopen", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-publiek");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-prive");
    const nepFetch = vi.fn();
    vi.stubGlobal("fetch", nepFetch);

    const uit = await stuurPush(
      { endpoint: "http://169.254.169.254/latest/meta-data/", p256dh: "x", auth: "y" },
      { titel: "hoi" },
    );

    expect(nepFetch).not.toHaveBeenCalled();
    expect(uit).toMatchObject({ ok: false, verlopen: true });
  });

  it("zonder VAPID-sleutels wordt niets verstuurd (veilige terugval)", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const nepFetch = vi.fn();
    vi.stubGlobal("fetch", nepFetch);
    const uit = await stuurPush(
      { endpoint: "https://fcm.googleapis.com/x", p256dh: "x", auth: "y" },
      {},
    );
    expect(nepFetch).not.toHaveBeenCalled();
    expect(uit.ok).toBe(false);
  });
});
