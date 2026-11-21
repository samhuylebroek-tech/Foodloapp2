/**
 * P3: je eigen kooknotities bij een recept ("volgende keer minder zout") en wanneer je het laatst
 * kookte. Alleen voor jou; nooit gedeeld en nooit naar AI.
 */
import { NotebookPen } from "lucide-react";
import { laatstGekookt, notitiesVoor } from "@/lib/koken/kookmomenten";
import { useKookmomenten } from "@/lib/koken/kookmomenten-db";
import { versieDatum } from "@/lib/recept-versies";

export function KookNotities({ receptId }: { receptId: string }) {
  const momenten = useKookmomenten();
  const notities = notitiesVoor(momenten, receptId, 3);
  const laatst = laatstGekookt(momenten, receptId);
  if (!laatst && !notities.length) return null;
  return (
    <section aria-labelledby="kooknotities-titel" className="paneel p-5">
      <h2 id="kooknotities-titel" className="flex items-center gap-2 text-lg font-semibold">
        <NotebookPen className="size-5 shrink-0" aria-hidden /> Jouw kooknotities
      </h2>
      {laatst ? (
        <p className="mt-1 text-base text-muted-foreground">
          Laatst gekookt: {versieDatum(laatst)}
        </p>
      ) : null}
      {notities.length ? (
        <ul className="mt-3 space-y-2">
          {notities.map((n) => (
            <li key={n.id} className="rounded-xl bg-secondary p-3 text-base">
              <span className="block whitespace-pre-line break-words">{n.notitie}</span>
              <span className="mt-1 block text-[0.95rem] text-muted-foreground">
                {versieDatum(n.gekookt_op)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-[0.95rem] text-muted-foreground">Alleen jij ziet deze notities.</p>
    </section>
  );
}
