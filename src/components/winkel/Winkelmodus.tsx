/**
 * Winkelmodus — schermvullend afvinken in de winkel, afdeling per afdeling.
 *
 * WP5: iets niet gevonden? Dan kan je het
 * - overslaan: het blijft op je lijst (voor een volgende keer), maar telt deze ronde niet meer mee;
 * - vervangen ("geen verse spinazie → diepvries"): hoeveelheid en gekoppeld gerecht blijven,
 *   en het nieuwe product telt voor de maaltijd, de voorraad en "wat ontbreekt" als het
 *   oorspronkelijke (zie `vervangNaam` in lib/product-herkenning).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCheck,
  Loader2,
  PackageCheck,
  Repeat,
  SearchX,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIE_LABEL, type CategorieId } from "@/lib/categorie";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { vervanging } from "@/lib/product-herkenning";
import { vervangVoorstellen } from "@/lib/vervangen";
import type { VoorMorgen } from "@/lib/intelligentie/voor-morgen";
import { cn } from "@/lib/utils";
import { opsomming } from "@/lib/vandaag";

export type WinkelItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  checked: boolean;
  recipe_id?: string | null;
  recept?: string | null;
  note?: string | null;
};

export type Vervanging = { naam: string; quantity: number | null; unit: string };

const maatVan = (i: WinkelItem) => toonBelgischeMaat(i.quantity, i.unit);

/** Overgeslagen items onthouden we per lijst voor deze winkelbeurt (ook na herladen). */
function sleutel(lijstId: string) {
  return `foodlo-overgeslagen-${lijstId}`;
}
function leesOvergeslagen(lijstId: string): Set<string> {
  try {
    const ruw = sessionStorage.getItem(sleutel(lijstId));
    return new Set(ruw ? (JSON.parse(ruw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function bewaarOvergeslagen(lijstId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(sleutel(lijstId), JSON.stringify([...ids]));
  } catch {
    /* privévenster: dan alleen in het geheugen */
  }
}

export function ItemNaam({ naam, className }: { naam: string; className?: string }) {
  const v = vervanging(naam);
  return (
    <>
      <span className={className}>{v.naam}</span>
      {v.voor ? (
        <span className="block text-base text-muted-foreground">in plaats van {v.voor}</span>
      ) : null}
    </>
  );
}

export function Winkelmodus({
  lijstId,
  groepen,
  openAantal,
  aantalGekocht,
  onVink,
  onVervang,
  onSluit,
  onOpruimen,
  voorMorgen = null,
  onVoorMorgen,
}: {
  lijstId: string;
  groepen: { id: CategorieId; lijst: WinkelItem[] }[];
  openAantal: number;
  aantalGekocht: number;
  onVink: (item: WinkelItem) => void;
  /** Vervangen in de winkel: true als het bewaard is. */
  onVervang: (item: WinkelItem, door: Vervanging) => Promise<boolean>;
  onSluit: () => void;
  onOpruimen: () => void;
  /** Usecase 9: wat je voor vandaag of morgen nog nodig hebt en niet op je lijst staat. */
  voorMorgen?: VoorMorgen | null;
  /** Eén tik: zet precies die producten op de lijst (met ongedaan maken). */
  onVoorMorgen?: (v: VoorMorgen) => Promise<void>;
}) {
  const [voorMorgenBezig, setVoorMorgenBezig] = useState(false);
  const [stap, setStap] = useState(0);
  const [overgeslagen, setOvergeslagen] = useState<Set<string>>(() => leesOvergeslagen(lijstId));
  const [nietGevonden, setNietGevonden] = useState<WinkelItem | null>(null);
  // Net afgevinkt: meteen uit beeld (directe reactie, ook bij een trage verbinding; extra
  // tikken op hetzelfde product doen niets). Komt het na enkele seconden toch nog als
  // "te halen" binnen (opslaan mislukt), dan toont de winkelmodus het gewoon opnieuw.
  const [onderweg, setOnderweg] = useState<Set<string>>(() => new Set());
  const vink = (item: WinkelItem) => {
    if (onderweg.has(item.id)) return;
    setOnderweg((o) => new Set(o).add(item.id));
    onVink(item);
    window.setTimeout(() => {
      setOnderweg((o) => {
        const n = new Set(o);
        n.delete(item.id);
        return n;
      });
    }, 5000);
  };

  // Scherm aan houden zolang je winkelt, waar de telefoon dat toelaat.
  useEffect(() => {
    let slot: { release: () => Promise<void> } | null = null;
    const api = (
      navigator as unknown as {
        wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
      }
    ).wakeLock;
    void api
      ?.request("screen")
      .then((s) => {
        slot = s;
      })
      .catch(() => {});
    return () => {
      void slot?.release().catch(() => {});
    };
  }, []);

  const zetOvergeslagen = (ids: Set<string>) => {
    setOvergeslagen(ids);
    bewaarOvergeslagen(lijstId, ids);
  };

  // Wat deze ronde nog te halen is (zonder overgeslagen), en wat overgeslagen is.
  const zichtbaar = useMemo(
    () =>
      groepen
        .map((g) => ({
          ...g,
          lijst: g.lijst.filter((i) => !overgeslagen.has(i.id) && !onderweg.has(i.id)),
        }))
        .filter((g) => g.lijst.length > 0),
    [groepen, overgeslagen, onderweg],
  );
  const onderwegOpen = useMemo(
    () => groepen.flatMap((g) => g.lijst).filter((i) => onderweg.has(i.id)).length,
    [groepen, onderweg],
  );
  const overgeslagenItems = useMemo(
    () => groepen.flatMap((g) => g.lijst).filter((i) => overgeslagen.has(i.id)),
    [groepen, overgeslagen],
  );

  useEffect(() => {
    if (stap > zichtbaar.length - 1) setStap(Math.max(0, zichtbaar.length - 1));
  }, [zichtbaar.length, stap]);

  // Meteen geklemd (niet pas na het effect): anders flitst "Klaar!" even op als de laatste
  // afdeling leeg raakt terwijl er elders nog iets te halen is.
  const huidig = zichtbaar[Math.min(stap, Math.max(0, zichtbaar.length - 1))];
  const teHalen = Math.max(0, openAantal - overgeslagenItems.length - onderwegOpen);
  const totaal = openAantal + aantalGekocht;
  const procent = totaal
    ? Math.round(((aantalGekocht + overgeslagenItems.length) / totaal) * 100)
    : 100;

  // Escape sluit eerst het "niet gevonden"-paneel, anders de winkelmodus.
  useEffect(() => {
    const toets = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (nietGevonden) setNietGevonden(null);
      else onSluit();
    };
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [onSluit, nietGevonden]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Winkelmodus"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div
        className="bg-inkt px-4 pb-4 text-inkt-foreground md:px-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-inkt-foreground hover:bg-white/10 hover:text-inkt-foreground"
            aria-label="Winkelmodus sluiten"
            onClick={onSluit}
          >
            <X className="size-7" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-label text-inkt-zacht">In de winkel</p>
            <p className="font-display text-2xl font-semibold leading-tight">
              {huidig ? CATEGORIE_LABEL[huidig.id] : "Klaar"}
            </p>
          </div>
          <p className="shrink-0 text-right text-base">
            <span className="block text-2xl font-bold tabular-nums" data-testid="te-halen">
              {teHalen}
            </span>
            <span className="text-inkt-zacht">te halen</span>
          </p>
        </div>
        <div
          className="mx-auto mt-3 h-2 w-full max-w-3xl overflow-hidden rounded-full bg-white/15"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-honing transition-all"
            style={{ width: `${procent}%` }}
          />
        </div>
        {zichtbaar.length > 1 ? (
          <div
            className="scroll-rij -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-auto md:max-w-3xl md:flex-wrap md:overflow-visible md:px-0"
            role="group"
            aria-label="Afdelingen"
          >
            {zichtbaar.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setStap(i)}
                aria-current={i === stap ? "step" : undefined}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-[0.95rem] font-semibold transition-colors",
                  i === stap
                    ? "bg-honing text-honing-foreground"
                    : "bg-white/10 text-inkt-foreground",
                )}
              >
                {CATEGORIE_LABEL[g.id]} · {g.lijst.length}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {voorMorgen && onVoorMorgen ? (
            <section
              aria-labelledby="voor-morgen-kop"
              className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-honing/20 px-4 py-3"
            >
              <CalendarClock className="size-7 shrink-0 text-foreground" aria-hidden />
              <div className="min-w-0 flex-1 basis-48">
                <h2 id="voor-morgen-kop" className="text-lg font-semibold">
                  {voorMorgen.kop}: {opsomming(voorMorgen.namen, 3)}
                </h2>
                <p className="text-base break-words text-muted-foreground">
                  Voor {opsomming(voorMorgen.gerechten, 2)}. Nog niet of niet genoeg op je lijst.
                </p>
              </div>
              <Button
                type="button"
                onClick={async () => {
                  if (voorMorgenBezig) return;
                  setVoorMorgenBezig(true);
                  try {
                    await onVoorMorgen(voorMorgen);
                  } finally {
                    setVoorMorgenBezig(false);
                  }
                }}
                disabled={voorMorgenBezig}
                className="min-h-12 max-w-full shrink-0 px-4 text-base"
              >
                {voorMorgenBezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                Zet erbij
              </Button>
            </section>
          ) : null}
          {huidig ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {huidig.lijst.map((item) => (
                <li
                  key={item.id}
                  className="paneel flex min-h-24 flex-col items-stretch overflow-hidden min-[400px]:flex-row"
                >
                  <button
                    type="button"
                    onClick={() => vink(item)}
                    className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-transform active:scale-[0.98]"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-[3px] border-primary text-primary">
                      <Check className="size-7 opacity-30" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <ItemNaam
                        naam={item.name}
                        className="block text-[min(1.65rem,30px)] font-semibold leading-tight"
                      />
                      {maatVan(item) ? (
                        <span className="mt-0.5 block text-xl text-muted-foreground">
                          {maatVan(item)}
                        </span>
                      ) : null}
                    </span>
                    <span className="sr-only">— tik om af te vinken</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNietGevonden(item)}
                    aria-label={`${vervanging(item.name).naam} niet gevonden`}
                    className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-border/70 px-3 text-base font-semibold text-muted-foreground hover:bg-muted/60 min-[400px]:w-20 min-[400px]:flex-col min-[400px]:gap-1 min-[400px]:border-l min-[400px]:border-t-0 min-[400px]:px-1 min-[400px]:text-sm"
                  >
                    <SearchX className="size-6" aria-hidden />
                    Niet gevonden
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-6 text-center">
              <span className="flex size-24 items-center justify-center rounded-full bg-secondary text-primary">
                <CheckCheck className="size-12" />
              </span>
              <p className="text-paginatitel">
                {overgeslagenItems.length ? "Klaar met deze winkel" : "Klaar! Alles gekocht"}
              </p>
              {overgeslagenItems.length ? (
                <section
                  aria-labelledby="niet-gevonden-titel"
                  className="paneel w-full max-w-sm px-4 py-3 text-left"
                >
                  <h2 id="niet-gevonden-titel" className="text-lg font-semibold">
                    Niet gevonden · {overgeslagenItems.length}
                  </h2>
                  <p className="text-base text-muted-foreground">Blijft op je lijst voor later.</p>
                  <ul className="mt-2 divide-y divide-border/70">
                    {overgeslagenItems.map((i) => (
                      <li key={i.id} className="flex min-h-14 items-center gap-2">
                        <span className="min-w-0 flex-1 text-lg">
                          <ItemNaam naam={i.name} className="block truncate" />
                        </span>
                        <Button
                          variant="ghost"
                          className="h-12 shrink-0"
                          aria-label={`${vervanging(i.name).naam} toch gevonden`}
                          onClick={() => {
                            const n = new Set(overgeslagen);
                            n.delete(i.id);
                            zetOvergeslagen(n);
                          }}
                        >
                          <Undo2 /> Toch gevonden
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {aantalGekocht > 0 ? (
                <Button className="h-16 w-full max-w-sm text-lg" onClick={onOpruimen}>
                  <PackageCheck className="size-6" /> Klaar met winkelen
                </Button>
              ) : null}
              <Button variant="outline" className="h-14 w-full max-w-sm text-lg" onClick={onSluit}>
                Nog iets vergeten
              </Button>
              <p className="text-base text-muted-foreground">
                Wat je kocht, gaat naar je voorraad.
              </p>
            </div>
          )}
        </div>
      </div>

      {zichtbaar.length > 0 && (
        <div
          className="border-t border-border bg-card px-4 pt-3 md:px-8"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-16 text-base"
              disabled={stap === 0}
              onClick={() => setStap((s) => Math.max(0, s - 1))}
            >
              Vorige afdeling
            </Button>
            <Button
              className="h-16 text-base"
              disabled={stap >= zichtbaar.length - 1}
              onClick={() => setStap((s) => s + 1)}
            >
              Volgende afdeling
            </Button>
          </div>
        </div>
      )}

      {nietGevonden ? (
        <NietGevonden
          item={nietGevonden}
          onSluit={() => setNietGevonden(null)}
          onOverslaan={() => {
            zetOvergeslagen(new Set([...overgeslagen, nietGevonden.id]));
            setNietGevonden(null);
          }}
          onVervang={async (door) => {
            const gelukt = await onVervang(nietGevonden, door);
            if (gelukt) setNietGevonden(null);
          }}
        />
      ) : null}
    </div>
  );
}

function NietGevonden({
  item,
  onSluit,
  onOverslaan,
  onVervang,
}: {
  item: WinkelItem;
  onSluit: () => void;
  onOverslaan: () => void;
  onVervang: (door: Vervanging) => Promise<void>;
}) {
  const naam = vervanging(item.name).naam;
  const [door, setDoor] = useState("");
  const [aantal, setAantal] = useState(item.quantity == null ? "" : String(item.quantity));
  const [eenheid, setEenheid] = useState(item.unit ?? "");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const eerste = useRef<HTMLButtonElement>(null);
  const terug = useRef<Element | null>(null);

  useEffect(() => {
    terug.current = document.activeElement;
    eerste.current?.focus();
    return () => {
      if (terug.current instanceof HTMLElement) terug.current.focus();
    };
  }, []);

  async function vervang() {
    const nieuw = door.trim();
    if (!nieuw) {
      setFout("Waarmee vervang je het?");
      return;
    }
    const q = aantal.trim() ? Number(aantal.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q < 0)) {
      setFout("Vul een geldig aantal in");
      return;
    }
    setFout(null);
    setBezig(true);
    try {
      await onVervang({ naam: nieuw, quantity: q, unit: eenheid.trim() });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 md:items-center">
      <button
        type="button"
        aria-label="Sluiten"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onSluit}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="niet-gevonden-kop"
        className="relative w-full max-w-lg rounded-t-[1.75rem] bg-card px-5 pt-5 shadow-kaart md:rounded-[1.75rem] md:pb-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <h2 id="niet-gevonden-kop" className="text-2xl font-semibold">
          {naam} niet gevonden?
        </h2>
        {item.recept ? (
          <p className="mt-1 text-base text-muted-foreground">
            Voor {item.recept}. Dat blijft zo, ook als je het vervangt.
          </p>
        ) : null}

        <Button
          ref={eerste}
          variant="outline"
          className="mt-4 h-16 w-full justify-start text-lg"
          onClick={onOverslaan}
        >
          <SearchX className="size-6" /> Overslaan
          <span className="ml-auto text-base font-normal text-muted-foreground">
            blijft op je lijst
          </span>
        </Button>

        <form
          className="mt-5 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void vervang();
          }}
        >
          <label htmlFor="vervang-door" className="text-lg font-semibold">
            Of vervangen door
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {vervangVoorstellen(item.name).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDoor(v)}
                aria-pressed={door === v}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-base font-medium",
                  door === v ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Input
            id="vervang-door"
            value={door}
            onChange={(e) => setDoor(e.target.value)}
            placeholder="Bijv. diepvriesspinazie"
            className="mt-3 h-14 text-lg"
            autoComplete="off"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="vervang-aantal" className="text-base text-muted-foreground">
                Hoeveel
              </label>
              <Input
                id="vervang-aantal"
                inputMode="decimal"
                value={aantal}
                onChange={(e) => setAantal(e.target.value)}
                className="mt-1 h-14 text-lg"
              />
            </div>
            <div>
              <label htmlFor="vervang-eenheid" className="text-base text-muted-foreground">
                Eenheid
              </label>
              <Input
                id="vervang-eenheid"
                value={eenheid}
                onChange={(e) => setEenheid(e.target.value)}
                placeholder="g, stuk, zak…"
                className="mt-1 h-14 text-lg"
              />
            </div>
          </div>
          {fout ? (
            <p role="alert" className="mt-2 text-base text-destructive">
              {fout}
            </p>
          ) : null}
          <Button type="submit" className="mt-4 h-16 w-full text-lg" disabled={bezig}>
            <Repeat className="size-6" /> Vervangen en in mijn kar
          </Button>
        </form>
        <Button variant="ghost" className="mt-2 h-12 w-full text-base" onClick={onSluit}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
