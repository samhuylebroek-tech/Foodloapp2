/**
 * P5 — "Wie veranderde wat" in het gezinsweekmenu: een klein, inklapbaar overzicht van deze
 * week. Alleen actieve gezinsleden lezen het (databankregels, voorstel 0017); zonder die tabel
 * (nog niet geactiveerd) toont Week niets extra.
 */
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { activiteitVanWeek, telPerPersoon, type Activiteit } from "@/lib/samenwerking/activiteit";
import { wieTekst } from "@/lib/samenwerking/conflict";
import { ACTIVITEIT_TABEL, namenVan } from "@/lib/samenwerking/db";
import { wanneerTekst } from "@/lib/samenwerking/meldingen";

export function WeekActiviteit({
  groupId,
  van,
  tot,
}: {
  groupId: string;
  van: string;
  tot: string;
}) {
  const { user } = useAuth();
  const { beschikbaar } = useModuleBeschikbaar(ACTIVITEIT_TABEL);
  const { data } = useQuery({
    queryKey: ["gezin-activiteit", groupId, van],
    enabled: beschikbaar && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from(ACTIVITEIT_TABEL)
        .select("id, group_id, actor_id, soort, tekst, datum, ref_id, created_at")
        .eq("group_id", groupId)
        .gte("datum", van)
        .lte("datum", tot)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rijen = activiteitVanWeek((data ?? []) as Activiteit[], van, tot);
      const namen = await namenVan(rijen.map((r) => r.actor_id));
      return { rijen, namen };
    },
  });
  if (!beschikbaar || !data) return null;
  const { rijen, namen } = data;
  return (
    <section aria-labelledby="wie-wat" className="paneel p-4">
      <details>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl">
          <History className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span id="wie-wat" className="block text-lg font-semibold leading-tight">
              Wie veranderde wat
            </span>
            <span className="block text-base text-muted-foreground">
              {rijen.length
                ? `Deze week: ${telPerPersoon(rijen, namen)}`
                : "Deze week nog niets veranderd"}
            </span>
          </span>
          <span className="shrink-0 text-base font-semibold text-primary">Toon</span>
        </summary>
        {rijen.length ? (
          <ol className="mt-3 space-y-2" data-testid="activiteit-lijst">
            {rijen.map((r) => (
              <li key={r.id} className="rounded-xl bg-secondary/70 px-3 py-2">
                <p className="text-base leading-snug break-words">{r.tekst}</p>
                <p className="text-[0.95rem] text-muted-foreground">
                  {r.actor_id === user?.id ? "Jij" : wieTekst(namen[r.actor_id])} ·{" "}
                  {wanneerTekst(r.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-base text-muted-foreground">
            Wat jij of je gezin in het gezinsweekmenu of op de gezinslijst verandert, zie je hier.
          </p>
        )}
      </details>
    </section>
  );
}
