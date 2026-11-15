/**
 * Niets gepland voor vandaag? Drie voorstellen, elk met 1 à 2 redenen (Foodloapp Intelligence I-1).
 * Eerst wat je (bijna) helemaal in huis hebt; is er niets in huis, dan ideeën uit je recepten.
 * Eén tik: gepland voor vanavond + wat ontbreekt op de lijst. "Niet nu" verbergt een voorstel
 * 7 dagen. Allergieën en dieet komen van dit toestel en verlaten het niet. Ongedaan maken kan altijd.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, Info, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { RecipePhoto } from "@/components/RecipePhoto";
import { useAuth } from "@/hooks/useAuth";
import { meldMetHerstel } from "@/hooks/useAanvulling";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { useWeer } from "@/hooks/useWeer";
import { bepaalContext } from "@/lib/intelligentie/context";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { herstelNietNu, nietNuLijst, zetNietNu } from "@/lib/intelligentie/niet-nu";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { beveelAan, type Aanbeveling } from "@/lib/intelligentie/voorstel";
import { dagenTekst, type OudInHuis } from "@/lib/intelligentie/gebruik-eerst";
import { zitInVoorraad } from "@/lib/voorraad-match";
import { leesKennismaking } from "@/lib/kennismaking";
import { HalfGelukt, kookVanavond, planVervang, wijzigMenu } from "@/lib/kringloop-db";
import { meet } from "@/lib/meten";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";
import { useVoorstelEters } from "@/hooks/useVoorstelEters";
import {
  beoordeel,
  etiketVoorEters,
  oordelenVoor,
  veiligVoorEters,
  voorWieTekst,
} from "@/lib/voorstel-eters";

type ReceptKort = {
  id: string;
  title: string;
  servings: number | null;
  image_url: string | null;
  category: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  tags?: string[] | null;
};

const minutenVan = (r: ReceptKort) => (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

/**
 * `vervang`: ronde 3, "Iets anders vanavond". Het gekozen voorstel vervangt de geplande maaltijd
 * (zelfde weg als vervangen in Week: lijst past mee aan, met ongedaan maken). Het huidige gerecht
 * staat niet tussen de voorstellen.
 */
export function VanavondVoorstellen({
  recepten: alleRecepten,
  vervang,
}: {
  recepten: ReceptKort[];
  vervang?: { planId: string; huidigReceptId: string; huidigeTitel: string };
}) {
  const zonder = vervang?.huidigReceptId;
  const recepten = useMemo(
    () => (zonder ? alleRecepten.filter((r) => r.id !== zonder) : alleRecepten),
    [alleRecepten, zonder],
  );
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = useT();
  const { momenten, weekmenu } = useVoorkeuren();
  const [bezig, setBezig] = useState<string | null>(null);
  const [nietNu, setNietNu] = useState<string[]>([]);
  // "Slimme voorstellen" uit: niets voorstellen en ook niets extra opvragen.
  const [slim] = useSlimmeVoorstellen();
  // Pas lezen als de gebruiker bekend is (na het aanmelden en niet tijdens server-rendering).
  useEffect(() => setNietNu(nietNuLijst(user?.id)), [user?.id]);
  const ids = recepten.map((r) => r.id);

  const { data: bronnen } = useVoorstelBronnen(ids, slim);
  // Werkstroom F: het weer stuurt zacht bij (alleen als het aan staat en er een bron is).
  const { weer } = useWeer();

  // Stap 1: alle kandidaten (hooguit 12) volgens jouw eigen regels.
  const alle = useMemo(() => {
    if (!bronnen) return [] as Aanbeveling[];
    const nu = new Date();
    const context = bepaalContext(nu, weer ? { temp: weer.temp, regen: weer.regen } : null);
    const dag = weekmenu.perDag?.[String(context.weekdag)];
    const kennis = leesKennismaking(user?.id);
    const minuten = Object.fromEntries(recepten.map((r) => [r.id, minutenVan(r)]));
    return beveelAan({
      kandidaten: recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category,
        tags: r.tags ?? [],
        ingredienten: bronnen.ingredienten[r.id] ?? [],
      })),
      context,
      voorraad: bronnen.voorraad,
      geschiedenis: vatSamen(bronnen.plan, minuten, context.datum),
      sterren: bronnen.sterren,
      favorieten: bronnen.favorieten,
      voorkeur: {
        maxMinuten: dag?.maxMinuten || weekmenu.maxMinuten || 0,
        soort: dag?.soort ?? null,
        vermijd: weekmenu.vermijd ?? "",
        dieet: kennis.dieet,
      },
      allergieen: kennis.allergieen,
      nietNu,
      oudInHuis: bronnen.oudInHuis,
      onlangsGekocht: bronnen.onlangsGekocht,
      max: 12,
    });
  }, [bronnen, recepten, weekmenu, nietNu, user?.id, weer]);

  // Stap 2: wat niet veilig is voor een mee-eter, stellen we niet voor (werkstroom A).
  // Wie eet mee vanavond? Standaard het hele huishouden; aan te passen voor vandaag.
  const [gekozenEters, setGekozenEters] = useState<string[] | null>(null);
  const [wieOpen, setWieOpen] = useState(false);
  useEffect(() => setGekozenEters(leesVanavondEters(user?.id)), [user?.id]);
  const eters = useVoorstelEters({ gekozen: gekozenEters, receptIds: alle.map((a) => a.id) });
  function wisselEter(id: string) {
    const nu = gekozenEters ?? eters.leden.map((l) => l.id);
    const volgende = nu.includes(id) ? nu.filter((x) => x !== id) : [...nu, id];
    setGekozenEters(volgende);
    bewaarVanavondEters(user?.id, volgende);
  }
  const gerechtVan = (a: Aanbeveling) => ({
    title: a.title,
    tags: recepten.find((r) => r.id === a.id)?.tags ?? [],
    ingredienten: bronnen?.ingredienten[a.id] ?? [],
  });
  const etersTekst = voorWieTekst(eters.eters);

  const { voorstellen, uitHuis, oud, zonderRecept } = useMemo(() => {
    if (!bronnen)
      return {
        voorstellen: [] as Aanbeveling[],
        uitHuis: true,
        oud: [] as OudInHuis[],
        zonderRecept: [] as OudInHuis[],
      };
    // Past niets voor iedereen, dan tonen we ze toch, met "Niet geschikt voor …" erbij.
    const gerecht = (a: Aanbeveling) => ({
      title: a.title,
      tags: recepten.find((r) => r.id === a.id)?.tags ?? [],
      ingredienten: bronnen.ingredienten[a.id] ?? [],
    });
    const { veilig } = veiligVoorEters(alle, gerecht, eters);
    const kandidaten = veilig.length ? veilig : alle;
    // Gebruik eerst (alleen als je je voorraad bijhoudt): gerechten die het opmaken, komen eerst.
    const oud = bronnen.oudInHuis.slice(0, 3);
    const maaktOp = (a: Aanbeveling) =>
      oud.some((o) => a.aanwezig.some((n) => zitInVoorraad(n, [o.naam])));
    const zonderRecept = oud.filter(
      (o) => !kandidaten.some((a) => a.aanwezig.some((n) => zitInVoorraad(n, [o.naam]))),
    );
    const inHuis = kandidaten
      .filter((a) => a.aanwezig.length > 0)
      .sort((a, b) => Number(maaktOp(b)) - Number(maaktOp(a)));
    const basis = inHuis.length
      ? { voorstellen: inHuis.slice(0, 3), uitHuis: true }
      : { voorstellen: kandidaten.slice(0, 3), uitHuis: false };
    return { ...basis, oud, zonderRecept };
  }, [bronnen, alle, eters, recepten]);

  if (!slim || (!voorstellen.length && !oud?.length)) return null;

  async function kies(id: string) {
    const recept = recepten.find((r) => r.id === id);
    if (!user || !recept || bezig) return;
    setBezig(id);
    try {
      const moment = momenten.includes("avondeten")
        ? "avondeten"
        : (momenten.at(-1) ?? "avondeten");
      if (vervang) {
        const v = await wijzigMenu(user.id, planVervang(vervang.planId, recept.id));
        void meet("kringloop.vanavond", undefined, {
          ontbreekt: v.effect.erbij,
          reden: voorstellen.find((x) => x.id === id)?.redenen[0]?.soort ?? null,
        });
        const ververs = () => {
          void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
          void qc.invalidateQueries({ queryKey: ["home-week"] });
          void qc.invalidateQueries({ queryKey: ["aanvulling"] });
          void qc.invalidateQueries({ queryKey: ["shopping"] });
        };
        ververs();
        meldMetHerstel(
          `${recept.title} ${t("in plaats van")} ${vervang.huidigeTitel}`,
          v.herstel,
          ververs,
        );
        return;
      }
      const r = await kookVanavond({ userId: user.id, recept, moment });
      if (r.alGepland) {
        toast(`${recept.title} staat al op vanavond`);
        return;
      }
      void meet("kringloop.vanavond", undefined, {
        ontbreekt: r.ontbreekt,
        reden: voorstellen.find((v) => v.id === id)?.redenen[0]?.soort ?? null,
      });
      const vernieuw = () => {
        void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
        void qc.invalidateQueries({ queryKey: ["home-week"] });
        void qc.invalidateQueries({ queryKey: ["aanvulling"] });
        void qc.invalidateQueries({ queryKey: ["shopping"] });
      };
      vernieuw();
      meldMetHerstel(
        r.ontbreekt
          ? `${recept.title} staat op vanavond · ${r.ontbreekt} op je lijst`
          : `${recept.title} staat op vanavond · je hebt alles`,
        r.herstel,
        vernieuw,
      );
    } catch (fout) {
      toast.error(
        fout instanceof HalfGelukt
          ? "Dat lukte maar half. Kijk je weekmenu en lijst even na."
          : "Dat lukte niet. Er is niets veranderd; probeer het opnieuw.",
      );
    } finally {
      setBezig(null);
    }
  }

  function nietNuVoor(v: Aanbeveling) {
    if (!user) return;
    zetNietNu(user.id, v.id);
    setNietNu(nietNuLijst(user.id));
    void meet("voorstel.niet_nu", undefined, { reden: v.redenen[0]?.soort ?? null });
    toast(t("Je ziet dit voorstel een week niet."), {
      duration: 8000,
      action: {
        label: t("Ongedaan maken"),
        onClick: () => {
          herstelNietNu(user.id, v.id);
          setNietNu(nietNuLijst(user.id));
        },
      },
    });
  }

  const kop = vervang
    ? t("Liever iets anders?")
    : uitHuis
      ? t("Met wat je in huis hebt")
      : t("Ideeën voor vanavond");

  return (
    <section aria-labelledby="vanavond-kop" className="mt-6">
      <h3 id="vanavond-kop" className="text-base font-semibold text-inkt-zacht">
        {kop}
      </h3>
      {oud.length ? (
        <div
          role="note"
          aria-label={t("Gebruik eerst")}
          className="mt-2 text-[0.95rem] text-inkt-zacht"
        >
          <p className="break-words">
            <span className="font-semibold text-inkt-foreground">{t("Gebruik eerst")}:</span>{" "}
            {oud.map((o) => `${o.naam} (${dagenTekst(o.dagen)})`).join(", ")}.
          </p>
          {zonderRecept[0] ? (
            <Link
              to="/inspiratie"
              search={{ zoek: zonderRecept[0].naam }}
              className="mt-1 inline-flex min-h-11 items-center font-semibold text-inkt-foreground underline underline-offset-4"
            >
              {t("Zoek een idee met")} {zonderRecept[0].naam}
            </Link>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {voorstellen.map((v) => {
          const recept = recepten.find((r) => r.id === v.id)!;
          const ontbreekt = v.ontbreekt.length;
          const totaal = v.aanwezig.length + ontbreekt;
          return (
            <li key={v.id} className="rounded-2xl bg-white/10 p-2 pr-3">
              <span className="flex items-start gap-3">
                <RecipePhoto
                  path={recept.image_url}
                  alt=""
                  recept={recept}
                  className="size-14 shrink-0 rounded-xl"
                  icoonClassName="size-6"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-lg leading-snug font-semibold break-words text-inkt-foreground">
                    {v.title}
                  </span>
                  <span className="mt-0.5 block text-[0.95rem] leading-snug break-words text-inkt-zacht">
                    {v.redenen.map((r) => r.tekst).join(" · ")}
                  </span>
                  {(() => {
                    const oordelen = oordelenVoor({ ...gerechtVan(v), id: v.id }, eters);
                    const etiket = etiketVoorEters(oordelen);
                    if (!etiket) return null;
                    // Fase 1: hard (niet geschikt) en zacht (liever niet) zien er anders uit.
                    const hard = beoordeel(oordelen).niveau === "hard";
                    return (
                      <span
                        role="note"
                        data-testid={hard ? "niet-geschikt" : "liever-niet"}
                        className={
                          hard
                            ? "mt-1 flex items-start gap-1.5 rounded-lg border-l-4 border-terracotta bg-terracotta-zacht px-2 py-1 text-[0.95rem] font-semibold break-words text-foreground"
                            : "mt-1 flex items-start gap-1.5 rounded-lg border border-dashed border-honing bg-honing-zacht px-2 py-1 text-[0.95rem] font-semibold break-words text-honing-foreground"
                        }
                      >
                        {hard ? (
                          <ShieldAlert
                            className="mt-0.5 size-4 shrink-0 text-terracotta"
                            aria-hidden
                          />
                        ) : (
                          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0">{etiket}</span>
                      </span>
                    );
                  })()}
                  {totaal > 0 && (
                    <span className="mt-1 flex flex-wrap items-center gap-1 text-[0.95rem] text-inkt-zacht">
                      {ontbreekt === 0 ? (
                        <>
                          <Check className="size-4" aria-hidden /> {t("Alles in huis")}
                        </>
                      ) : (
                        `${ontbreekt} ${t("ontbreekt")}`
                      )}
                    </span>
                  )}
                </span>
              </span>
              {/* Knoppen onder de tekst over de volle breedte: past ook op 320 px met grote tekst. */}
              <span className="mt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => nietNuVoor(v)}
                  disabled={!!bezig}
                  aria-label={`${t("Niet nu")}: ${v.title}`}
                  className="inline-flex min-h-11 max-w-full items-center rounded-full border border-inkt-foreground/40 px-3 text-base font-semibold text-inkt-foreground hover:bg-white/10 disabled:opacity-60"
                >
                  {t("Niet nu")}
                </button>
                <button
                  type="button"
                  onClick={() => void kies(v.id)}
                  disabled={!!bezig}
                  aria-label={`Kook ${v.title} vanavond`}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-honing px-4 text-base font-semibold text-op-honing disabled:opacity-60"
                >
                  {bezig === v.id ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <ChefHat className="size-5" aria-hidden />
                  )}
                  Vanavond
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {eters.leden.length ? (
        <div className="mt-2">
          <p className="text-[0.95rem] break-words text-inkt-zacht" data-testid="voor-wie">
            {etersTekst ? `${etersTekst}.` : t("Niemand van je gezin eet mee.")}
          </p>
          <button
            type="button"
            aria-expanded={wieOpen}
            onClick={() => setWieOpen((o) => !o)}
            className="mt-1 inline-flex min-h-11 items-center text-[0.95rem] font-semibold text-inkt-foreground underline underline-offset-4"
          >
            {t("Wie eet mee vanavond?")}
          </button>
          {wieOpen ? (
            <div
              role="group"
              aria-label={t("Wie eet mee vanavond?")}
              className="mt-1 flex flex-wrap gap-2"
            >
              {eters.leden.map((l) => {
                const aan = eters.eters.some((e) => e.id === l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={aan}
                    onClick={() => wisselEter(l.id)}
                    className={
                      aan
                        ? "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-honing px-4 text-base font-semibold text-op-honing"
                        : "inline-flex min-h-11 items-center rounded-full border border-inkt-foreground/40 px-4 text-base font-semibold text-inkt-foreground"
                    }
                  >
                    {aan ? <Check className="size-4" aria-hidden /> : null}
                    {l.naam}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <Link
        to="/hulp/$slug"
        params={{ slug: "voorstellen" }}
        className="mt-2 inline-flex min-h-11 items-center text-[0.95rem] text-inkt-zacht underline underline-offset-4"
      >
        {t("Waarom zie ik dit?")}
      </Link>
    </section>
  );
}

/** Keuze "wie eet mee vanavond" geldt alleen voor vandaag, op dit toestel. */
function sleutelEters(userId: string) {
  return `foodlo:vanavond-eters:${userId}`;
}
function leesVanavondEters(userId: string | undefined): string[] | null {
  if (!userId) return null;
  try {
    const ruw = JSON.parse(window.localStorage.getItem(sleutelEters(userId)) ?? "null") as {
      datum?: string;
      ids?: unknown;
    } | null;
    if (ruw?.datum !== new Date().toLocaleDateString("sv-SE") || !Array.isArray(ruw.ids))
      return null;
    return ruw.ids.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}
function bewaarVanavondEters(userId: string | undefined, ids: string[]) {
  if (!userId) return;
  try {
    window.localStorage.setItem(
      sleutelEters(userId),
      JSON.stringify({ datum: new Date().toLocaleDateString("sv-SE"), ids }),
    );
  } catch {
    /* privévenster: dan alleen voor nu */
  }
}
