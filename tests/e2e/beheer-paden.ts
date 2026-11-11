/** Beheerschermen voor audit en toegankelijkheidstest, met een verzonnen eigenaar (nep-Supabase). */
import { seedDb } from "./helpers";

/** Verzonnen eigenaar-id; de app herkent deze als eigenaar (alleen in de nep-Supabase). */
export const EIGENAAR = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";

export const BEHEER_PADEN: [string, string][] = [
  "",
  "gebruikers",
  "recepten",
  "inhoud",
  "teksten",
  "hulp",
  "ai",
  "kosten",
  "credits",
  "finance",
  "meldingen",
  "communicatie",
  "support",
  "systeem",
  "logboek",
  "beveiliging",
  "team",
  "analytics",
  "activiteit",
  "imports",
  "integraties",
  "kaarten",
  "groepen",
  "instellingen",
  "ui",
  "ui/gebruikers",
  "ui/fouten",
  "ui/gebeurtenissen",
  "ui/sessies",
  "ui/segmenten",
].map((p) => [`beheer-${p.replace("/", "-") || "start"}`, `/beheer${p ? `/${p}` : ""}`]);

/** Maakt de eigenaar beheerder (super_admin, zonder 2FA-plicht) in de nep-databank. */
export async function seedEigenaar() {
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role: "super_admin",
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required: false,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
  });
}
