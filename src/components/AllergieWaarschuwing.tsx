/**
 * Waarschuwing op een recept als een ingrediënt (of de titel) mogelijk een gekozen allergeen bevat,
 * of als Foodlo het niet kan controleren omdat er geen ingrediënten bij staan.
 */
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { leesKennismaking } from "@/lib/kennismaking";
import { allergieOordeel } from "@/lib/veiligheid";

export function AllergieWaarschuwing({
  ingredienten,
  titel = "",
  geladen = true,
}: {
  ingredienten: string[];
  titel?: string;
  /** Pas "niet te controleren" zeggen als de ingrediënten echt geladen zijn. */
  geladen?: boolean;
}) {
  const { user } = useAuth();
  const gekozen = leesKennismaking(user?.id).allergieen;
  const oordeel = allergieOordeel({ title: titel, ingredienten }, gekozen);
  if (oordeel.status === "onbekend" && geladen)
    return (
      <section
        role="note"
        aria-label="Allergieën"
        className="flex gap-3 rounded-2xl bg-[oklch(0.95_0.04_70)] p-4 text-[oklch(0.32_0.07_60)] dark:bg-[oklch(0.3_0.05_70)] dark:text-[oklch(0.93_0.04_80)]"
      >
        <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1 text-base">
          <p className="font-semibold">Niet gecontroleerd op allergieën</p>
          <p className="text-[0.95rem]">
            Er staan geen ingrediënten bij dit gerecht, dus Foodlo kan het niet nakijken. Foodlo
            stelt het daarom niet vanzelf voor. Kijk de ingrediënten zelf na.{" "}
            <Link
              to="/hulp/$slug"
              params={{ slug: "allergieen" }}
              className="underline underline-offset-4"
            >
              Meer uitleg
            </Link>
          </p>
        </div>
      </section>
    );
  if (oordeel.status !== "allergeen") return null;
  const treffers = oordeel.treffers;
  return (
    <section
      role="note"
      aria-label="Allergieën"
      className="flex gap-3 rounded-2xl bg-[oklch(0.95_0.04_70)] p-4 text-[oklch(0.32_0.07_60)] dark:bg-[oklch(0.3_0.05_70)] dark:text-[oklch(0.93_0.04_80)]"
    >
      <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1 text-base">
        <p className="font-semibold">Let op: mogelijk allergenen</p>
        <ul className="space-y-0.5">
          {treffers.map((t) => (
            <li key={t.id} className="[overflow-wrap:anywhere]">
              {t.naam}: {t.ingredienten.join(", ")}
            </li>
          ))}
        </ul>
        <p className="text-[0.95rem]">
          Foodlo kent niet elke samenstelling. Lees altijd het etiket.{" "}
          <Link
            to="/hulp/$slug"
            params={{ slug: "allergieen" }}
            className="underline underline-offset-4"
          >
            Meer uitleg
          </Link>
        </p>
      </div>
    </section>
  );
}
