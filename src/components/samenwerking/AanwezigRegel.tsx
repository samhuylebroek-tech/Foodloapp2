/** P5 — "Jan is de lijst aan het bewerken": rustige regel, alleen als er iemand anders is. */
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAanwezigheid } from "@/hooks/useAanwezigheid";
import { aanwezigTekst } from "@/lib/samenwerking/activiteit";

export function AanwezigRegel({
  kanaal,
  plek,
  bezig,
}: {
  kanaal: string;
  plek: "de lijst" | "het weekmenu";
  bezig: boolean;
}) {
  const { user } = useAuth();
  const wie = useAanwezigheid(kanaal, bezig);
  const tekst = aanwezigTekst(wie, user?.id, plek);
  if (!tekst) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-base"
      data-testid="aanwezig"
    >
      <Users className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 break-words">{tekst}</span>
    </p>
  );
}
