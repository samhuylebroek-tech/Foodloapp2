import { z } from "zod";

/**
 * Een lijst met een harde maximumlengte die EERST de lengte controleert en pas
 * daarna de elementen. Zonder dit valideert zod (v3 én v4 < 4.6.6) elk element
 * en verzamelt het per fout element een foutobject: 100 000 ongeldige items =
 * 100 000 foutobjecten (geheugenuitputting, vgl. CVE-2023-54404).
 */
export function begrensdeLijst<T extends z.ZodTypeAny>(item: T, max: number, min = 0) {
  return z
    .unknown()
    .superRefine((waarde, ctx) => {
      if (!Array.isArray(waarde)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Verwacht een lijst.", fatal: true });
      } else if (waarde.length > max || waarde.length < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            waarde.length > max
              ? `Te veel items (maximum ${max}).`
              : `Te weinig items (minimum ${min}).`,
          fatal: true,
        });
      }
    })
    .pipe(z.array(item).min(min).max(max));
}
