/**
 * Eén manier om een recept te verwijderen (BUG-146), overal hetzelfde:
 * na een bevestiging wordt het recept "zacht" verwijderd (`deleted_at`), met een melding
 * "Ongedaan maken" (beslissing B2: omkeerbare acties met ongedaan maken). Niets wordt hard gewist;
 * definitief opruimen volgt de bewaartermijnen (voorstel 0003, docs/foodlo/DATABASE_ARCHITECTURE.md).
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export async function verwijderReceptZacht(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function zetReceptTerug(id: string): Promise<boolean> {
  const { error } = await supabase.from("recipes").update({ deleted_at: null }).eq("id", id);
  return !error;
}

/** Melding na verwijderen, met "Ongedaan maken". `naTerugzetten` ververst het scherm. */
export function meldVerwijderd(
  id: string,
  t: (s: string) => string,
  naTerugzetten: () => void | Promise<void>,
) {
  toast.success(t("Gerecht verwijderd"), {
    duration: 8000,
    action: {
      label: t("Ongedaan maken"),
      onClick: () => {
        void (async () => {
          if (await zetReceptTerug(id)) {
            toast.success(t("Gerecht teruggezet"));
            await naTerugzetten();
          } else toast.error(t("Terugzetten lukte niet"));
        })();
      },
    },
  });
}
