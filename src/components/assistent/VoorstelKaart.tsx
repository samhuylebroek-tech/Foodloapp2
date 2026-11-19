/**
 * P4 — Eén voorstel van de assistent: wat er verandert (menu, lijst, kost, wie eet mee), met
 * "Doe maar" en "Nee, laat maar". Na "Doe maar": wat er gebeurde en "Ongedaan maken".
 */
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  ShoppingBasket,
  TriangleAlert,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dagNaam, wieTekst, type Voorstel } from "@/lib/assistent/acties";
import { euro } from "@/lib/budget";

export type KaartStand =
  | { soort: "open" }
  | { soort: "bezig" }
  | { soort: "gedaan"; tekst: string; herstellen: boolean }
  | { soort: "teruggezet" }
  | { soort: "nee" }
  | { soort: "fout"; tekst: string };

const MOMENT: Record<string, string> = {
  ontbijt: "ontbijt",
  middageten: "middageten",
  avondeten: "avondeten",
  maaltijd: "eten",
};

function Hoofd({ tekst }: { tekst: string }) {
  return <>{tekst.charAt(0).toUpperCase() + tekst.slice(1)}</>;
}

export function VoorstelKaart({
  id,
  voorstel,
  vandaag,
  stand,
  onJa,
  onNee,
  onOngedaan,
}: {
  id: string;
  voorstel: Voorstel;
  vandaag: string;
  stand: KaartStand;
  onJa: () => void;
  onNee: () => void;
  onOngedaan: () => void;
}) {
  const v = voorstel;
  const titelId = `${id}-titel`;
  const kanUitvoeren = !v.leeg && v.stappen.length > 0;
  const lijstGelijk = !v.lijst.erbij.length && !v.lijst.eraf.length;
  return (
    <section aria-labelledby={titelId} className="paneel space-y-4 p-4 sm:p-5" data-voorstel>
      <h3 id={titelId} className="text-kaarttitel break-words">
        {v.titel}
      </h3>

      {v.leeg ? <p className="text-base">{v.leeg}</p> : null}

      {v.ideeen?.length ? (
        <ul aria-label="Ideeën uit je recepten" className="space-y-2">
          {v.ideeen.map((i) => (
            <li key={i.id}>
              <Link
                to="/recepten/$id"
                params={{ id: i.id }}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-secondary p-3 text-base"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{i.title}</span>
                  <span className="block text-muted-foreground">
                    {i.minuten ? `${i.minuten} min · ` : ""}
                    {i.reden}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {v.menu.length ? (
        <div>
          <h4 className="flex items-center gap-2 text-base font-bold">
            <CalendarDays className="size-5 shrink-0" aria-hidden /> Weekmenu
          </h4>
          <ul aria-label="Wat er verandert in je weekmenu" className="mt-2 space-y-2">
            {v.menu.map((m) => (
              <li
                key={`${m.datum}|${m.moment}|${m.van ?? ""}`}
                className="rounded-2xl bg-secondary p-3 text-base"
                data-dag={m.datum}
              >
                <span className="block font-semibold">
                  <Hoofd tekst={dagNaam(m.datum, vandaag)} />
                  {m.moment !== "avondeten" ? ` · ${MOMENT[m.moment] ?? m.moment}` : ""}
                </span>
                <span className="block break-words">
                  {m.van ? (
                    <span className="text-muted-foreground line-through decoration-1">{m.van}</span>
                  ) : (
                    <span className="text-muted-foreground">Nog niets</span>
                  )}
                  <span aria-hidden> → </span>
                  <span className="sr-only"> wordt </span>
                  {m.naar ? <strong>{m.naar}</strong> : <strong>Niets (niet koken)</strong>}
                </span>
                {m.uitleg ? <span className="block text-muted-foreground">{m.uitleg}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {kanUitvoeren ? (
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-2xl border border-border p-3">
            <dt className="flex min-w-0 items-center gap-2 font-bold">
              <ShoppingBasket className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words hyphens-auto">Boodschappenlijst</span>
            </dt>
            <dd className="mt-1 space-y-1">
              {lijstGelijk ? <p>Blijft gelijk.</p> : null}
              {v.lijst.erbij.length ? (
                <p>
                  <span className="font-semibold">Erbij:</span> {v.lijst.erbij.join(", ")}
                </p>
              ) : null}
              {v.lijst.eraf.length ? (
                <p>
                  <span className="font-semibold">Eraf:</span> {v.lijst.eraf.join(", ")}
                </p>
              ) : null}
            </dd>
          </div>
          <div className="rounded-2xl border border-border p-3">
            <dt className="flex min-w-0 items-center gap-2 font-bold">
              <Wallet className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words hyphens-auto">Kost (schatting)</span>
            </dt>
            <dd className="mt-1" data-kostverschil={v.kost?.verschil ?? ""}>
              {v.kost
                ? Math.abs(v.kost.verschil) < 0.01
                  ? "Ongeveer gelijk."
                  : `${euro(v.kost.voor)} → ${euro(v.kost.na)} (${v.kost.verschil < 0 ? "−" : "+"}\u00a0${euro(Math.abs(v.kost.verschil))})`
                : "Verandert niet of niet te schatten."}
            </dd>
          </div>
          {v.eters.length ? (
            <div className="rounded-2xl border border-border p-3 sm:col-span-2">
              <dt className="flex min-w-0 items-center gap-2 font-bold">
                <Users className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words hyphens-auto">Wie eet mee</span>
              </dt>
              {v.eters.map((e) => (
                <dd key={e.datum} className="mt-1">
                  <Hoofd tekst={dagNaam(e.datum, vandaag)} />: {wieTekst(e.namen)}
                </dd>
              ))}
            </div>
          ) : null}
        </dl>
      ) : null}

      {v.waarschuwingen.length ? (
        <ul className="space-y-1" aria-label="Let op">
          {v.waarschuwingen.map((w) => (
            <li key={w} className="flex items-start gap-2 text-base">
              <TriangleAlert
                className="mt-0.5 size-5 shrink-0 text-[var(--honing-foreground)]"
                aria-hidden
              />
              <span className="break-words">{w}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {kanUitvoeren && (stand.soort === "open" || stand.soort === "bezig") ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="w-full sm:w-auto" onClick={onJa} disabled={stand.soort === "bezig"}>
            {stand.soort === "bezig" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
            Doe maar
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onNee}
            disabled={stand.soort === "bezig"}
          >
            Nee, laat maar
          </Button>
        </div>
      ) : null}

      {stand.soort === "gedaan" ? (
        <div className="space-y-3">
          <p role="status" className="flex items-start gap-2 text-base font-semibold">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span>{stand.tekst}</span>
          </p>
          {stand.herstellen ? (
            <Button variant="outline" onClick={onOngedaan} className="w-full sm:w-auto">
              <Undo2 aria-hidden /> Ongedaan maken
            </Button>
          ) : null}
        </div>
      ) : null}
      {stand.soort === "teruggezet" ? (
        <p role="status" className="text-base font-semibold">
          Teruggezet: je weekmenu en je lijst staan weer zoals ervoor.
        </p>
      ) : null}
      {stand.soort === "nee" ? (
        <p role="status" className="text-base">
          Oké, er is niets veranderd.
        </p>
      ) : null}
      {stand.soort === "fout" ? (
        <p role="alert" className="text-base font-semibold text-destructive">
          {stand.tekst}
        </p>
      ) : null}
    </section>
  );
}
