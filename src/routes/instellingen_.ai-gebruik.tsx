/**
 * Fase 7 — Instellingen › AI-gebruik: hoeveel slimme vragen je vandaag nog hebt, wat er deze
 * maand meetelde (alleen soort en aantal, nooit de inhoud), wat uit de cache kwam, en dat vaste
 * regels gratis zijn. Bron: dit toestel en, na voorstel 0024, je account (`ai_gebruik_dag`).
 */
import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Groep } from "@/components/mobiel/Lijst";
import { useAuth } from "@/hooks/useAuth";
import { DAGLIMIET } from "@/lib/assistent/gebruik";
import {
  isAiSoort,
  leesLog,
  naarDagtotalen,
  overzicht,
  voegSamen,
  type DagTotaal,
} from "@/lib/ai/gebruik-log";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { lokaleDatum } from "@/lib/tijd";

export const AI_GEBRUIK_TABEL = "ai_gebruik_dag";

export const Route = createFileRoute("/instellingen_/ai-gebruik")({
  head: () => ({
    meta: [
      { title: "AI-gebruik – Foodlo" },
      {
        name: "description",
        content:
          "Hoeveel slimme vragen je vandaag en deze maand gebruikte. Vaste tips zijn gratis.",
      },
    ],
  }),
  component: AiGebruikPagina,
});

function AiGebruikPagina() {
  const { user } = useAuth();
  const vandaag = lokaleDatum();
  const account = useModuleBeschikbaar(AI_GEBRUIK_TABEL);
  const { data: opAccount = [] } = useQuery({
    queryKey: ["ai-gebruik", user?.id, vandaag.slice(0, 7), account.beschikbaar],
    enabled: !!user && account.beschikbaar,
    queryFn: async (): Promise<DagTotaal[]> => {
      const { data, error } = await db
        .from(AI_GEBRUIK_TABEL)
        .select("dag, soort, aantal, uit_cache")
        .eq("user_id", user!.id)
        .gte("dag", `${vandaag.slice(0, 7)}-01`);
      if (error) return [];
      return ((data ?? []) as { dag: string; soort: string; aantal: number; uit_cache: number }[])
        .filter((r) => isAiSoort(r.soort))
        .map((r) => ({
          dag: r.dag,
          soort: r.soort as DagTotaal["soort"],
          aantal: Number(r.aantal) || 0,
          cache: Number(r.uit_cache) || 0,
        }));
    },
  });
  const o = useMemo(
    () => overzicht(voegSamen(naarDagtotalen(leesLog(user?.id)), opAccount), vandaag, DAGLIMIET),
    [user?.id, opAccount, vandaag],
  );
  const op = o.rest === 0;

  return (
    <AppShell title="AI-gebruik" ondertitel="Wat de slimme hulp deed, zonder wat je vroeg.">
      <div className="mx-auto max-w-2xl space-y-7 pb-8">
        <Link
          to="/instellingen"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Instellingen
        </Link>

        <section aria-labelledby="ai-vandaag" className="paneel space-y-3 p-5">
          <h2 id="ai-vandaag" className="flex items-center gap-2 text-sectietitel">
            <Sparkles className="size-6 shrink-0 text-primary" aria-hidden />
            Vandaag
          </h2>
          <p className="text-3xl font-bold tabular-nums" data-testid="ai-vandaag">
            {o.vandaag} van {o.limiet}
          </p>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Slimme vragen vandaag"
            aria-valuemin={0}
            aria-valuemax={o.limiet}
            aria-valuenow={o.vandaag}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (o.vandaag / Math.max(1, o.limiet)) * 100)}%` }}
            />
          </div>
          <p className="text-lg" role="status">
            {op
              ? "Je slimme vragen voor vandaag zijn op. De vaste tips en alles zonder AI blijven gewoon werken. Morgen kan je weer."
              : `Je kan vandaag nog ${o.rest} slimme ${o.rest === 1 ? "vraag" : "vragen"} stellen.`}
          </p>
        </section>

        <Groep titel="Deze maand">
          <div className="space-y-1 px-4 py-3">
            <p className="text-lg">
              <strong className="tabular-nums" data-testid="ai-maand">
                {o.maand}
              </strong>{" "}
              slimme {o.maand === 1 ? "vraag" : "vragen"} geteld
              {o.uitCache
                ? ` · ${o.uitCache} keer hetzelfde antwoord opnieuw gebruikt (telde niet mee)`
                : ""}
            </p>
          </div>
        </Groep>

        <Groep
          titel="Wat telde mee"
          voet="Foodlo bewaart alleen de soort en het aantal per dag. Nooit je vraag, het antwoord, je recepten of je allergieën."
        >
          {o.perSoort.length ? (
            <ul className="divide-y divide-border/70">
              {o.perSoort.map((s) => (
                <li key={s.soort} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-[1.05rem]">{s.label}</span>
                  <span className="shrink-0 text-base tabular-nums text-muted-foreground">
                    vandaag {s.vandaag} · maand {s.maand}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-base text-muted-foreground">
              Deze maand nog geen slimme vragen.
            </p>
          )}
        </Groep>

        <Groep titel="Altijd gratis">
          <ul className="list-disc space-y-1 py-3 pl-9 pr-4 text-base">
            <li>Vaste tips en vervangers in de kookhulp</li>
            <li>Opdrachten die Foodlo zelf herkent in de weekassistent</li>
            <li>“Maak mijn lijst slimmer” en de weekplanner (vaste regels)</li>
          </ul>
        </Groep>

        <p className="text-[0.95rem] text-muted-foreground">
          {account.beschikbaar
            ? "Je gebruik staat op je account, ook van je andere toestellen."
            : "Je gebruik wordt nu op dit toestel bijgehouden. Op je account komt het zodra die functie actief is."}{" "}
          De daglimiet is voor iedereen gelijk, zodat de kosten voorspelbaar blijven.
        </p>
      </div>
    </AppShell>
  );
}
