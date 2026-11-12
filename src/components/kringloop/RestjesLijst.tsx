/**
 * Keuken: je restjes (op dit toestel), met wanneer ze gekookt zijn en "Is op" (met ongedaan maken).
 * Na 3 dagen stelt Foodlo ze niet meer voor en vraagt het om zelf te kijken of het nog goed is.
 * Altijd zichtbaar (ook met Slimme voorstellen uit): het is je eigen lijst, geen voorstel.
 */
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRestjes } from "@/hooks/useRestjes";
import { labelVoor } from "@/components/planner/gedeeld";
import {
  RESTJE_VOORSTEL_DAGEN,
  dagenOud,
  gekooktTekst,
  verwijderRestje,
  zetRestjeTerug,
} from "@/lib/intelligentie/restjes";

export function RestjesLijst() {
  const { user } = useAuth();
  const lijst = useRestjes();
  if (!user || !lijst.length) return null;
  return (
    <section aria-labelledby="restjes-titel" className="min-w-0">
      <h2 id="restjes-titel" className="text-sectietitel">
        Restjes
      </h2>
      <ul className="mt-3 divide-y divide-border rounded-2xl bg-card shadow-zacht">
        {lijst.map((r) => (
          <li key={r.id} className="flex min-h-[4.25rem] items-center gap-3 py-2 pl-4 pr-2">
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold leading-snug break-words">
                {r.titel}
              </span>
              <span className="block text-[0.95rem] text-muted-foreground">
                {gekooktTekst(r)} · {r.porties} {r.porties === 1 ? "portie" : "porties"}
              </span>
              {r.gepland ? (
                <span className="block text-[0.95rem] font-semibold text-primary">
                  Gepland: {labelVoor(r.gepland)}
                </span>
              ) : null}
              {dagenOud(r) > RESTJE_VOORSTEL_DAGEN ? (
                <span className="block text-[0.95rem] font-semibold text-[oklch(0.42_0.1_55)] dark:text-[oklch(0.85_0.09_75)]">
                  Kijk zelf of het nog goed is.
                </span>
              ) : null}
            </span>
            <button
              type="button"
              aria-label={`Is op: ${r.titel}`}
              onClick={() => {
                const weg = verwijderRestje(user.id, r.id);
                if (!weg) return;
                toast(`${r.titel} is weg uit je restjes`, {
                  action: { label: "Ongedaan maken", onClick: () => zetRestjeTerug(user.id, weg) },
                });
              }}
              className="min-h-12 shrink-0 rounded-full border border-border px-4 text-base font-semibold hover:bg-muted"
            >
              Is op
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
