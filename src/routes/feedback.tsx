import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback geven – Samen Koken" },
      {
        name: "description",
        content: "Vertel wat je van Samen Koken vindt: een idee, een probleem of een compliment.",
      },
      { property: "og:title", content: "Feedback geven – Samen Koken" },
      { property: "og:description", content: "Help Samen Koken beter maken met jouw tips." },
    ],
  }),
  component: FeedbackPage,
});

const SOORTEN = [
  { value: "idee", label: "Een idee" },
  { value: "probleem", label: "Iets werkt niet" },
  { value: "compliment", label: "Compliment" },
] as const;

type FeedbackRow = {
  id: string;
  kind: string;
  message: string;
  rating: number | null;
  created_at: string;
};

function FeedbackPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("idee");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: eerder = [] } = useQuery({
    queryKey: ["feedback", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, kind, message, rating, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });

  async function verstuur() {
    if (!user) return;
    if (!message.trim()) {
      toast.error("Schrijf eerst even je bericht");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      kind,
      message: message.trim(),
      rating: rating || null,
      page: typeof window === "undefined" ? null : window.location.pathname,
    });
    setSaving(false);
    if (error) {
      toast.error("Versturen lukte niet");
      return;
    }
    setMessage("");
    setRating(0);
    toast.success("Bedankt voor je bericht!");
    qc.invalidateQueries({ queryKey: ["feedback"] });
  }

  return (
    <AppShell title="Feedback">
      <div className="space-y-8">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <Label className="text-base">Waarover gaat het?</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SOORTEN.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setKind(s.value)}
                  className={cn(
                    "min-h-14 rounded-xl border px-5 text-base font-semibold",
                    kind === s.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="bericht" className="text-base">
              Jouw bericht
            </Label>
            <Textarea
              id="bericht"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Wat kan beter? Wat vind je fijn?"
              className="mt-2 text-base"
            />
          </div>

          <div>
            <Label className="text-base">Hoeveel sterren geef je de app?</Label>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n === rating ? 0 : n)}
                  aria-label={`${n} sterren`}
                  className="flex size-14 items-center justify-center rounded-xl border border-border bg-card"
                >
                  <Star
                    className={cn(
                      "size-7",
                      n <= rating ? "fill-primary text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          <Button onClick={verstuur} disabled={saving} className="h-16 w-full text-lg">
            {saving ? <Loader2 className="size-5 animate-spin" /> : null}
            Versturen
          </Button>
        </section>

        {eerder.length > 0 && (
          <section>
            <h2 className="text-lg">Wat je eerder stuurde</h2>
            <ul className="mt-3 space-y-3">
              {eerder.map((f) => (
                <li key={f.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-base text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("nl-BE", {
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {f.kind}
                    {f.rating ? ` · ${f.rating} sterren` : ""}
                  </p>
                  <p className="mt-1 text-lg">{f.message}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
