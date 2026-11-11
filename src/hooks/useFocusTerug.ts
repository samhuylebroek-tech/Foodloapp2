import { useEffect, useRef } from "react";

/**
 * Zet de focus terug op de knop die een venster opende, zodra het venster sluit. Radix doet
 * dat zelf alleen met een eigen trigger; bij vensters die we via state tonen (en die tussen
 * stappen wisselen) belandde de focus op <body> en moest een toetsenbord- of
 * schermlezergebruiker van bovenaf opnieuw beginnen (WCAG 2.4.3).
 */
export function useFocusTerug(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const was = useRef(false);
  // Tijdens de render bij het openen: de focus staat dan nog op de knop.
  if (open && !was.current && typeof document !== "undefined") {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  useEffect(() => {
    if (was.current && !open) {
      const el = opener.current;
      // Na het eigen focusbeheer van Radix (dat ook in een timeout loopt).
      const t = window.setTimeout(() => {
        const kwijt = !document.activeElement || document.activeElement === document.body;
        if (el?.isConnected && kwijt) el.focus();
      }, 0);
      was.current = open;
      return () => window.clearTimeout(t);
    }
    was.current = open;
    return undefined;
  }, [open]);
}
