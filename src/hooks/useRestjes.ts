/**
 * Restjes van de aangemelde gebruiker (en, na migratie 0019, van het gezin), mee ververst bij
 * elke wijziging. De lijst op het toestel toont meteen; het account wordt bij het openen, bij
 * terugkeren naar de app en na een minuut opnieuw opgehaald.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEigenGezin, useEigenGezinId } from "@/hooks/useVoorstelEters";
import { restjes, type Restje } from "@/lib/intelligentie/restjes";
import {
  restjesActies,
  restjesBron,
  synchroniseerRestjes,
  type RestjesBron,
} from "@/lib/intelligentie/restjes-db";

let bezig: Promise<RestjesBron> | null = null;
function synchroniseer(userId: string, groupId: string | null) {
  bezig ??= synchroniseerRestjes(userId, groupId).finally(() => {
    bezig = null;
  });
  return bezig;
}

export function useRestjes(): Restje[] {
  const { user } = useAuth();
  // Pas synchroniseren als bekend is of je een gezin hebt (anders zonder gezin bewaard).
  const { id: gezinId, klaar: gezinKlaar } = useEigenGezin();
  const [lijst, setLijst] = useState<Restje[]>([]);
  useEffect(() => {
    const lees = () => setLijst(restjes(user?.id));
    lees();
    window.addEventListener("foodlo:restjes", lees);
    window.addEventListener("storage", lees);
    return () => {
      window.removeEventListener("foodlo:restjes", lees);
      window.removeEventListener("storage", lees);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || !gezinKlaar) return;
    const id = user.id;
    const haal = () => void synchroniseer(id, gezinId);
    haal();
    const opFocus = () => {
      if (document.visibilityState === "visible") haal();
    };
    document.addEventListener("visibilitychange", opFocus);
    const klok = window.setInterval(haal, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", opFocus);
      window.clearInterval(klok);
    };
  }, [user?.id, gezinId, gezinKlaar]);
  return lijst;
}

/** Bewaren, plannen, opgegeten/weggegooid: op het toestel én (als het kan) op het account. */
export function useRestjesActies() {
  const { user } = useAuth();
  const gezinId = useEigenGezinId();
  return useMemo(() => (user ? restjesActies(user.id, gezinId) : null), [user, gezinId]);
}

/** Waar staan de restjes? Voor een eerlijke zin ("op dit toestel" of "bij je gezin"). */
export function useRestjesBron(): RestjesBron {
  const [bron, setBron] = useState<RestjesBron>(restjesBron());
  useEffect(() => {
    const lees = () => setBron(restjesBron());
    window.addEventListener("foodlo:restjes", lees);
    return () => window.removeEventListener("foodlo:restjes", lees);
  }, []);
  return bron;
}
