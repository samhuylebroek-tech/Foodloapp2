import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  BookUser,
  Check,
  ChefHat,
  Copy,
  Home,
  Plus,
  Search,
  Share2,
  Smartphone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { appOrigin } from "@/lib/app-url";

export const Route = createFileRoute("/vrienden")({
  head: () => ({
    meta: [
      { title: "Vrienden uitnodigen – Foodlo" },
      {
        name: "description",
        content:
          "Nodig vrienden of familie uit met een link, QR-code of e-mail en bepaal zelf wat zij mogen zien en bewerken.",
      },
      { property: "og:title", content: "Vrienden uitnodigen – Foodlo" },
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
  invited_name: string;
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
  return `${appOrigin()}/uitnodiging?code=${token}`;
}

function VriendenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rechten, setRechten] = useState<Rechten>(STANDAARD);
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [nieuwId, setNieuwId] = useState<string | null>(null);
  const [voorWie, setVoorWie] = useState("");
  const [zoek, setZoek] = useState("");
  const [gezocht, setGezocht] = useState("");

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

  const {
    data: gevonden = [],
    isFetching: zoekt,
    isError: zoekMislukt,
  } = useQuery({
    queryKey: ["zoek-gebruiker", gezocht],
    enabled: gezocht.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("zoek_gebruiker", { _term: gezocht.trim() });
      if (error) throw error;
      return (data ?? []) as { id: string; display_name: string; handle: string | null }[];
    },
  });

  const { data: gezinId } = useQuery({
    queryKey: ["gezin-kort", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data?.group_id ?? null;
    },
  });

  const { data: gezinLeden = [] } = useQuery({
    queryKey: ["gezin-leden-kort", gezinId],
    enabled: !!gezinId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, recipes_view, recipes_edit")
        .eq("group_id", gezinId!);
      if (error) throw error;
      return (data ?? []).filter((m) => m.user_id !== user!.id);
    },
  });

  const mijnAlles = shares.filter((s) => s.owner_id === user?.id);
  const metMijGedeeld = shares.filter(
    (s) => s.member_id === user?.id && s.owner_id !== user?.id && s.status === "accepted",
  );
  const voorMij = shares.filter(
    (s) => s.member_id === user?.id && s.owner_id !== user?.id && s.status === "pending",
  );

  const nodigUit = useMutation({
    mutationFn: async (doelId: string) => {
      const { error } = await supabase
        .from("shares")
        .insert({ owner_id: user!.id, member_id: doelId, status: "pending", ...rechten });
      if (error) throw error;
    },
    onSuccess: () => {
      setZoek("");
      setGezocht("");
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["zoek-gebruiker"] });
      toast.success("Uitnodiging verstuurd. Die persoon ziet ze in de app.");
    },
    onError: () => toast.error("Deze persoon is al uitgenodigd of al met jou verbonden."),
  });

  const antwoord = useMutation({
    mutationFn: async ({ token, ja }: { token: string; ja: boolean }) => {
      const { error } = await supabase.rpc(ja ? "accept_share" : "decline_share", { _token: token });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Bewaard");
    },
    onError: () => toast.error("Dat lukte niet"),
  });

  async function uitContacten() {
    type ContactsApi = {
      select: (props: string[], opts: { multiple: boolean }) => Promise<{ email?: string[] }[]>;
    };
    const nav = navigator as Navigator & { contacts?: ContactsApi };
    if (!nav.contacts) {
      toast.info("Je telefoon laat dit niet toe. Zoek op e-mailadres of stuur een link door.");
      return;
    }
    try {
      const keuze = await nav.contacts.select(["name", "email"], { multiple: false });
      const mail = keuze[0]?.email?.[0];
      if (!mail) {
        toast.info("Bij dat contact staat geen e-mailadres.");
        return;
      }
      setZoek(mail);
      setGezocht(mail);
    } catch {
      /* gebruiker annuleerde */
    }
  }

  // Alle mensen waarmee een verbinding bestaat, in beide richtingen.
  const vrienden = (() => {
    const map = new Map<
      string,
      { id: string; ikDeel: Share | null; zijDelen: Share | null; gezin: boolean }
    >();
    for (const m of gezinLeden) {
      map.set(m.user_id, { id: m.user_id, ikDeel: null, zijDelen: null, gezin: true });
    }
    for (const s of shares) {
      if (s.status !== "accepted") continue;
      if (s.owner_id === user?.id && s.member_id) {
        const rij = map.get(s.member_id) ?? {
          id: s.member_id,
          ikDeel: null,
          zijDelen: null,
          gezin: false,
        };
        rij.ikDeel = s;
        map.set(s.member_id, rij);
      } else if (s.member_id === user?.id) {
        const rij = map.get(s.owner_id) ?? {
          id: s.owner_id,
          ikDeel: null,
          zijDelen: null,
          gezin: false,
        };
        rij.zijDelen = s;
        map.set(s.owner_id, rij);
      }
    }
    return [...map.values()];
  })();

  function zoekStatus(id: string) {
    if (gezinLeden.some((m) => m.user_id === id)) return "gezin" as const;
    if (vrienden.some((v) => v.id === id)) return "vriend" as const;
    if (
      shares.some(
        (s) =>
          ((s.owner_id === user?.id && s.member_id === id) ||
            (s.owner_id === id && s.member_id === user?.id)) &&
          s.status === "pending",
      )
    ) {
      return "wacht" as const;
    }
    return "nieuw" as const;
  }

  const maakUitnodiging = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("shares")
        .insert({ owner_id: user!.id, invited_name: voorWie.trim(), ...rechten })
        .select("*")
        .single();
      if (error) throw error;
      return data as Share;
    },
    onSuccess: async (s) => {
      setNieuwOpen(false);
      setNieuwId(s.id);
      setRechten(STANDAARD);
      setVoorWie("");
      qc.invalidateQueries({ queryKey: ["shares"] });
      const link = uitnodigingsLink(s.token);
      try {
        if (navigator.share) {
          await navigator.share({ title: "Foodlo", text: "Doe mee met mijn recepten", url: link });
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

        <Link
          to="/gezin"
          className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3"
        >
          <span className="flex items-center gap-3">
            <Home className="size-6 text-primary" aria-hidden />
            <span className="text-lg font-semibold">
              {gezinId ? "Mijn gezin" : "Kook samen als gezin"}
            </span>
          </span>
          <span className="text-base text-muted-foreground">
            {gezinId ? "Bekijken" : "Starten"}
          </span>
        </Link>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="font-display text-xl">Zoek iemand in Foodlo</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Zoek op naam, @Foodlo-naam of het volledige e-mailadres.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && zoek.trim().length >= 2) setGezocht(zoek.trim());
              }}
              aria-label="Naam, Foodlo-naam of e-mailadres"
              placeholder="Bijvoorbeeld Sofie of @sofie"
              className="h-14 flex-1 text-base"
            />
            <Button
              variant="secondary"
              onClick={() => setGezocht(zoek.trim())}
              disabled={zoek.trim().length < 2}
              className="h-14 text-base"
            >
              <Search className="size-5" /> Zoeken
            </Button>
          </div>
          {zoek.length === 1 && (
            <p className="text-sm text-muted-foreground">Typ minstens 2 tekens.</p>
          )}
          {gezocht.trim().length >= 2 &&
            (zoekt ? (
              <p className="text-base text-muted-foreground">Even zoeken…</p>
            ) : zoekMislukt ? (
              <p className="text-base text-destructive">Zoeken lukte even niet. Probeer opnieuw.</p>
            ) : gevonden.length === 0 ? (
              <p className="text-base text-muted-foreground">
                Niemand gevonden. Controleer de naam of deel een uitnodigingslink.
              </p>
            ) : (
              <div className="space-y-2">
                {gevonden.map((g) => {
                  const status = zoekStatus(g.id);
                  return (
                    <div
                      key={g.id}
                      className="flex min-h-16 items-center justify-between gap-3 rounded-xl bg-secondary p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{g.display_name}</p>
                        {g.handle ? (
                          <p className="truncate text-sm text-muted-foreground">@{g.handle}</p>
                        ) : null}
                      </div>
                      {status === "nieuw" ? (
                        <Button
                          onClick={() => nodigUit.mutate(g.id)}
                          disabled={nodigUit.isPending}
                          className="h-12 shrink-0 text-base"
                        >
                          <UserPlus className="size-5" /> Uitnodigen
                        </Button>
                      ) : (
                        <span className="shrink-0 rounded-full bg-card px-3 py-2 text-sm font-semibold text-muted-foreground">
                          {status === "gezin"
                            ? "Gezinslid"
                            : status === "vriend"
                              ? "Al vriend"
                              : "Uitgenodigd"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </section>

        {voorMij.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl">Uitnodigingen voor jou</h2>
            {voorMij.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-lg font-semibold">
                  {namen[s.owner_id] ?? "Iemand"} wil met je delen
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => antwoord.mutate({ token: s.token, ja: true })}
                    className="h-14 w-full text-base sm:flex-1"
                  >
                    <Check className="size-5" /> Aannemen
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => antwoord.mutate({ token: s.token, ja: false })}
                    className="h-14 w-full text-base sm:flex-1"
                  >
                    Nee, bedankt
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl">Mijn vrienden</h2>
          {vrienden.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
              Je hebt nog geen vrienden toegevoegd. Klik op + om iemand uit te nodigen.
            </p>
          ) : (
            vrienden.map((v) => {
              const zietGerechten =
                v.gezin || !!(v.zijDelen && (v.zijDelen.recipes_view || v.zijDelen.recipes_edit));
              return (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-lg font-semibold">
                  {namen[v.id] ?? "Vriend"}
                  {v.gezin && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      Gezin
                    </span>
                  )}
                </p>
                <p className="mt-1 text-base text-muted-foreground">
                  {v.gezin
                    ? "Jullie delen alles samen"
                    : zietGerechten
                      ? "Deelt zijn of haar gerechten met jou"
                      : "Deelt (nog) geen gerechten met jou"}
                </p>
                {zietGerechten && (
                  <Link
                    to="/vrienden/$id"
                    params={{ id: v.id }}
                    className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground"
                  >
                    <ChefHat className="size-5" aria-hidden /> Bekijk hun gerechten
                  </Link>
                )}
              </div>
              );
            })
          )}
        </section>

        {nieuwOpen && (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Nieuwe uitnodiging</h2>

          <p className="text-base text-muted-foreground">
            Kies eerst wat je vriend mag zien of bewerken. Daarna krijg je een link die je kan
            doorsturen via WhatsApp, sms of hoe je wil. Wie erop klikt, wordt jouw vriend.
          </p>


          <div>
            <Label htmlFor="voor-wie" className="text-base">
              Voor wie is deze uitnodiging?
            </Label>
            <Input
              id="voor-wie"
              value={voorWie}
              onChange={(e) => setVoorWie(e.target.value)}
              placeholder="Bijvoorbeeld: Marie"
              className="mt-2 h-14 text-base"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Zo zie je later meteen naar wie je deze uitnodiging stuurde.
            </p>
          </div>

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

          <div className="space-y-3 rounded-2xl bg-secondary p-4">
            <p className="text-base font-semibold">Kies iemand uit je telefoon</p>
            <Button variant="secondary" onClick={uitContacten} className="h-14 w-full text-base">
              <BookUser className="size-5" /> Kies uit je contacten
            </Button>
          </div>
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
                naam={s.member_id ? (namen[s.member_id] ?? "Vriend") : (s.invited_name || null)}
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
  startOpen = false,
}: {
  share: Share;
  naam: string | null;
  onWijzig: (patch: Partial<Rechten>) => void;
  onVerwijder: () => void;
  startOpen?: boolean;
}) {
  const [qr, setQr] = useState("");
  const [open, setOpen] = useState(startOpen);

  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);
  const link = typeof window === "undefined" ? "" : uitnodigingsLink(share.token);

  useEffect(() => {
    if (!open || share.status === "accepted" || !link) return;
    QRCode.toDataURL(link, { width: 512, margin: 1, color: { dark: "#7a3d22", light: "#faf6ee" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, link, share.status]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold leading-snug">
            {naam ?? share.invited_email ?? "Uitnodiging zonder naam"}
          </p>
          <span
            className={
              share.status === "accepted"
                ? "mt-1 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                : "mt-1 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground"
            }
          >
            {share.status === "accepted" ? "Doet mee" : "Wacht op antwoord"}
          </span>
        </div>
        <Button
          variant="secondary"
          onClick={() => setOpen(!open)}
          className="h-14 w-full text-base sm:w-auto"
        >
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
              <p className="break-all rounded-xl bg-card p-3 text-sm leading-relaxed text-muted-foreground">
                {link}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({ title: "Foodlo", url: link });
                    } else {
                      await navigator.clipboard.writeText(link);
                      toast.success("Link gekopieerd");
                    }
                  }}
                  className="h-14 w-full text-base sm:flex-1"
                >
                  <Share2 className="size-5" /> Delen
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link gekopieerd");
                  }}
                  className="h-14 w-full text-base sm:flex-1"
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
