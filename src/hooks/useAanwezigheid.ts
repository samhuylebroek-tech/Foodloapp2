/**
 * P5 — Wie kijkt er nu mee (Supabase Realtime presence), en is die iets aan het bewerken?
 * Goedkoop: één kanaal per gezinslijst of gezinsweekmenu, alleen zolang het scherm open is,
 * en alleen naam + "bezig" (geen inhoud). Lukt de verbinding niet (offline, nep-databank),
 * dan is er gewoon niemand te zien.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Aanwezige } from "@/lib/samenwerking/activiteit";

export function useAanwezigheid(kanaal: string | null, bezig: boolean): Aanwezige[] {
  const { user } = useAuth();
  const [wie, setWie] = useState<Aanwezige[]>([]);
  const ref = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const naam =
    (user?.user_metadata?.["voornaam"] as string | undefined) ??
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    "";

  useEffect(() => {
    if (!kanaal || !user) return;
    let actief = true;
    let ch: ReturnType<typeof supabase.channel>;
    try {
      ch = supabase.channel(`aanwezig:${kanaal}`, { config: { presence: { key: user.id } } });
    } catch {
      return;
    }
    ref.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      if (!actief) return;
      const staat = ch.presenceState<Aanwezige>();
      setWie(Object.values(staat).flat());
    }).subscribe((status) => {
      if (status === "SUBSCRIBED")
        void ch.track({ user_id: user.id, naam, bezig: false }).catch(() => undefined);
    });
    return () => {
      actief = false;
      ref.current = null;
      void supabase.removeChannel(ch);
    };
  }, [kanaal, user, naam]);

  useEffect(() => {
    const ch = ref.current;
    if (!ch || !user) return;
    void ch.track({ user_id: user.id, naam, bezig }).catch(() => undefined);
  }, [bezig, user, naam]);

  return wie;
}
