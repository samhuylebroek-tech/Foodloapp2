import { describe, expect, it } from "vitest";
import { voegEigenarenSamen } from "./zichtbare-eigenaren";

const IK = "ik";
const ja = { recipes_view: true, recipes_edit: false };
const nee = { recipes_view: false, recipes_edit: false };

describe("voegEigenarenSamen (tweede laag BUG-105, zelfde regel als has_share)", () => {
  it("altijd jezelf", () => {
    expect(voegEigenarenSamen(IK, [], [], [])).toEqual([IK]);
  });
  it("vriend alleen met geaccepteerd deelrecht op recepten", () => {
    const d = [
      { owner_id: "vriend", status: "accepted", ...ja },
      { owner_id: "wachtend", status: "pending", ...ja },
      { owner_id: "zonder-recht", status: "accepted", ...nee },
      { owner_id: "bewerker", status: "accepted", recipes_view: false, recipes_edit: true },
    ];
    expect(voegEigenarenSamen(IK, d, [], []).sort()).toEqual(["bewerker", IK, "vriend"].sort());
  });
  it("gezinslid alleen als beide actief zijn en het lid recepten deelt", () => {
    const mijn = [
      { group_id: "g1", status: "actief" },
      { group_id: "g2", status: "uitgenodigd" },
    ];
    const leden = [
      { group_id: "g1", user_id: "partner", status: "actief", ...ja },
      { group_id: "g1", user_id: "uitgenodigd", status: "uitgenodigd", ...ja },
      { group_id: "g1", user_id: "deelt-niet", status: "actief", ...nee },
      { group_id: "g2", user_id: "ander-gezin", status: "actief", ...ja },
    ];
    expect(voegEigenarenSamen(IK, [], mijn, leden).sort()).toEqual([IK, "partner"].sort());
  });
});
