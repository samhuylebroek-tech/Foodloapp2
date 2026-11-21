/**
 * Fase 1 — veiligheid overal gelijk: hoe Foodlo toont dat een gerecht botst met iemand die
 * meeëet. Eén vorm voor Vandaag, Week, recept, kookstand en lijst.
 *
 * - Hard (niet geschikt): terracotta vlak met schild, doorlopende rand, "Niet geschikt voor …".
 * - Zacht (liever niet): honingkleurig vlak met info-teken, gestippelde rand, "Liever niet voor …".
 * - De reden staat er alleen als het lid die deelt (zie `magRedenZien`).
 * - Acties: vervanger zoeken, ander gerecht, "Gust eet niet mee" (met ongedaan maken).
 */
import { useState, type ReactNode } from "react";
import { Check, Info, Repeat, Search, ShieldAlert, UserMinus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HuishoudenLid } from "@/lib/gezin-veiligheid";
import { wisselEter, zonderEter } from "@/lib/maaltijd-eters";
import {
  ingredientBotsing,
  kookWaarschuwingen,
  namenLijst,
  redenRegel,
  type MaaltijdOordeel,
} from "@/lib/voorstel-eters";
import { useEtersOordelen, useMaaltijdEters, type MaaltijdEters } from "@/hooks/useMaaltijdEters";

type Toon = "licht" | "inkt";

/** Het oordeel als vlak. Niets bij "ok". */
export function OordeelMelding({
  oordeel,
  children,
  className,
  testId = "eters-oordeel",
}: {
  oordeel: MaaltijdOordeel | null | undefined;
  children?: ReactNode;
  className?: string | undefined;
  testId?: string;
}) {
  if (!oordeel || oordeel.niveau === "ok") return null;
  const hard = oordeel.niveau === "hard";
  const redenen = (hard ? oordeel.hard : oordeel.zacht).filter((o) => o.reden);
  // Naast een harde botsing ook de zachte noemen, maar klein.
  const ookZacht = hard ? oordeel.zacht : [];
  return (
    <div
      role="note"
      aria-label={hard ? "Niet geschikt voor wie meeëet" : "Liever niet voor wie meeëet"}
      data-testid={testId}
      data-niveau={oordeel.niveau}
      className={cn(
        "rounded-2xl border-l-4 px-3 py-2.5 text-foreground",
        hard
          ? "border-terracotta bg-terracotta-zacht"
          : "border-dashed border-honing bg-honing-zacht",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-base font-bold leading-snug">
        {hard ? (
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-terracotta" aria-hidden />
        ) : (
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 break-words">{oordeel.titel}</span>
      </p>
      {redenen.length ? (
        <ul className="mt-1 space-y-0.5 pl-7 text-[0.95rem] leading-snug">
          {redenen.map((o) => (
            <li key={o.lidId} className="break-words">
              {redenRegel(o)}
            </li>
          ))}
        </ul>
      ) : null}
      {ookZacht.length ? (
        <p className="mt-1 pl-7 text-[0.95rem] leading-snug break-words">
          Liever niet: {ookZacht.map(redenRegel).join("; ")}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Klein label op een compacte kaart (weekraster): "Niet voor Gust" / "Liever niet: Jan". */
export function OordeelLabel({ oordeel }: { oordeel: MaaltijdOordeel | null | undefined }) {
  if (!oordeel || oordeel.niveau === "ok") return null;
  const hard = oordeel.niveau === "hard";
  const namen = namenLijst((hard ? oordeel.hard : oordeel.zacht).map((o) => o.naam));
  return (
    <span
      data-testid="eters-label"
      data-niveau={oordeel.niveau}
      className={cn(
        "inline-flex max-w-full items-start gap-1 rounded-lg px-2 py-0.5 text-[0.9rem] font-semibold leading-snug",
        hard
          ? "bg-terracotta-zacht text-foreground ring-1 ring-terracotta"
          : "border border-dashed border-honing bg-honing-zacht text-honing-foreground",
      )}
    >
      {hard ? (
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-terracotta" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 break-words">
        {hard ? `Niet voor ${namen}` : `Liever niet: ${namen}`}
      </span>
    </span>
  );
}

const knop = (toon: Toon) =>
  cn(
    "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full px-4 text-base font-semibold leading-tight",
    toon === "inkt"
      ? "border-2 border-foreground/30 bg-card text-foreground hover:bg-muted"
      : "border-2 border-border bg-card text-foreground hover:bg-muted",
  );

/** Keuze wie meeëet: één knop per lid (aan/uit). */
export function EtersKeuze({
  leden,
  gekozen,
  onWissel,
  label,
  toon = "licht",
}: {
  leden: readonly Pick<HuishoudenLid, "id" | "naam">[];
  gekozen: readonly string[];
  onWissel: (id: string) => void;
  label: string;
  toon?: Toon;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {leden.map((l) => {
        const aan = gekozen.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={aan}
            onClick={() => onWissel(l.id)}
            className={
              aan
                ? cn(
                    "inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold",
                    toon === "inkt"
                      ? "bg-honing text-op-honing"
                      : "bg-primary text-primary-foreground",
                  )
                : cn(
                    "inline-flex min-h-12 items-center rounded-full px-4 text-base font-semibold",
                    toon === "inkt"
                      ? "border-2 border-inkt-foreground/40 text-inkt-foreground"
                      : "bg-card ring-1 ring-border hover:bg-muted",
                  )
            }
          >
            {aan ? <Check className="size-4" aria-hidden /> : null}
            {l.naam}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Veiligheid bij een geplande maaltijd: het oordeel, de acties bij een botsing en "Wie eet mee?".
 * `onVervanger` krijgt het eerste ingrediënt dat botst (alleen als de reden gedeeld is).
 */
export function MaaltijdVeiligheid({
  planId,
  titel,
  oordeel,
  mee,
  toon = "licht",
  onAnder,
  onVervanger,
  className,
  standaardOpen = false,
}: {
  planId: string;
  titel: string;
  standaardOpen?: boolean;
  oordeel: MaaltijdOordeel | null | undefined;
  mee: MaaltijdEters;
  toon?: Toon;
  onAnder?: (() => void) | undefined;
  onVervanger?: ((ingredient: string) => void) | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(standaardOpen);
  if (!mee.leden.length) return null;
  const eters = mee.etersVan(planId);
  const ids = eters.map((e) => e.id);
  const botsers = oordeel ? [...oordeel.hard, ...oordeel.zacht] : [];
  const ingredient = botsers
    .flatMap((o) => o.ingredienten ?? [])
    .find((i) => oordeel && ingredientBotsing(i, oordeel));
  const zetZonder = (id: string, naam: string) =>
    void mee.zet(planId, zonderEter(ids, id), `${naam} eet niet mee met ${titel}`);
  return (
    <div className={cn("space-y-2", className)} data-testid="maaltijd-veiligheid">
      <OordeelMelding oordeel={oordeel}>
        <div className="mt-2 flex flex-wrap gap-2 pl-7">
          {ingredient && onVervanger ? (
            <button type="button" className={knop(toon)} onClick={() => onVervanger(ingredient)}>
              <Search className="size-5 shrink-0" aria-hidden />
              Vervanger zoeken
            </button>
          ) : null}
          {onAnder ? (
            <button type="button" className={knop(toon)} onClick={onAnder}>
              <Repeat className="size-5 shrink-0" aria-hidden />
              Ander gerecht kiezen
            </button>
          ) : null}
          {eters.length > 1
            ? botsers.map((o) => (
                <button
                  key={o.lidId}
                  type="button"
                  className={knop(toon)}
                  onClick={() => zetZonder(o.lidId, o.naam)}
                >
                  <UserMinus className="size-5 shrink-0" aria-hidden />
                  {o.naam} eet niet mee
                </button>
              ))
            : null}
        </div>
      </OordeelMelding>
      <div>
        <p
          className={cn(
            "flex items-start gap-2 text-[0.95rem] leading-snug",
            toon === "inkt" ? "text-inkt-zacht" : "text-muted-foreground",
          )}
          data-testid="eet-mee"
        >
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            Eet mee: {namenLijst(eters.map((e) => e.naam))}
          </span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "mt-1 inline-flex min-h-11 items-center text-[0.95rem] font-semibold underline underline-offset-4",
            toon === "inkt" ? "text-inkt-foreground" : "text-primary",
          )}
        >
          {open ? "Klaar" : "Wie eet mee?"}
        </button>
        {open ? (
          <div className="mt-1">
            <EtersKeuze
              leden={mee.leden}
              gekozen={ids}
              toon={toon}
              label={`Wie eet mee: ${titel}`}
              onWissel={(id) => {
                const volgende = wisselEter(ids, id);
                if (volgende.length === ids.length) return; // de laatste blijft
                const naam = mee.leden.find((l) => l.id === id)?.naam ?? "";
                void mee.zet(
                  planId,
                  volgende,
                  volgende.includes(id) ? `${naam} eet mee` : `${naam} eet niet mee`,
                );
              }}
            />
            {mee.opslag === "toestel" ? (
              <p
                className={cn(
                  "mt-1 text-[0.95rem]",
                  toon === "inkt" ? "text-inkt-zacht" : "text-muted-foreground",
                )}
              >
                Bewaard op dit toestel.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Kookstand, bij de start: "Let op: bevat mogelijk eieren — Lotte eet mee". Met de acties
 * "Vervanger zoeken" (de kookassistent) en "Lotte eet niet mee" (alleen bij een geplande maaltijd).
 */
export function KookWaarschuwing({
  oordeel,
  onVervanger,
  onZonder,
}: {
  oordeel: MaaltijdOordeel | null | undefined;
  onVervanger?: ((ingredient: string) => void) | undefined;
  onZonder?: ((lidId: string, naam: string) => void) | undefined;
}) {
  if (!oordeel || oordeel.niveau === "ok") return null;
  const regels = kookWaarschuwingen(oordeel);
  const hard = oordeel.niveau === "hard";
  const botsers = [...oordeel.hard, ...oordeel.zacht];
  const ingredient = botsers
    .flatMap((o) => o.ingredienten ?? [])
    .find((i) => ingredientBotsing(i, oordeel));
  return (
    <section
      role="alert"
      aria-label="Let op voor wie meeëet"
      data-testid="kook-waarschuwing"
      data-niveau={oordeel.niveau}
      className={cn(
        "rounded-2xl border-l-4 p-4 text-foreground",
        hard
          ? "border-terracotta bg-terracotta-zacht"
          : "border-dashed border-honing bg-honing-zacht",
      )}
    >
      <ul className="space-y-1.5">
        {regels.map((r) => (
          <li key={r.tekst} className="flex items-start gap-2 text-lg font-semibold leading-snug">
            {r.ernst === "hard" ? (
              <ShieldAlert className="mt-1 size-5 shrink-0 text-terracotta" aria-hidden />
            ) : (
              <Info className="mt-1 size-5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 break-words">{r.tekst}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {ingredient && onVervanger ? (
          <button type="button" className={knop("licht")} onClick={() => onVervanger(ingredient)}>
            <Search className="size-5 shrink-0" aria-hidden />
            Vervanger zoeken
          </button>
        ) : null}
        {onZonder
          ? botsers.map((o) => (
              <button
                key={o.lidId}
                type="button"
                className={knop("licht")}
                onClick={() => onZonder(o.lidId, o.naam)}
              >
                <UserMinus className="size-5 shrink-0" aria-hidden />
                {o.naam} eet niet mee
              </button>
            ))
          : null}
      </div>
    </section>
  );
}

/** Kleine markering naast een ingrediënt dat botst (alleen met gedeelde reden). */
export function IngredientMarkering({
  ingredient,
  oordeel,
}: {
  ingredient: string;
  oordeel: MaaltijdOordeel | null | undefined;
}) {
  const b = oordeel ? ingredientBotsing(ingredient, oordeel) : null;
  if (!b) return null;
  return (
    <span
      data-testid="ingredient-botsing"
      data-niveau={b.ernst}
      className={cn(
        "mt-1 flex w-fit max-w-full items-start gap-1 rounded-lg px-2 py-0.5 text-[0.95rem] font-semibold leading-snug",
        b.ernst === "hard"
          ? "bg-terracotta-zacht text-foreground ring-1 ring-terracotta"
          : "border border-dashed border-honing bg-honing-zacht text-honing-foreground",
      )}
    >
      {b.ernst === "hard" ? (
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-terracotta" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 break-words">{b.tekst}</span>
    </span>
  );
}

/**
 * Bij het nakijken van een nieuw of geïmporteerd recept: past het voor het huishouden?
 * (Iedereen telt mee, ook jij; de redenen alleen als ze gedeeld zijn.)
 */
export function NieuwReceptControle({
  titel,
  tags,
  ingredienten,
  className,
}: {
  titel: string;
  tags?: string[];
  ingredienten: readonly string[];
  className?: string | undefined;
}) {
  const mee = useMaaltijdEters([]);
  const oordelen = useEtersOordelen(
    ingredienten.length || titel.trim()
      ? [
          {
            sleutel: "nieuw",
            recept: { id: "nieuw", title: titel, tags: tags ?? [] },
            eters: mee.leden,
            ingredienten,
          },
        ]
      : [],
    mee,
  );
  return (
    <OordeelMelding className={className} oordeel={oordelen["nieuw"]}>
      <p className="mt-1 pl-7 text-[0.95rem] leading-snug">
        Je kan het recept toch bewaren. Bij het inplannen kies je wie meeëet.
      </p>
    </OordeelMelding>
  );
}
