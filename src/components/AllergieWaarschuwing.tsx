/** Waarschuwing op een recept als een ingrediënt mogelijk een gekozen allergeen bevat. */
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { allergenenIn } from "@/lib/allergenen";
import { leesKennismaking } from "@/lib/kennismaking";

export function AllergieWaarschuwing({ ingredienten }: { ingredienten: string[] }) {
  const { user } = useAuth();
  const gekozen = leesKennismaking(user?.id).allergieen;
  const treffers = allergenenIn(ingredienten, gekozen);
  if (!treffers.length) return null;
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
