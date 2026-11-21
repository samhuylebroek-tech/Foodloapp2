/**
 * Fase 4 — wie je blokkeerde in de community (Instellingen › Gegevens en privacy). Alleen jij
 * ziet deze lijst; de ander krijgt niets te horen. Deblokkeren met één tik.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { deblokkeer, haalBlokkades } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { BLOKKADES_SLEUTEL } from "./ReceptCommunity";

export function GeblokkeerdBeheer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar } = useModuleBeschikbaar("gebruiker_blokkades");
  const { data: lijst = [] } = useQuery({
    queryKey: [BLOKKADES_SLEUTEL, user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalBlokkades(user!.id),
  });
  if (!beschikbaar || !user) return null;

  async function los(id: string, naam: string) {
    try {
      await deblokkeer(user!.id, id);
      await qc.invalidateQueries({ queryKey: [BLOKKADES_SLEUTEL] });
      toast.success(`${naam} is niet meer geblokkeerd`);
    } catch {
      toast.error("Dat lukte niet. Probeer het opnieuw.");
    }
  }

  return (
    <details className="px-4 py-3" data-testid="geblokkeerd-beheer">
      <summary className="flex min-h-12 cursor-pointer items-center gap-3 text-[1.05rem] font-semibold">
        <Ban className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        Geblokkeerd in de community ({lijst.length})
      </summary>
      {lijst.length ? (
        <ul className="mt-2 divide-y divide-border/60">
          {lijst.map((b) => {
            const naam = b.weergavenaam ?? "Iemand";
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-base">{naam}</span>
                <Button
                  variant="outline"
                  onClick={() => void los(b.geblokkeerd_id, naam)}
                  className="h-12 px-4 text-base"
                >
                  Deblokkeren<span className="sr-only"> {naam}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-base text-muted-foreground">
          Je blokkeerde niemand. Blokkeer je iemand bij een recept, dan zie je hun reacties en
          foto&apos;s niet meer.
        </p>
      )}
    </details>
  );
}
