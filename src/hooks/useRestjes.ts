/** Restjes van de aangemelde gebruiker (op dit toestel), en mee ververst bij elke wijziging. */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { restjes, type Restje } from "@/lib/intelligentie/restjes";

export function useRestjes(): Restje[] {
  const { user } = useAuth();
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
  return lijst;
}
