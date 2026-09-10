import { supabase } from "@/integrations/supabase/client";

// Anonieme, lichte gebruiksmeting voor de cijfers in het Control Center.
export async function meet(event: string, path?: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await supabase.from("usage_events").insert({
      user_id: userId,
      event,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : null),
    });
  } catch {
    /* meten mag de app nooit hinderen */
  }
}
