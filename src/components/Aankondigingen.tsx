import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Bericht = { id: string; title: string; body: string; level: string };

const SLEUTEL = "majeba-gelezen-berichten";

export function Aankondigingen() {
  const { session } = useAuth();
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [gelezen, setGelezen] = useState<string[]>([]);

  useEffect(() => {
    try {
      setGelezen(JSON.parse(localStorage.getItem(SLEUTEL) ?? "[]"));
    } catch {
      setGelezen([]);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("announcements")
      .select("id, title, body, level")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setBerichten((data as Bericht[]) ?? []));
  }, [session]);

  const zichtbaar = berichten.filter((b) => !gelezen.includes(b.id));
  if (zichtbaar.length === 0) return null;

  const sluit = (id: string) => {
    const nieuw = [...gelezen, id];
    setGelezen(nieuw);
    localStorage.setItem(SLEUTEL, JSON.stringify(nieuw));
  };

  return (
    <div className="mb-4 space-y-2">
      {zichtbaar.map((b) => (
        <div
          key={b.id}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
        >
          <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{b.title}</p>
            {b.body ? <p className="text-base text-muted-foreground">{b.body}</p> : null}
          </div>
          <button onClick={() => sluit(b.id)} aria-label="Bericht sluiten" className="p-1 text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
