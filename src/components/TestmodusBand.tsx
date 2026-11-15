import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

/** Vaste markering: alles hier is een test. Er wordt niets aangerekend. */
export function TestmodusBand({ children }: { children?: ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-base text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <FlaskConical className="mt-0.5 size-6 shrink-0" aria-hidden />
      <span>
        <strong>Testmodus: nog niet te koop.</strong>{" "}
        {children ?? "Er wordt niets aangerekend en er zijn geen echte betalingen."}
      </span>
    </p>
  );
}
