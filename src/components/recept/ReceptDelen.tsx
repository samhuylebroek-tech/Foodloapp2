/**
 * Recept delen (fase 2): link kopiëren, als tekst delen (Web Share met kopieer-terugval) en
 * duidelijk zeggen wie de link kan openen. Openbaar maken loopt via de maker-studio, waar het
 * Foodlo-team het eerst nakijkt (module B).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Copy, Globe, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/module-beschikbaar";
import type { Publicatie } from "@/lib/makers";
import { deelStatus, receptAlsTekst, receptLink } from "@/lib/recept-delen";
import { herkenVideoLink } from "@/lib/video-link";

type Ingredient = { name: string; quantity: number | null; unit: string | null };

async function kopieer(tekst: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    return false;
  }
}

export function ReceptDelen({
  open,
  onOpenChange,
  recept,
  ingredienten,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recept: { id: string; title: string; instructions: string[]; source_url: string | null };
  ingredienten: readonly Ingredient[];
  isOwner: boolean;
}) {
  const { data: publicatie } = useQuery({
    queryKey: ["recept-publicatie-status", recept.id],
    enabled: open,
    retry: false,
    queryFn: async () => {
      // Zonder de makertabellen (productie vóór 0008) is elk recept privé.
      const { data, error } = await db
        .from("recipe_publicaties")
        .select("zichtbaarheid, status, moderatie")
        .eq("recipe_id", recept.id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as Pick<Publicatie, "zichtbaarheid" | "status" | "moderatie"> | null;
    },
  });
  const status = deelStatus({
    zichtbaarheid: publicatie?.zichtbaarheid ?? null,
    gepubliceerd: publicatie?.status === "gepubliceerd",
    moderatie: publicatie?.moderatie ?? null,
  });
  const link = receptLink(typeof window === "undefined" ? "" : window.location.origin, recept.id);
  const video = herkenVideoLink(recept.source_url);
  const tekst = receptAlsTekst({
    title: recept.title,
    ingredienten,
    stappen: recept.instructions,
    link,
    bron: video?.url ?? recept.source_url,
  });

  async function kopieerLink() {
    if (await kopieer(link)) toast.success("Link gekopieerd");
    else toast.error("Kopiëren lukte niet. Houd de link hieronder ingedrukt om te kopiëren.");
  }

  async function deelTekst() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: recept.title, text: tekst });
        return;
      } catch (e) {
        // Zelf geannuleerd: niets doen. Andere fout: kopiëren als terugval.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    if (await kopieer(tekst)) toast.success("Recept als tekst gekopieerd. Plak het in je bericht.");
    else toast.error("Kopiëren lukte niet.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left text-xl">Recept delen</DialogTitle>
          <DialogDescription className="text-left text-base">
            Stuur “{recept.title}” door. Wie het opent, kan het in zijn eigen gerechten zetten.
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="deel-status"
          className="flex gap-3 rounded-2xl bg-secondary p-3 text-base"
        >
          {status.openbaar ? (
            <Globe className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold">{status.titel}</p>
            <p className="text-[0.95rem] leading-snug text-muted-foreground">{status.uitleg}</p>
            {isOwner && !status.openbaar ? (
              <Link
                to="/maker"
                className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
              >
                Openbaar maken via je makerprofiel
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 min-[400px]:grid-cols-2">
          <Button onClick={() => void kopieerLink()} className="h-auto min-h-14 text-base">
            <Copy className="size-5 shrink-0" aria-hidden />
            Link kopiëren
          </Button>
          <Button
            variant="outline"
            onClick={() => void deelTekst()}
            className="h-auto min-h-14 text-base"
          >
            <Share2 className="size-5 shrink-0" aria-hidden />
            Als tekst delen
          </Button>
        </div>
        <p className="break-words rounded-2xl border border-border p-3 text-[0.95rem] text-muted-foreground">
          {link}
        </p>
      </DialogContent>
    </Dialog>
  );
}
