/**
 * Community op een openbaar makerrecept (fase 4): "Ik heb het gemaakt" (sterren, één zin en
 * eventueel een foto) en gewone reacties, in een rustige rij "Zo kookten anderen het". Geen
 * ranglijst, geen eindeloze tijdlijn. Alleen je voornaam staat erbij. Andermans bijdrage kan je
 * melden (moderatie in beheer) of de persoon blokkeren; je eigen bijdrage verwijder je met
 * "Ongedaan maken".
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, MessageCircle, Trash2, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Sterren, SterrenKiezer } from "@/components/Sterren";
import { FotoKiezer } from "@/components/FotoKiezer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  valideerBijdrage,
  valideerReactie,
  zichtbareBijdragen,
  type BijdrageSoort,
} from "@/lib/makers";
import {
  blokkeer,
  deblokkeer,
  haalBijdragen,
  haalBlokkades,
  haalPubliekeBron,
  plaatsBijdrage,
  verwijderBijdrage,
  type Bijdrage,
} from "@/lib/makers-db";
import {
  uploadCommunityFoto,
  useCommunityFotoUrl,
  verwijderCommunityFoto,
} from "@/lib/community-foto";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { MeldKnop } from "./MakerOnderdelen";
import { useToestemmingen } from "@/lib/privacy/toestemmingen";
import { Link } from "@tanstack/react-router";

function voornaam(meta: Record<string, unknown> | undefined): string | null {
  const v = meta?.["voornaam"] ?? meta?.["display_name"];
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().split(/\s+/)[0]!.slice(0, 30);
}

export const BLOKKADES_SLEUTEL = "blokkades";

export function ReceptCommunity({ receptId }: { receptId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar } = useModuleBeschikbaar("community_bijdragen");
  // Fase 8: "Zichtbaar in de community" ingetrokken → niets meer delen tot je het weer aanzet.
  const { keuzes } = useToestemmingen(user?.id);
  const blokModule = useModuleBeschikbaar("gebruiker_blokkades");
  const { data: bron } = useQuery({
    queryKey: ["recept-bron", receptId],
    enabled: beschikbaar,
    queryFn: () => haalPubliekeBron(receptId),
    staleTime: 60 * 1000,
  });
  const { data: alle = [], isLoading } = useQuery({
    queryKey: ["bijdragen", receptId],
    enabled: beschikbaar && !!bron,
    queryFn: () => haalBijdragen(receptId, user?.id),
  });
  const { data: blokkades = [] } = useQuery({
    queryKey: [BLOKKADES_SLEUTEL, user?.id],
    enabled: blokModule.beschikbaar && !!user,
    queryFn: () => haalBlokkades(user!.id),
  });
  const [open, setOpen] = useState<BijdrageSoort | null>(null);
  const [sterren, setSterren] = useState(0);
  const [tekst, setTekst] = useState("");
  const [foto, zetFotoBestand] = useState<{ bestand: File; url: string } | null>(null);
  const setFoto = (f: File | null) =>
    zetFotoBestand((oud) => {
      if (oud) URL.revokeObjectURL(oud.url);
      return f ? { bestand: f, url: URL.createObjectURL(f) } : null;
    });
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Alleen op openbare makerrecepten (community = publieke inhoud).
  if (!beschikbaar || !bron) return null;
  const vernieuw = () => qc.invalidateQueries({ queryKey: ["bijdragen", receptId] });
  const geblokkeerd = new Set(blokkades.map((b) => b.geblokkeerd_id));
  const { zichtbaar, weggelaten } = zichtbareBijdragen(alle, user?.id, geblokkeerd);

  function sluit() {
    setOpen(null);
    setTekst("");
    setSterren(0);
    setFoto(null);
    setFout(null);
  }

  async function plaats(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !open) return;
    const f = open === "gemaakt" ? valideerBijdrage(tekst, sterren) : valideerReactie(tekst);
    if (f) return setFout(f);
    setFout(null);
    setBezig(true);
    let pad: string | null = null;
    try {
      if (open === "gemaakt" && foto) {
        try {
          pad = await uploadCommunityFoto(foto.bestand, user.id);
        } catch {
          setFout("De foto kon niet bewaard worden. Probeer een andere foto, of deel zonder foto.");
          return;
        }
      }
      await plaatsBijdrage({
        recipe_id: receptId,
        user_id: user.id,
        weergavenaam: voornaam(user.user_metadata),
        tekst,
        sterren: open === "gemaakt" ? sterren : null,
        soort: open,
        foto_url: pad,
      });
      const soort = open;
      sluit();
      await vernieuw();
      toast.success(
        soort === "gemaakt" ? "Bedankt om te delen hoe het ging!" : "Je reactie staat erbij",
      );
    } catch {
      if (pad) void verwijderCommunityFoto(pad);
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

  async function blokkeerVan(b: Bijdrage) {
    if (!user) return;
    const naam = b.weergavenaam ?? "Deze persoon";
    try {
      await blokkeer(user.id, b.user_id, b.weergavenaam);
      await qc.invalidateQueries({ queryKey: [BLOKKADES_SLEUTEL] });
      toast.success(`${naam} is geblokkeerd. Je ziet hun bijdragen niet meer.`, {
        id: `blok-${b.user_id}`,
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void deblokkeer(user.id, b.user_id).then(() =>
              qc.invalidateQueries({ queryKey: [BLOKKADES_SLEUTEL] }),
            ),
        },
      });
    } catch {
      toast.error("Blokkeren lukte niet.");
    }
  }

  return (
    <section aria-labelledby="community-titel" className="space-y-4">
      <h2 id="community-titel" className="text-sectietitel">
        Zo kookten anderen het
      </h2>
      {open ? (
        <form onSubmit={(e) => void plaats(e)} className="paneel space-y-4 p-4" noValidate>
          <h3 className="text-base font-semibold">
            {open === "gemaakt" ? "Ik heb het gemaakt" : "Reageren"}
          </h3>
          {open === "gemaakt" ? (
            <SterrenKiezer waarde={sterren} onKies={setSterren} label="Hoe was het?" />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="bijdrage-tekst" className="text-base">
              {open === "gemaakt" ? "Eén zin over hoe het ging" : "Je reactie of vraag"}
            </Label>
            <Textarea
              id="bijdrage-tekst"
              value={tekst}
              maxLength={280}
              onChange={(e) => setTekst(e.target.value)}
              placeholder={
                open === "gemaakt"
                  ? "Bijvoorbeeld: met wat extra look, en de kinderen aten alles op."
                  : "Bijvoorbeeld: kan dit ook met diepvriesprei?"
              }
              className="min-h-20 text-base"
            />
            <p className="text-[0.9rem] text-muted-foreground">
              Iedereen die dit recept ziet, leest dit met je voornaam erbij.
            </p>
          </div>
          {open === "gemaakt" ? (
            <div className="space-y-2">
              <p className="text-base font-semibold">Foto (mag, hoeft niet)</p>
              {foto ? (
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={foto.url}
                    alt="Je gekozen foto"
                    className="size-24 rounded-xl object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFoto(null)}
                    className="h-14 px-4 text-base"
                  >
                    <X aria-hidden />
                    Foto weghalen
                  </Button>
                </div>
              ) : (
                <FotoKiezer
                  rustig
                  onBestand={(f) =>
                    f.type.startsWith("image/")
                      ? setFoto(f)
                      : setFout("Kies een foto (jpg of png).")
                  }
                />
              )}
              <p className="text-[0.9rem] text-muted-foreground">
                Iedereen die dit recept ziet, kan je foto zien. Kies een foto van het gerecht, niet
                van mensen.
              </p>
            </div>
          ) : null}
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
            <Button type="button" variant="outline" onClick={sluit} className="h-14 px-6 text-base">
              Annuleren
            </Button>
          </div>
        </form>
      ) : !keuzes.community.aan ? (
        <p className="paneel p-4 text-base" data-testid="community-uit">
          Je hebt delen in de community uitgezet. Weer aanzetten kan bij{" "}
          <Link to="/instellingen/privacy" className="font-semibold text-primary underline">
            Privacy & toestemmingen
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen("gemaakt")}
            className="h-14 px-5 text-base"
          >
            <Utensils aria-hidden />
            Ik heb het gemaakt
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen("reactie")}
            className="h-14 px-5 text-base"
          >
            <MessageCircle aria-hidden />
            Reageren
          </Button>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="size-6 animate-spin" aria-label="Laden" />
      ) : zichtbaar.length ? (
        <ul className="space-y-3">
          {zichtbaar.map((b) => (
            <BijdrageRij
              key={b.id}
              b={b}
              eigen={b.user_id === user?.id}
              kanBlokkeren={blokModule.beschikbaar}
              onVerwijder={() => void verwijder(b)}
              onBlokkeer={() => void blokkeerVan(b)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground">
          Nog niemand vertelde hoe het ging. Kookte jij het al?
        </p>
      )}
      {weggelaten ? (
        <p className="text-[0.95rem] text-muted-foreground">
          {weggelaten === 1
            ? "1 bijdrage van iemand die je blokkeerde, is verborgen."
            : `${weggelaten} bijdragen van mensen die je blokkeerde, zijn verborgen.`}{" "}
          Beheren in Instellingen › Gegevens en privacy.
        </p>
      ) : null}
    </section>
  );
}

function BijdrageRij({
  b,
  eigen,
  kanBlokkeren,
  onVerwijder,
  onBlokkeer,
}: {
  b: Bijdrage;
  eigen: boolean;
  kanBlokkeren: boolean;
  onVerwijder: () => void;
  onBlokkeer: () => void;
}) {
  const fotoUrl = useCommunityFotoUrl(b.foto_url);
  const naam = eigen ? "Jij" : (b.weergavenaam ?? "Iemand");
  const reactie = b.soort === "reactie" || b.sterren === null;
  return (
    <li className="paneel space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{naam}</span>
        {reactie ? (
          <span className="text-[0.95rem] text-muted-foreground">reageerde</span>
        ) : (
          <>
            <span className="text-[0.95rem] text-muted-foreground">maakte het</span>
            <Sterren waarde={b.sterren ?? 0} klein />
          </>
        )}
        <span className="text-[0.9rem] text-muted-foreground">
          {new Date(b.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "long" })}
        </span>
      </div>
      {eigen && b.verborgen ? (
        <p role="note" className="rounded-xl bg-muted p-2 text-[0.95rem]">
          Het Foodlo-team heeft deze bijdrage verborgen. Alleen jij ziet ze nog.
        </p>
      ) : null}
      <p className="text-base break-words">{b.tekst}</p>
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={`Foto van ${naam === "Jij" ? "jou" : naam}`}
          loading="lazy"
          className="max-h-64 w-full max-w-sm rounded-2xl object-cover"
        />
      ) : null}
      <div className="flex flex-wrap gap-1">
        {eigen ? (
          <Button variant="ghost" onClick={onVerwijder} className="h-auto min-h-12 px-3 text-base">
            <Trash2 className="size-4" aria-hidden />
            Verwijderen
          </Button>
        ) : (
          <>
            <MeldKnop soort="bijdrage" doelId={b.id} label="Melden" klein />
            {kanBlokkeren ? (
              <Button
                variant="ghost"
                onClick={onBlokkeer}
                className="h-auto min-h-12 px-3 text-base"
              >
                <Ban className="size-4" aria-hidden />
                Blokkeren
                <span className="sr-only"> {b.weergavenaam ?? "deze persoon"}</span>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
