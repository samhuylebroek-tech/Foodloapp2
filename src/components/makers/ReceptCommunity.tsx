/**
 * Community op een openbaar makerrecept: "Ik heb dit gekookt" (sterren + één zin) en een rustige
 * rij "Zo kookten anderen het". Geen ranglijst, geen eindeloze tijdlijn; elke bijdrage is te
 * melden en je eigen bijdrage verwijder je met "Ongedaan maken".
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Sterren, SterrenKiezer } from "@/components/Sterren";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { valideerBijdrage } from "@/lib/makers";
import {
  haalBijdragen,
  haalPubliekeBron,
  plaatsBijdrage,
  verwijderBijdrage,
  type Bijdrage,
} from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { MeldKnop } from "./MakerOnderdelen";

function voornaam(meta: Record<string, unknown> | undefined): string | null {
  const v = meta?.["voornaam"] ?? meta?.["display_name"];
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().split(/\s+/)[0]!.slice(0, 30);
}

export function ReceptCommunity({ receptId }: { receptId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar } = useModuleBeschikbaar("community_bijdragen");
  const { data: bron } = useQuery({
    queryKey: ["recept-bron", receptId],
    enabled: beschikbaar,
    queryFn: () => haalPubliekeBron(receptId),
    staleTime: 60 * 1000,
  });
  const { data: bijdragen = [], isLoading } = useQuery({
    queryKey: ["bijdragen", receptId],
    enabled: beschikbaar && !!bron,
    queryFn: () => haalBijdragen(receptId),
  });
  const [open, setOpen] = useState(false);
  const [sterren, setSterren] = useState(0);
  const [tekst, setTekst] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Alleen op openbare makerrecepten (community = publieke inhoud).
  if (!beschikbaar || !bron) return null;
  const vernieuw = () => qc.invalidateQueries({ queryKey: ["bijdragen", receptId] });

  async function plaats(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const f = valideerBijdrage(tekst, sterren);
    if (f) return setFout(f);
    setFout(null);
    setBezig(true);
    try {
      await plaatsBijdrage({
        recipe_id: receptId,
        user_id: user.id,
        weergavenaam: voornaam(user.user_metadata),
        tekst,
        sterren,
      });
      setTekst("");
      setSterren(0);
      setOpen(false);
      await vernieuw();
      toast.success("Bedankt om te delen hoe het ging!");
    } catch {
      setFout("Je bijdrage kon niet geplaatst worden. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(b: Bijdrage) {
    try {
      const zetTerug = await verwijderBijdrage(b);
      await vernieuw();
      toast.success("Je bijdrage is verwijderd", {
        action: {
          label: "Ongedaan maken",
          onClick: () => void zetTerug().then(vernieuw),
        },
      });
    } catch {
      toast.error("Verwijderen lukte niet.");
    }
  }

  return (
    <section aria-labelledby="community-titel" className="space-y-4">
      <h2 id="community-titel" className="text-sectietitel">
        Zo kookten anderen het
      </h2>
      {open ? (
        <form onSubmit={(e) => void plaats(e)} className="paneel space-y-4 p-4" noValidate>
          <SterrenKiezer waarde={sterren} onKies={setSterren} label="Hoe was het?" />
          <div className="space-y-2">
            <Label htmlFor="bijdrage-tekst" className="text-base">
              Eén zin over hoe het ging
            </Label>
            <Textarea
              id="bijdrage-tekst"
              value={tekst}
              maxLength={280}
              onChange={(e) => setTekst(e.target.value)}
              placeholder="Bijvoorbeeld: met wat extra look, en de kinderen aten alles op."
              className="min-h-20 text-base"
            />
            <p className="text-[0.9rem] text-muted-foreground">
              Iedereen die dit recept ziet, leest dit met je voornaam erbij.
            </p>
          </div>
          {fout ? (
            <p role="alert" className="text-base font-semibold text-destructive">
              {fout}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={bezig} className="h-14 px-6 text-base">
              {bezig ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-14 px-6 text-base"
            >
              Annuleren
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)} className="h-14 px-5 text-base">
          <Utensils aria-hidden />
          Ik heb dit gekookt
        </Button>
      )}

      {isLoading ? (
        <Loader2 className="size-6 animate-spin" aria-label="Laden" />
      ) : bijdragen.length ? (
        <ul className="space-y-3">
          {bijdragen.map((b) => {
            const eigen = b.user_id === user?.id;
            return (
              <li key={b.id} className="paneel space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">
                    {eigen ? "Jij" : (b.weergavenaam ?? "Iemand")}
                  </span>
                  <Sterren waarde={b.sterren} klein />
                  <span className="text-[0.9rem] text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString("nl-BE", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
                <p className="text-base break-words">{b.tekst}</p>
                <div className="flex flex-wrap gap-1">
                  {eigen ? (
                    <Button
                      variant="ghost"
                      onClick={() => void verwijder(b)}
                      className="h-auto min-h-12 px-3 text-base"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Verwijderen
                    </Button>
                  ) : (
                    <MeldKnop soort="bijdrage" doelId={b.id} label="Melden" klein />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground">
          Nog niemand vertelde hoe het ging. Kookte jij het al?
        </p>
      )}
    </section>
  );
}
