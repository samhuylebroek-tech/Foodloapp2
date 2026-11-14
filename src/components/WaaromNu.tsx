/**
 * "Waarom nu" op de receptpagina (ronde 3: de assistent als één ervaring). Dezelfde motor en
 * dezelfde woorden als Vandaag, Week en Keuken (`beveelAan`): seizoen, wat je in huis hebt,
 * geschiedenis, je eigen tijd. Toont niets als "Slimme voorstellen" uit staat, als het recept niet
 * past bij je allergieën of dieet (die waarschuwing staat elders), of als er geen echte reden is.
 * Alles op het toestel; niets gaat naar een AI.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { bepaalContext } from "@/lib/intelligentie/context";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { nietNuLijst } from "@/lib/intelligentie/niet-nu";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { beveelAan } from "@/lib/intelligentie/voorstel";
import { leesKennismaking } from "@/lib/kennismaking";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";

export function WaaromNu({
  recept,
}: {
  recept: {
    id: string;
    title: string;
    category: string | null;
    tags?: string[] | null;
    prep_minutes?: number | null;
    cook_minutes?: number | null;
  };
}) {
  const { user } = useAuth();
  const t = useT();
  const { weekmenu } = useVoorkeuren();
  const [slim] = useSlimmeVoorstellen();
  const [nietNu, setNietNu] = useState<string[]>([]);
  useEffect(() => setNietNu(nietNuLijst(user?.id)), [user?.id]);
  const ids = useMemo(() => [recept.id], [recept.id]);
  const { data: bronnen } = useVoorstelBronnen(ids, slim);

  const redenen = useMemo(() => {
    if (!bronnen) return [];
    const minuten = (recept.prep_minutes ?? 0) + (recept.cook_minutes ?? 0);
    const context = bepaalContext(new Date());
    const dag = weekmenu.perDag?.[String(context.weekdag)];
    const kennis = leesKennismaking(user?.id);
    const [a] = beveelAan({
      kandidaten: [
        {
          id: recept.id,
          title: recept.title,
          minuten,
          category: recept.category,
          tags: recept.tags ?? [],
          ingredienten: bronnen.ingredienten[recept.id] ?? [],
        },
      ],
      context,
      voorraad: bronnen.voorraad,
      geschiedenis: vatSamen(bronnen.plan, { [recept.id]: minuten }, context.datum),
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
      max: 1,
    });
    // "Uit je eigen recepten" is geen reden om nu te koken: dan zwijgen we liever.
    return (a?.redenen ?? []).filter((r) => r.soort !== "eigen").map((r) => r.tekst);
  }, [bronnen, recept, weekmenu, nietNu, user?.id]);

  if (!slim || !redenen.length) return null;
  return (
    <p
      className="flex items-start gap-2 rounded-2xl bg-secondary/70 px-4 py-3 text-base"
      data-testid="waarom-nu"
    >
      <Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-semibold">{t("Waarom nu")}:</span> {redenen.join(" · ")}
      </span>
    </p>
  );
}
