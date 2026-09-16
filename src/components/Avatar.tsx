/** Eenvoudige avatar met initialen — geen foto's nodig. */

const KLEUREN = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
];

function initialen(naam: string) {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  const eerste = delen[0]?.[0] ?? "";
  const tweede = delen.length > 1 ? (delen[delen.length - 1]?.[0] ?? "") : "";
  return (eerste + tweede).toUpperCase();
}

export function Avatar({
  naam,
  sleutel,
  className = "",
}: {
  naam: string;
  sleutel?: string;
  className?: string;
}) {
  const basis = sleutel ?? naam;
  let som = 0;
  for (const teken of basis) som += teken.charCodeAt(0);
  const kleur = KLEUREN[som % KLEUREN.length];

  return (
    <span
      aria-hidden
      className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${kleur} ${className}`}
    >
      {initialen(naam)}
    </span>
  );
}
