/**
 * "Klaar met koken" (P3): één rustig scherm na de kookstand of na "Gekookt" op Vandaag/Week.
 * - Wat vond je ervan? Sterren, "Niet nu", "Niet voor mij" (meteen bewaard, met ongedaan maken).
 * - Blijft er iets over? Restje met naam, porties en een richtwaarde voor de bewaardatum.
 * - Voorraad bijwerken? Alleen als je je voorraad bijhoudt; een voorstel met vinkjes, niets
 *   gaat eraf zonder jouw bevestiging, onbekende eenheid = jij vult in. Eén keer ongedaan maken.
 * - Notitie bij het recept (alleen voor jou) en "Klaar" markeert de maaltijd als gekookt.
 * Alles overslaan mag: "Later" verandert niets.
 */
import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKringloopVernieuw } from "@/hooks/useAanvulling";
import { Button } from "@/components/ui/button";
import { SterrenKiezer } from "@/components/Sterren";
import { RestjeVraag } from "@/components/kringloop/RestjeVraag";
import { HalfGelukt, werkVoorraadBij, type Herstel } from "@/lib/kringloop-db";
import { bewaarKookmoment } from "@/lib/koken/kookmomenten-db";
import { NOTITIE_MAX } from "@/lib/koken/kookmomenten";
import {
  aftrekSamenvatting,
  getalTekst,
  maatTekst,
  stelAftrekVoor,
  type AftrekKeuze,
  type GebruiktIngredient,
  type VoorraadProduct,
} from "@/lib/koken/voorraad-aftrek";
import {
  herstelNietNu,
  herstelNietVoorMij,
  nietNuLijst,
  nietVoorMijLijst,
  zetNietNu,
  zetNietVoorMij,
} from "@/lib/intelligentie/niet-nu";
import { useVoorraadBijhouden } from "@/lib/intelligentie/voorraad-modus";
import { meet } from "@/lib/meten";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";

type Props = {
  recept: { id: string; title: string };
  ingredienten: readonly GebruiktIngredient[];
  /** Porties ten opzichte van het recept (2 van 4 = 0,5). */
  factor: number;
  porties: number;
  planId: string | null;
  score: number;
  onScore: (n: number) => Promise<void> | void;
  onTerug?: (() => void) | undefined;
  /** Scherm sluiten; `gekookt` = de gebruiker tikte "Klaar". */
  onSluit: (gekookt: boolean) => void;
};

const pil = (aan: boolean) =>
  cn(
    "inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-semibold",
    aan ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
  );

export function KlaarMetKoken(p: Props) {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notitie, setNotitie] = useState("");
  const [bezig, setBezig] = useState(false);
  const notitieId = useId();
  const notitieUitleg = useId();

  async function klaar() {
    if (!user) return p.onSluit(true);
    setBezig(true);
    try {
      const r = await bewaarKookmoment(user.id, {
        recipeId: p.recept.id,
        planId: p.planId,
        porties: p.porties,
        notitie,
      });
      void meet("koken.klaar", undefined, { notitie: !!r.moment.notitie, plan: !!p.planId });
      await qc.invalidateQueries({ queryKey: ["kookmomenten"] });
      void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
      toast.success(t("Gemarkeerd als gekookt"), {
        description: r.moment.notitie ? t("Je notitie staat bij het recept.") : undefined,
        duration: 8000,
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void r
              .herstel()
              .then(() => qc.invalidateQueries({ queryKey: ["kookmomenten"] }))
              .then(() => qc.invalidateQueries({ queryKey: ["home-dagmenu"] }))
              .catch(() => toast.error(t("Terugzetten lukte niet. Probeer het zo opnieuw."))),
        },
      });
      p.onSluit(true);
    } catch {
      toast.error(t("Bewaren lukte niet. Er is niets veranderd; probeer het zo opnieuw."));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="paneel p-5 text-center sm:p-6">
          <h1 className="text-paginatitel">{t("Smakelijk gegeten?")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {t("Gekookt")}: “{p.recept.title}”
          </p>
          <p className="mt-1 text-base text-muted-foreground">
            {t("Alles hieronder is vrijblijvend. Sla gerust over wat je niet nodig hebt.")}
          </p>
        </header>

        <Oordeel
          receptId={p.recept.id}
          titel={p.recept.title}
          score={p.score}
          onScore={p.onScore}
        />

        <section className="paneel p-5">
          <RestjeVraag titel={p.recept.title} receptId={p.recept.id} />
        </section>

        <VoorraadBijwerken ingredienten={p.ingredienten} factor={p.factor} />

        <section className="paneel p-5">
          <label htmlFor={notitieId} className="text-lg font-semibold">
            {t("Notitie bij het recept")}
          </label>
          <p id={notitieUitleg} className="text-base text-muted-foreground">
            {t(
              "Alleen voor jou, bv. “volgende keer minder zout”. Wordt bewaard als je op Klaar tikt.",
            )}
          </p>
          <textarea
            id={notitieId}
            aria-describedby={notitieUitleg}
            value={notitie}
            maxLength={NOTITIE_MAX}
            onChange={(e) => setNotitie(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-input bg-background p-3 text-base"
          />
        </section>

        <div className="flex flex-col gap-3 pb-6">
          <Button onClick={() => void klaar()} disabled={bezig} className="h-16 w-full text-lg">
            {bezig ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-5" aria-hidden />
            )}
            {t("Klaar")}
          </Button>
          {p.onTerug ? (
            <Button variant="secondary" onClick={p.onTerug} className="h-16 w-full text-lg">
              {t("Terug naar de stappen")}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => p.onSluit(false)} className="h-16 w-full text-lg">
            {t("Later")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Sterren + "Niet nu" + "Niet voor mij": de bestaande feedback, meteen bewaard. */
function Oordeel({
  receptId,
  titel,
  score,
  onScore,
}: {
  receptId: string;
  titel: string;
  score: number;
  onScore: (n: number) => Promise<void> | void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [nietNu, setNietNu] = useState(() => nietNuLijst(user?.id).includes(receptId));
  const [nietVoorMij, setNietVoorMij] = useState(() =>
    nietVoorMijLijst(user?.id).includes(receptId),
  );

  function wisselNietNu() {
    if (!user) return;
    if (nietNu) {
      herstelNietNu(user.id, receptId);
      setNietNu(false);
      return;
    }
    zetNietNu(user.id, receptId);
    setNietNu(true);
    void meet("feedback.niet_nu", undefined, { bron: "klaar" });
    toast(t("Foodlo stelt dit een week niet voor."), {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          herstelNietNu(user.id, receptId);
          setNietNu(false);
        },
      },
    });
  }

  function wisselNietVoorMij() {
    if (!user) return;
    if (nietVoorMij) {
      herstelNietVoorMij(user.id, receptId);
      setNietVoorMij(false);
      return;
    }
    zetNietVoorMij(user.id, receptId);
    setNietVoorMij(true);
    void meet("feedback.niet_voor_mij", undefined, { bron: "klaar" });
    toast(t("Foodlo stelt dit niet meer voor. Je recept blijft bewaard."), {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          herstelNietVoorMij(user.id, receptId);
          setNietVoorMij(false);
        },
      },
    });
  }

  return (
    <section className="paneel p-5" aria-labelledby="oordeel-titel">
      <h2 id="oordeel-titel" className="text-lg font-semibold">
        {t("Hoeveel sterren geef je")} “{titel}”?
      </h2>
      <div className="mt-3">
        <SterrenKiezer
          waarde={score}
          onKies={(n) => {
            void Promise.resolve(onScore(n)).then(() => {
              if (n) toast.success(t("Bedankt voor je score"));
            });
          }}
          label={t("Jouw score")}
        />
      </div>
      <p className="mt-4 text-base text-muted-foreground">
        {t("Foodlo leert hiervan voor de volgende voorstellen.")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" aria-pressed={nietNu} onClick={wisselNietNu} className={pil(nietNu)}>
          {t("Niet nu")}
        </button>
        <button
          type="button"
          aria-pressed={nietVoorMij}
          onClick={wisselNietVoorMij}
          className={pil(nietVoorMij)}
        >
          {t("Niet voor mij")}
        </button>
      </div>
    </section>
  );
}

/** "Voorraad bijwerken?" — alleen als je je voorraad bijhoudt en er iets uit je voorraad gebruikt is. */
function VoorraadBijwerken({
  ingredienten,
  factor,
}: {
  ingredienten: readonly GebruiktIngredient[];
  factor: number;
}) {
  const t = useT();
  const { user } = useAuth();
  const [bijgehouden] = useVoorraadBijhouden();
  const vernieuw = useKringloopVernieuw();
  const { data: voorraad, isLoading } = useQuery({
    queryKey: ["voorraad", "klaar-met-koken", user?.id],
    enabled: !!user && bijgehouden,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, naam, hoeveelheid, eenheid")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as VoorraadProduct[];
    },
  });
  const regels = useMemo(
    () => (voorraad ? stelAftrekVoor(ingredienten, voorraad, factor) : []),
    [voorraad, ingredienten, factor],
  );
  const [keuzes, setKeuzes] = useState<Record<string, AftrekKeuze>>({});
  const [bezig, setBezig] = useState(false);
  const [gedaan, setGedaan] = useState<{ tekst: string; herstel: Herstel } | null>(null);
  const [teruggezet, setTeruggezet] = useState(false);

  if (!bijgehouden || !user) return null;
  if (isLoading)
    return (
      <section className="paneel p-5" aria-busy="true">
        <p className="text-base text-muted-foreground">{t("Even je voorraad nakijken…")}</p>
      </section>
    );
  if (!regels.length) return null;

  const keuze = (id: string): AftrekKeuze => {
    const r = regels.find((x) => x.id === id)!;
    return keuzes[id] ?? { aan: r.aan, gebruikt: r.gebruikt };
  };
  const zet = (id: string, deel: Partial<AftrekKeuze>) =>
    setKeuzes((k) => ({ ...k, [id]: { ...keuze(id), ...deel } }));
  const aantalAan = regels.filter((r) => {
    const k = keuze(r.id);
    return k.aan && (k.op || (k.gebruikt != null && k.gebruikt > 0));
  }).length;

  async function bevestig() {
    if (!user) return;
    setBezig(true);
    try {
      const volledig = Object.fromEntries(regels.map((r) => [r.id, keuze(r.id)]));
      const r = await werkVoorraadBij({ userId: user.id, regels, keuzes: volledig });
      if (!r) return;
      const samen = aftrekSamenvatting(r.plan);
      vernieuw();
      if (!samen.length) {
        toast(t("Er is niets veranderd in je voorraad."));
        return;
      }
      void meet("kringloop.opgebruikt", undefined, { aantal: samen.length, bevestigd: true });
      const tekst = `${t("Voorraad bijgewerkt")}: ${samen.join(", ")}`;
      const eenmaal = eenKeer(r.herstel, () => {
        setTeruggezet(true);
        vernieuw();
      });
      setGedaan({ tekst, herstel: eenmaal });
      toast.success(tekst, {
        duration: 8000,
        action: { label: "Ongedaan maken", onClick: () => void eenmaal() },
      });
    } catch (fout) {
      toast.error(
        fout instanceof HalfGelukt
          ? t("Je voorraad is maar gedeeltelijk bijgewerkt. Kijk ze even na.")
          : t("Je voorraad is niet bijgewerkt. Er is niets veranderd."),
      );
    } finally {
      setBezig(false);
    }
  }

  return (
    <section className="paneel p-5" aria-labelledby="voorraad-klaar-titel">
      <h2 id="voorraad-klaar-titel" className="text-lg font-semibold">
        {t("Voorraad bijwerken?")}
      </h2>
      {gedaan ? (
        <div className="mt-2 space-y-3" role="status">
          <p className="text-base">
            {teruggezet ? t("Je voorraad staat terug zoals ervoor.") : gedaan.tekst}
          </p>
          {!teruggezet ? (
            <Button
              variant="outline"
              onClick={() => void gedaan.herstel()}
              className="w-full sm:w-auto"
            >
              <Undo2 className="size-5" aria-hidden />
              {t("Ongedaan maken")}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-base text-muted-foreground">
            {t(
              "Foodlo rekende uit wat je gebruikte. Vink aan wat klopt; er gaat pas iets af als je bevestigt.",
            )}
          </p>
          <ul className="mt-3 space-y-3" aria-label={t("Gebruikt uit je voorraad")}>
            {regels.map((r) => {
              const k = keuze(r.id);
              const vinkId = `aftrek-${r.id}`;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border p-3"
                  data-aftrek={r.naam}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={vinkId}
                      type="checkbox"
                      checked={k.aan}
                      onChange={(e) => zet(r.id, { aan: e.target.checked })}
                      className="mt-1 size-6 shrink-0 accent-[var(--primary)]"
                    />
                    <label htmlFor={vinkId} className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">{r.naam}</span>
                      <span className="block text-base text-muted-foreground">
                        {t("In huis")}: {maatTekst(r.huidig, r.eenheid)}
                        {r.gebruikt != null
                          ? ` · ${t("gebruikt")}: ${maatTekst(r.gebruikt, r.eenheid)}`
                          : ""}
                      </span>
                    </label>
                  </div>
                  {r.waarom ? (
                    <p className="mt-2 text-base text-[var(--honing-foreground)]">{t(r.waarom)}</p>
                  ) : null}
                  {k.aan ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-base">
                        <span>{t("Gebruikt")}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          disabled={!!k.op}
                          value={k.gebruikt == null ? "" : String(k.gebruikt)}
                          aria-label={`${t("Gebruikt")}: ${r.naam}${r.eenheid ? ` (${r.eenheid})` : ""}`}
                          onChange={(e) => {
                            const w = e.target.value.replace(",", ".");
                            const n = Number(w);
                            zet(r.id, { gebruikt: w === "" || !Number.isFinite(n) ? null : n });
                          }}
                          className="h-12 w-28 rounded-xl border border-input bg-background px-3 text-base"
                        />
                        {r.eenheid ? <span>{r.eenheid}</span> : null}
                      </label>
                      <button
                        type="button"
                        aria-pressed={!!k.op}
                        onClick={() => zet(r.id, { op: !k.op })}
                        className={pil(!!k.op)}
                      >
                        {t("Helemaal op")}
                      </button>
                    </div>
                  ) : null}
                  {k.aan && !k.op && r.huidig != null && k.gebruikt != null && k.gebruikt > 0 ? (
                    <p className="mt-2 text-base text-muted-foreground">
                      {r.huidig - k.gebruikt <= 0
                        ? t("Daarna is het op.")
                        : `${t("Daarna nog")} ${getalTekst(r.huidig - k.gebruikt)}${r.eenheid ? ` ${r.eenheid}` : ""}.`}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button
            variant="outline"
            onClick={() => void bevestig()}
            disabled={bezig || aantalAan === 0}
            className="mt-4 w-full"
          >
            {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {aantalAan === 1
              ? t("Haal 1 product uit je voorraad")
              : `${t("Haal")} ${aantalAan} ${t("producten uit je voorraad")}`}
          </Button>
        </>
      )}
    </section>
  );
}

/** Herstel dat maar één keer werkt (knop op het scherm én in de melding). */
function eenKeer(herstel: Herstel, daarna: () => void): Herstel {
  let gebruikt = false;
  return async () => {
    if (gebruikt) return;
    gebruikt = true;
    try {
      await herstel();
      toast("Teruggezet");
    } catch {
      toast.error("Terugzetten lukte niet helemaal. Kijk je voorraad even na.");
    } finally {
      daarna();
    }
  };
}
