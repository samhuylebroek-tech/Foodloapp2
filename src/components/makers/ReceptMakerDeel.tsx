/**
 * Op de receptpagina (module B): bronvermelding "Van <maker>", video-link, "Bewaar in…" en een
 * meldknop voor openbare recepten. Zonder de tabellen (productie vóór 0008) toont dit niets.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { videoBron } from "@/lib/makers";
import { haalPubliekeBron } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { BewaarIn } from "./BewaarIn";
import { MakerBron, MeldKnop } from "./MakerOnderdelen";

export function ReceptMakerDeel({
  receptId,
  zonderVideo = false,
}: {
  receptId: string;
  /** Fase 4: de video van de maker staat al op de videokaart (met tijden bij de stappen). */
  zonderVideo?: boolean;
}) {
  const { user } = useAuth();
  const makers = useModuleBeschikbaar("creators");
  const verzamelingen = useModuleBeschikbaar("collections");
  const { data: bron } = useQuery({
    queryKey: ["recept-bron", receptId],
    enabled: makers.beschikbaar,
    queryFn: () => haalPubliekeBron(receptId),
    staleTime: 60 * 1000,
  });
  const video = zonderVideo ? null : videoBron(bron?.publicatie.video_url);
  const eigen = bron?.maker.user_id === user?.id;

  if (!bron && !verzamelingen.beschikbaar) return null;
  return (
    <div className="space-y-2">
      {bron ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <MakerBron maker={bron.maker} />
          {video ? (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary underline underline-offset-4"
            >
              <ExternalLink className="size-5 shrink-0" aria-hidden />
              Video op {video.platform}
              <span className="sr-only">(opent buiten Foodlo)</span>
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {verzamelingen.beschikbaar ? <BewaarIn receptId={receptId} /> : null}
        {bron && !eigen ? (
          <MeldKnop soort="recept" doelId={receptId} label="Recept melden" />
        ) : null}
      </div>
    </div>
  );
}
