import { describe, expect, it } from "vitest";
import { heeftRecht, type AdminProfiel, type AdminRol } from "./admin.functions";

const profiel = (role: AdminRol, extra: Partial<AdminProfiel> = {}): AdminProfiel => ({
  user_id: "x",
  role,
  active: true,
  can_view_private_content: false,
  note: "",
  ...extra,
});

describe("rechtenmatrix Control Center", () => {
  it("financiële cijfers alleen voor super_admin en admin (BUG-091)", () => {
    expect(heeftRecht(profiel("super_admin"), "finance.view")).toBe(true);
    expect(heeftRecht(profiel("admin"), "finance.view")).toBe(true);
    for (const rol of ["support", "content_manager", "analyst"] as const)
      expect(heeftRecht(profiel(rol), "finance.view"), rol).toBe(false);
  });

  it("support ziet gebruikers maar mag niet verwijderen of beheerders aanstellen", () => {
    expect(heeftRecht(profiel("support"), "users.view")).toBe(true);
    expect(heeftRecht(profiel("support"), "users.delete")).toBe(false);
    expect(heeftRecht(profiel("support"), "admins.manage")).toBe(false);
  });

  it("een inactief profiel heeft geen enkel recht", () => {
    expect(heeftRecht(profiel("super_admin", { active: false }), "dashboard.view")).toBe(false);
    expect(heeftRecht(null, "dashboard.view")).toBe(false);
  });

  it("privé-inhoud alleen met de aparte vlag, ook voor super_admin", () => {
    expect(heeftRecht(profiel("super_admin"), "private.view")).toBe(false);
    expect(
      heeftRecht(profiel("super_admin", { can_view_private_content: true }), "private.view"),
    ).toBe(true);
  });
});
