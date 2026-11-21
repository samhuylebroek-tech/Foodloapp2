/**
 * Recept van een video (fase 2): een duidelijke link "Bekijk de video bij YouTube" met de maker,
 * en klikbare tijden bij stappen ("0:45"). Geen ingesloten speler: de video blijft bij het
 * platform, Foodlo laadt niets van buiten.
 */
import { ExternalLink, Play, Video } from "lucide-react";
import {
  tijdcodeUit,
  tijdVoluit,
  videoLinkTekst,
  videoOpTijd,
  type VideoLink,
} from "@/lib/video-link";

export function VideoBronKaart({
  video,
  maker,
}: {
  video: VideoLink;
  /** Uit de link of uit de omschrijving ("Video van @chefanna op YouTube."). */
  maker: string | null;
}) {
  return (
    <section
      aria-label="Video van dit recept"
      data-testid="video-bron"
      className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4 shadow-zacht"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-inkt text-inkt-foreground">
        <Video className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold">
          {maker ? `Video van ${maker} op ${video.platform}` : `Video op ${video.platform}`}
        </p>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-primary underline underline-offset-4"
        >
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          {videoLinkTekst(video)}
          <span className="sr-only">(opent buiten Foodlo)</span>
        </a>
      </div>
    </section>
  );
}

/** Maker uit de omschrijving die het nakijkscherm schreef ("Video van @x op TikTok."). */
export function makerUitOmschrijving(omschrijving: string | null | undefined): string | null {
  return (
    omschrijving?.match(/^Video van (.+?) op (?:YouTube|TikTok|Instagram|Facebook|Vimeo)\./)?.[1] ??
    null
  );
}

/** Omschrijving zonder die vermelding (die staat al op de videokaart). */
export function zonderVideoVermelding(omschrijving: string | null | undefined): string {
  return (omschrijving ?? "")
    .replace(/^Video van .+? op (?:YouTube|TikTok|Instagram|Facebook|Vimeo)\.\s*/, "")
    .trim();
}

/**
 * Stap met een tijdcode vooraan: de tijd wordt een link naar dat moment (als het platform dat
 * kan), de rest is de gewone staptekst. Zonder tijdcode: gewoon de tekst.
 */
export function StapMetTijd({
  tekst,
  video,
  render,
}: {
  tekst: string;
  video: VideoLink | null;
  render: (tekst: string) => string;
}) {
  const tijd = video ? tijdcodeUit(tekst) : null;
  if (!tijd || !video) return <>{render(tekst)}</>;
  const href = videoOpTijd(video, tijd.seconden);
  return (
    <>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Bekijk ${tijdVoluit(tijd.seconden)} in de video (opent buiten Foodlo)`}
          className="mr-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-secondary px-3 align-middle text-base font-semibold text-primary"
        >
          <Play className="size-4 shrink-0" aria-hidden />
          {tijd.label}
        </a>
      ) : (
        <span className="mr-2 inline-flex min-h-11 items-center rounded-full bg-secondary px-3 align-middle text-base font-semibold">
          <span className="sr-only">In de video {tijdVoluit(tijd.seconden)}: </span>
          <span aria-hidden>{tijd.label}</span>
        </span>
      )}
      {render(tijd.tekst)}
    </>
  );
}
