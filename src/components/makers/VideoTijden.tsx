/**
 * Fase 4 — videorecept: de maker zet bij elke stap het moment in de video ("0:45"). De tijd komt
 * vooraan in de staptekst (zelfde vorm als bij een recept van een video, fase 2), zodat de
 * receptpagina ze als klikbare tijden toont. Geen download, geen ingesloten speler.
 */
import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { herkenVideoLink, videoLinkTekst } from "@/lib/video-link";
import { splitsStap, stappenMetTijden } from "@/lib/video-tijden";

export function VideoTijden({
  recept,
  videoUrl,
}: {
  recept: { id: string; title: string; instructions: string[] };
  videoUrl: string;
}) {
  const id = useId();
  const qc = useQueryClient();
  const video = herkenVideoLink(videoUrl);
  const [tijden, setTijden] = useState(() => recept.instructions.map((s) => splitsStap(s).tijd));
  const [fout, setFout] = useState<{ tekst: string; stap: number } | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(
    () => setTijden(recept.instructions.map((s) => splitsStap(s).tijd)),
    [recept.instructions],
  );

  if (!recept.instructions.length)
    return (
      <p className="text-base text-muted-foreground">
        Dit recept heeft nog geen stappen. Voeg ze toe in je recept; daarna kan je hier de tijden in
        de video zetten.
      </p>
    );

  async function schrijf(stappen: string[]) {
    const { error } = await supabase
      .from("recipes")
      .update({ instructions: stappen })
      .eq("id", recept.id);
    if (error) throw error;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["maker-eigen-recepten"] }),
      qc.invalidateQueries({ queryKey: ["recipe", recept.id] }),
    ]);
  }

  async function bewaar() {
    const r = stappenMetTijden(recept.instructions, tijden);
    if ("fout" in r) {
      setFout({ tekst: r.fout, stap: r.stap });
      document.getElementById(`${id}-tijd-${r.stap}`)?.focus();
      return;
    }
    setFout(null);
    setBezig(true);
    const vorige = [...recept.instructions];
    try {
      await schrijf(r.stappen);
      toast.success("Tijden bij de stappen bewaard", {
        id: `tijden-${recept.id}`,
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void schrijf(vorige).then(
              () => toast.success("Teruggezet"),
              () => toast.error("Terugzetten lukte niet."),
            ),
        },
      });
    } catch {
      toast.error("Bewaren lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="video-tijden">
      <p className="text-base">
        Zet bij elke stap waar die in je video begint, zoals <strong>0:45</strong>. Laat leeg als
        een stap niet in de video zit.
      </p>
      {video ? (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary underline underline-offset-4"
        >
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          {videoLinkTekst(video)}
          <span className="sr-only">(opent buiten Foodlo)</span>
        </a>
      ) : null}
      <ol className="space-y-3">
        {recept.instructions.map((stap, i) => {
          const veld = `${id}-tijd-${i}`;
          return (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem] sm:items-center">
              <label htmlFor={veld} className="text-base">
                <span className="font-semibold">Stap {i + 1}: </span>
                <span className="break-words">{splitsStap(stap).tekst}</span>
                <span className="sr-only"> — tijd in de video</span>
              </label>
              <Input
                id={veld}
                value={tijden[i] ?? ""}
                inputMode="text"
                placeholder="0:00"
                aria-invalid={fout?.stap === i ? true : undefined}
                aria-describedby={fout?.stap === i ? `${id}-fout` : undefined}
                onChange={(e) => setTijden((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-14 max-w-40 text-base"
              />
            </li>
          );
        })}
      </ol>
      {fout ? (
        <p id={`${id}-fout`} role="alert" className="text-base font-semibold text-destructive">
          {fout.tekst}
        </p>
      ) : null}
      <Button
        variant="outline"
        disabled={bezig}
        onClick={() => void bewaar()}
        className="h-14 px-5 text-base"
      >
        {bezig ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Tijden bewaren
      </Button>
    </div>
  );
}
