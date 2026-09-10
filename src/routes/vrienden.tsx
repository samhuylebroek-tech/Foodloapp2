import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { ChefHat, Copy, Plus, Share2, Smartphone, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/vrienden")({
  head: () => ({
    meta: [
      { title: "Vrienden uitnodigen – Samen Koken" },
      {
        name: "description",
        content:
          "Nodig vrienden of familie uit met een link, QR-code of e-mail en bepaal zelf wat zij mogen zien en bewerken.",
      },
      { property: "og:title", content: "Vrienden uitnodigen – Samen Koken" },
      {
        property: "og:description",
        content: "Deel je recepten, planning en boodschappenlijst met wie jij kiest.",
      },
    ],
  }),
  component: VriendenPage,
});

type Rechten = {
  recipes_view: boolean;
  recipes_edit: boolean;
  planner_view: boolean;
  planner_edit: boolean;
  shopping_view: boolean;
  shopping_edit: boolean;
};

type Share = Rechten & {
  id: string;
  owner_id: string;
  member_id: string | null;
  invited_email: string | null;
  token: string;
  status: string;
};

const RECHTEN: { key: keyof Rechten; label: string }[] = [
  { key: "recipes_view", label: "Mijn recepten bekijken" },
  { key: "recipes_edit", label: "Mijn recepten bewerken" },
  { key: "planner_view", label: "Mijn weekplanning bekijken" },
  { key: "planner_edit", label: "Mijn weekplanning bewerken" },
  { key: "shopping_view", label: "Mijn boodschappenlijst bekijken" },
  { key: "shopping_edit", label: "Mijn boodschappenlijst bewerken" },
];

const STANDAARD: Rechten = {
  recipes_view: true,
  recipes_edit: false,
  planner_view: false,
  planner_edit: false,
  shopping_view: false,
  shopping_edit: false,
};

function uitnodigingsLink(token: string) {
  return `${window.location.origin}/uitnodiging?code=${token}`;
}

function VriendenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rechten, setRechten] = useState<Rechten>(STANDAARD);
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [nieuwId, setNieuwId] = useState<string | null>(null);

  const { data: shares = [] } = useQuery({
    queryKey: ["shares", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shares")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Share[];
    },
  });

  const { data: namen = {} } = useQuery({
    queryKey: ["profielnamen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name");
      if (error) throw error;
      return Object.fromEntries(data.map((p) => [p.id, p.display_name])) as Record<string, string>;
    },
  });

  const mijn = shares.filter((s) => s.owner_id === user?.id);
  const metMijGedeeld = shares.filter((s) => s.member_id === user?.id && s.owner_id !== user?.id);

  // Alle mensen waarmee een verbinding bestaat, in beide richtingen.
  const vrienden = (() => {
    const map = new Map<
      string,
      { id: string; ikDeel: Share | null; zijDelen: Share | null }
    >();
    for (const s of shares) {
      if (s.status !== "accepted") continue;
      if (s.owner_id === user?.id && s.member_id) {
        const rij = map.get(s.member_id) ?? { id: s.member_id, ikDeel: null, zijDelen: null };
        rij.ikDeel = s;
        map.set(s.member_id, rij);
      } else if (s.member_id === user?.id) {
        const rij = map.get(s.owner_id) ?? { id: s.owner_id, ikDeel: null, zijDelen: null };
        rij.zijDelen = s;
        map.set(s.owner_id, rij);
      }
    }
    return [...map.values()];
  })();

  const maakUitnodiging = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("shares")
        .insert({ owner_id: user!.id, ...rechten })
        .select("*")
        .single();
      if (error) throw error;
      return data as Share;
    },
    onSuccess: async (s) => {
      setNieuwOpen(false);
      setNieuwId(s.id);
      setRechten(STANDAARD);
      qc.invalidateQueries({ queryKey: ["shares"] });
      const link = uitnodigingsLink(s.token);
      try {
        if (navigator.share) {
          await navigator.share({ title: "Samen Koken", text: "Doe mee met mijn recepten", url: link });
          return;
        }
        await navigator.clipboard.writeText(link);
        toast.success("Uitnodigingslink gekopieerd — plak hem in een bericht.");
      } catch {
        toast.success("Uitnodiging klaar — deel de link hieronder.");
      }
    },
    onError: () => toast.error("De uitnodiging maken lukte niet"),
  });

  const wijzig = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Rechten> }) => {
      const { error } = await supabase.from("shares").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares"] }),
    onError: () => toast.error("Wijzigen lukte niet"),
  });

  const verwijder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Toegang ingetrokken");
    },
  });

  return (
    <AppShell title="Vrienden">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-lg leading-relaxed">
            Hier staan je vrienden. Klik op + om iemand uit te nodigen.
          </p>
          <button
            type="button"
            onClick={() => setNieuwOpen((v) => !v)}
            aria-label={nieuwOpen ? "Uitnodiging sluiten" : "Vriend toevoegen"}
            aria-expanded={nieuwOpen}
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
          >
            {nieuwOpen ? <X className="size-8" aria-hidden /> : <Plus className="size-8" aria-hidden />}
          </button>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Mijn vrienden</h2>
          {vrienden.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
              Je hebt nog geen vrienden toegevoegd. Klik op + om iemand uit te nodigen.
            </p>
          ) : (
            vrienden.map((v) => (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-lg font-semibold">{namen[v.id] ?? "Vriend"}</p>
                <p className="mt-1 text-base text-muted-foreground">
                  {v.zijDelen && (v.zijDelen.recipes_view || v.zijDelen.recipes_edit)
                    ? "Deelt zijn of haar gerechten met jou"
                    : "Deelt (nog) geen gerechten met jou"}
                </p>
                {v.zijDelen && (v.zijDelen.recipes_view || v.zijDelen.recipes_edit) && (
                  <Link
                    to="/vrienden/$id"
                    params={{ id: v.id }}
                    className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground"
                  >
                    <ChefHat className="size-5" aria-hidden /> Bekijk hun gerechten
                  </Link>
                )}
              </div>
            ))
          )}
        </section>

        {nieuwOpen && (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Nieuwe uitnodiging</h2>

          <p className="text-base text-muted-foreground">
            Kies eerst wat je vriend mag zien of bewerken. Daarna krijg je een link die je kan
            doorsturen via WhatsApp, sms of hoe je wil. Wie erop klikt, wordt jouw vriend.
          </p>


          <ul className="space-y-1">
            {RECHTEN.map((r) => (
              <li
                key={r.key}
                className="flex min-h-14 items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0"
              >
                <Label htmlFor={`nieuw-${r.key}`} className="text-base font-normal leading-snug">
                  {r.label}
                </Label>
                <Switch
                  id={`nieuw-${r.key}`}
                  checked={rechten[r.key]}
                  onCheckedChange={(v) => setRechten((p) => ({ ...p, [r.key]: v }))}
                />
              </li>
            ))}
          </ul>

          <Button
            onClick={() => maakUitnodiging.mutate()}
            disabled={maakUitnodiging.isPending}
            className="h-16 w-full text-lg"
          >
            <UserPlus className="size-5" /> Uitnodigingslink maken
          </Button>
        </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl">Mensen die ik uitnodigde</h2>
          {mijn.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
              Je hebt nog niemand uitgenodigd.
            </p>
          ) : (
            mijn.map((s) => (
              <UitnodigingKaart
                key={s.id}
                share={s}
                naam={s.member_id ? (namen[s.member_id] ?? "Vriend") : null}
                startOpen={s.id === nieuwId}
                onWijzig={(patch) => wijzig.mutate({ id: s.id, patch })}
                onVerwijder={() => verwijder.mutate(s.id)}
              />
            ))
          )}
        </section>

        {metMijGedeeld.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl">Met mij gedeeld</h2>
            {metMijGedeeld.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-lg font-semibold">{namen[s.owner_id] ?? "Vriend"}</p>
                <ul className="mt-1 text-base text-muted-foreground">
                  {RECHTEN.filter((r) => s[r.key]).map((r) => (
                    <li key={r.key}>{r.label.replace("Mijn", "Hun")}</li>
                  ))}
                </ul>
                <Button
                  variant="secondary"
                  onClick={() => verwijder.mutate(s.id)}
                  className="mt-3 h-14 w-full text-base"
                >
                  <Trash2 className="size-5" /> Niet meer meedoen
                </Button>
              </div>
            ))}
          </section>
        )}

        <Link
          to="/installeren"
          className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 text-lg font-semibold"
        >
          <Smartphone className="size-6" aria-hidden /> App op je telefoon zetten
        </Link>
      </div>
    </AppShell>
  );
}

function UitnodigingKaart({
  share,
  naam,
  onWijzig,
  onVerwijder,
}: {
  share: Share;
  naam: string | null;
  onWijzig: (patch: Partial<Rechten>) => void;
  onVerwijder: () => void;
}) {
  const [qr, setQr] = useState("");
  const [open, setOpen] = useState(false);
  const link = typeof window === "undefined" ? "" : uitnodigingsLink(share.token);

  useEffect(() => {
    if (!open || share.status === "accepted" || !link) return;
    QRCode.toDataURL(link, { width: 512, margin: 1, color: { dark: "#7a3d22", light: "#faf6ee" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, link, share.status]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">
            {naam ?? share.invited_email ?? "Nog niet aangenomen"}
          </p>
          <p className="text-base text-muted-foreground">
            {share.status === "accepted" ? "Doet mee" : "Wacht op antwoord"}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(!open)} className="h-14 text-base">
          {open ? "Sluiten" : "Instellen"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <ul className="space-y-1">
            {RECHTEN.map((r) => (
              <li
                key={r.key}
                className="flex min-h-14 items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0"
              >
                <Label
                  htmlFor={`${share.id}-${r.key}`}
                  className="text-base font-normal leading-snug"
                >
                  {r.label}
                </Label>
                <Switch
                  id={`${share.id}-${r.key}`}
                  checked={share[r.key]}
                  onCheckedChange={(v) => onWijzig({ [r.key]: v } as Partial<Rechten>)}
                />
              </li>
            ))}
          </ul>

          {share.status !== "accepted" && (
            <div className="space-y-3 rounded-2xl bg-secondary p-4">
              {qr ? (
                <img
                  src={qr}
                  alt="QR-code van de uitnodiging"
                  className="mx-auto size-52 rounded-xl"
                />
              ) : (
                <div className="mx-auto size-52 animate-pulse rounded-xl bg-card" />
              )}
              <p className="break-all text-base text-muted-foreground">{link}</p>
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({ title: "Samen Koken", url: link });
                    } else {
                      await navigator.clipboard.writeText(link);
                      toast.success("Link gekopieerd");
                    }
                  }}
                  className="h-14 flex-1 text-base"
                >
                  <Share2 className="size-5" /> Delen
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link gekopieerd");
                  }}
                  className="h-14 flex-1 text-base"
                >
                  <Copy className="size-5" /> Kopiëren
                </Button>
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={onVerwijder} className="h-14 w-full text-base">
            <Trash2 className="size-5" /> Toegang intrekken
          </Button>
        </div>
      )}
    </div>
  );
}
