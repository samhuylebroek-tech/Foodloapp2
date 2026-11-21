/**
 * Vandaag, niets gepland (usecase 18): "Nog restjes van …". Eén tik zet "Restjes: …" op vanavond
 * (zonder recept, dus niets op je lijst) en markeert het restje als ingepland; "Ongedaan maken"
 * zet beide terug. Dezelfde allergie- en dieetregel als overal.
 * Alleen restjes van hooguit 3 dagen. Uit met "Slimme voorstellen".
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Soup } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRestjes, useRestjesActies } from "@/hooks/useRestjes";
import {
  RESTJE_VOORSTEL_DAGEN,
  dagenOud,
  gekooktTekst,
  restjeVeilig,
  type Restje,
} from "@/lib/intelligentie/restjes";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { leesKennismaking } from "@/lib/kennismaking";
import { meet } from "@/lib/meten";
import { lokaleDatum } from "@/lib/tijd";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";

export function RestjesVoorstel() {
  const { user } = useAuth();
  const restjeActies = useRestjesActies();
  const qc = useQueryClient();
  const t = useT();
  const { momenten } = useVoorkeuren();
  const [slim] = useSlimmeVoorstellen();
  const [bezig, setBezig] = useState(false);
  const lijst = useRestjes().filter((r) => !r.gepland && dagenOud(r) <= RESTJE_VOORSTEL_DAGEN);
  // Dezelfde veiligheidsregel: met allergieën of dieet alleen met bekende, veilige ingrediënten.
  const kennis = leesKennismaking(user?.id);
  const ids = [...new Set(lijst.map((r) => r.receptId).filter((x): x is string => !!x))];
  const { data: ingr, isSuccess } = useQuery({
    queryKey: ["restjes-ingredienten", ids.join(",")],
    enabled: slim && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ids);
      if (error) throw error;
      const per: Record<string, string[]> = {};
      for (const i of data ?? []) (per[i.recipe_id] ??= []).push(i.name);
      return per;
    },
  });
  const restje = lijst.find((r) =>
    restjeVeilig(r, r.receptId && isSuccess ? (ingr?.[r.receptId] ?? []) : undefined, kennis),
  );
  if (!slim || !restje || !user) return null;

  const vernieuw = () => {
    for (const k of ["home-dagmenu", "home-week", "meal-plan"])
      void qc.invalidateQueries({ queryKey: [k] });
  };

  async function eetRestjes(r: Restje) {
    if (!user || bezig) return;
    setBezig(true);
    try {
      const moment = momenten.includes("avondeten")
        ? "avondeten"
        : (momenten.at(-1) ?? "avondeten");
      const { data, error } = await supabase
        .from("meal_plan")
        .insert({
          user_id: user.id,
          recipe_id: null,
          custom_title: `Restjes: ${r.titel}`,
          plan_date: lokaleDatum(),
          meal_type: moment,
          personen: r.porties,
          group_id: null,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("geen id");
      // Ingepland, niet weg: het restje blijft in Keuken staan tot je "Is op" tikt.
      restjeActies?.plan(r.id, lokaleDatum());
      void meet("restjes.vanavond", undefined, { dagen: dagenOud(r) });
      vernieuw();
      toast.success(`Restjes van ${r.titel} staan op vanavond`, {
        duration: 8000,
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            await supabase.from("meal_plan").delete().eq("id", data.id);
            restjeActies?.plan(r.id, null);
            vernieuw();
          },
        },
      });
    } catch {
      toast.error("Dat lukte niet. Er is niets veranderd; probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <section aria-labelledby="restjes-kop" className="mt-6 rounded-2xl bg-white/10 p-3">
      <h3
        id="restjes-kop"
        className="flex items-center gap-2 text-base font-semibold text-inkt-zacht"
      >
        <Soup className="size-5" aria-hidden /> {t("Nog restjes")}
      </h3>
      <p className="mt-1 text-lg leading-snug font-semibold break-words text-inkt-foreground">
        {restje.titel}
      </p>
      <p className="text-[0.95rem] text-inkt-zacht">
        {gekooktTekst(restje)} · {restje.porties} {restje.porties === 1 ? "portie" : "porties"}
      </p>
      <button
        type="button"
        onClick={() => void eetRestjes(restje)}
        disabled={bezig}
        className="mt-2 inline-flex min-h-12 max-w-full items-center gap-1.5 rounded-full bg-honing px-4 text-base font-semibold text-op-honing disabled:opacity-60"
      >
        {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {t("Eet vanavond restjes")}
      </button>
    </section>
  );
}
