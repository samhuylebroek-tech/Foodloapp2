import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { wisAlleKennismakingen } from "@/lib/kennismaking";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Gezondheidsgegevens van de kennismaking niet op het toestel laten na afmelden.
      if (event === "SIGNED_OUT") wisAlleKennismakingen();
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}
