import { useMemo, useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import { useT } from "@/lib/voorkeuren";
import {
  MICRO_META,
  MICRO_MINERALEN,
  MICRO_VITAMINES,
  RI,
  berekenVoeding,
  rond,
  toonGetal,
  zoutGram,
  type MicroSleutel,
  type VoedingIngredient,
} from "@/lib/voeding";

type Props = {
  ingredienten: VoedingIngredient[];
  porties: number;
};

function Rij({
  label,
  waarde,
  eenheid,
  percent,
  sterk,
}: {
  label: string;
  waarde: string;
  eenheid: string;
  percent?: number | null;
  sterk?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className={sterk ? "text-lg font-semibold" : "text-lg"}>{label}</span>
      <span className="shrink-0 text-right">
        <span className={sterk ? "text-lg font-semibold" : "text-lg"}>
          {waarde} {eenheid}
        </span>
        {percent != null && (
          <span className="ml-2 text-base text-muted-foreground">{percent}% RI</span>
        )}
      </span>
    </div>
  );
}

export function Voedingswaarden({ ingredienten, porties }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [microOpen, setMicroOpen] = useState(false);

  const res = useMemo(() => berekenVoeding(ingredienten, porties), [ingredienten, porties]);
  const v = res.perPortie;

  const micros = useMemo(() => {
    if (!v) return [] as { sleutel: MicroSleutel; waarde: number; percent: number }[];
    return [...MICRO_VITAMINES, ...MICRO_MINERALEN]
      .map((sleutel) => {
        const waarde = v.micro[sleutel] ?? 0;
        const percent = Math.round((waarde / MICRO_META[sleutel].ri) * 100);
        return { sleutel, waarde, percent };
      })
      .filter((r) => r.waarde > 0 && r.percent >= 5);
  }, [v]);

  const pct = (waarde: number, ri: number) => Math.round((waarde / ri) * 100);

  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">{t("Voedingswaarden")}</h2>
          {v ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
              <Flame className="size-4 shrink-0 text-primary" aria-hidden />
              <span>{Math.round(v.kcal)} kcal</span>
              <span aria-hidden>·</span>
              <span>
                {toonGetal(v.eiwit)} g {t("eiwit")}
              </span>
              <span aria-hidden>·</span>
              <span>
                {toonGetal(v.koolhydraten)} g {t("koolhydraten")}
              </span>
              <span aria-hidden>·</span>
              <span>
                {toonGetal(v.vet)} g {t("vet")}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-base text-muted-foreground">
              {t("Te weinig gegevens over de hoeveelheden om dit te berekenen.")}
            </p>
          )}
        </div>

        {v && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="inline-flex min-h-14 shrink-0 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold"
          >
            {open ? t("Verbergen") : t("Bekijken")}
            <ChevronDown
              className={open ? "size-5 rotate-180 transition-transform" : "size-5 transition-transform"}
              aria-hidden
            />
          </button>
        )}
      </div>

      {v && open && (
        <div className="mt-4">
          <p className="text-base font-semibold text-muted-foreground">
            {t("Per portie")} · {porties} {porties === 1 ? t("portie") : t("porties")}
          </p>

          <div className="mt-2">
            <Rij
              label={t("Calorieën")}
              waarde={String(Math.round(v.kcal))}
              eenheid="kcal"
              percent={pct(v.kcal, RI.kcal)}
              sterk
            />
            <Rij label={t("Eiwitten")} waarde={toonGetal(v.eiwit)} eenheid="g" percent={pct(v.eiwit, RI.eiwit)} />
            <Rij
              label={t("Koolhydraten")}
              waarde={toonGetal(v.koolhydraten)}
              eenheid="g"
              percent={pct(v.koolhydraten, RI.koolhydraten)}
            />
            <Rij label={t("waarvan suikers")} waarde={toonGetal(v.suikers)} eenheid="g" percent={pct(v.suikers, RI.suikers)} />
            <Rij label={t("Vetten")} waarde={toonGetal(v.vet)} eenheid="g" percent={pct(v.vet, RI.vet)} />
            <Rij
              label={t("waarvan verzadigd")}
              waarde={toonGetal(v.verzadigd)}
              eenheid="g"
              percent={pct(v.verzadigd, RI.verzadigd)}
            />
            <Rij label={t("Vezels")} waarde={toonGetal(v.vezels)} eenheid="g" percent={pct(v.vezels, RI.vezels)} />
            <Rij
              label={t("Zout")}
              waarde={toonGetal(zoutGram(v.natrium))}
              eenheid="g"
              percent={pct(zoutGram(v.natrium), RI.zout)}
            />
          </div>

          {micros.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setMicroOpen(!microOpen)}
                aria-expanded={microOpen}
                className="mt-4 inline-flex min-h-14 w-full items-center justify-between gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold"
              >
                {t("Vitamines & mineralen")}
                <ChevronDown
                  className={microOpen ? "size-5 rotate-180 transition-transform" : "size-5 transition-transform"}
                  aria-hidden
                />
              </button>

              {microOpen && (
                <div className="mt-2">
                  {micros.map((r) => (
                    <Rij
                      key={r.sleutel}
                      label={t(MICRO_META[r.sleutel].label)}
                      waarde={toonGetal(rond(r.waarde, 2))}
                      eenheid={MICRO_META[r.sleutel].eenheid}
                      percent={r.percent}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {res.geschat && (
            <p className="mt-4 rounded-2xl bg-secondary p-3 text-base text-muted-foreground">
              {t("Geschat: van sommige ingrediënten kennen we de hoeveelheid of de gegevens niet.")}{" "}
              {t("Meegeteld")}: {res.geteld}/{res.totaal}.
            </p>
          )}

          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {t(
              "Deze waarden zijn schattingen op basis van de ingrediënten en kunnen verschillen per merk, product en bereiding. Ze zijn enkel informatief en geen medisch of voedingsadvies. % RI = percentage van de dagelijkse referentie-inname voor een gemiddelde volwassene (2000 kcal).",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
