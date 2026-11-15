/** Recept: geschatte kost voor het gekozen aantal personen ("± € 9,40 · schatting"). */
import { Wallet } from "lucide-react";
import { euro, schatGerecht } from "@/lib/budget";

export function ReceptKost({
  ingredienten,
  factor,
  personen,
}: {
  ingredienten: { name: string; quantity: number | null; unit: string }[];
  factor: number;
  personen: number;
}) {
  if (!ingredienten.length) return null;
  const k = schatGerecht(ingredienten, factor);
  if (k.dekking < 0.5 || k.totaal <= 0) return null;
  const pp = personen > 0 ? k.totaal / personen : k.totaal;
  return (
    <li
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3.5 text-base font-medium shadow-zacht"
      aria-label={`Geschatte kost ongeveer ${euro(k.totaal)}, ${euro(pp)} per persoon. Schatting, geen winkelprijs.`}
    >
      <Wallet className="size-5 text-primary" aria-hidden />± {euro(k.totaal)}
      <span className="text-[0.95rem] font-normal text-muted-foreground">schatting</span>
    </li>
  );
}
