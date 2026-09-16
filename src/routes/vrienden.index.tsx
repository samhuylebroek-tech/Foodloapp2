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
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { appOrigin } from "@/lib/app-url";
import { beantwoordUitnodiging, nodigUitVriend } from "@/lib/vrienden.functions";
import { beantwoordGezinsUitnodiging } from "@/lib/gezin.functions";

export const Route = createFileRoute("/vrienden/")({
  head: () => ({
    meta: [
      { title: "Vrienden en gezin – Foodlo" },
      {
        name: "description",
        content:
          "Verbind met vrienden of familie en kies zelf per persoon wat zij van jouw recepten, weekmenu en boodschappen zien.",
      },
      { property: "og:title", content: "Vrienden en gezin – Foodlo" },
      {
        property: "og:description",
        content: "Deel je recepten, weekmenu en boodschappenlijst met wie jij kiest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  { key: "planner_view", label: "Mijn weekmenu bekijken" },
  { key: "planner_edit", label: "Mijn weekmenu bewerken" },
  { key: "shopping_view", label: "Mijn boodschappen bekijken" },
  { key: "shopping_edit", label: "Mijn boodschappen bewerken" },
];

const STANDAARD: Rechten = {
  recipes_view: true,
  recipes_edit: false,
  planner_view: false,
  planner_edit: false,
  shopping_view: false,
  shopping_edit: false,
};

function samenvatting(r: Rechten | null, gezin: boolean) {
  if (gezin) return "alles";
  if (!r) return "niets";
  const delen: string[] = [];
  if (r.recipes_view || r.recipes_edit) delen.push("recepten");
  if (r.planner_view || r.planner_edit) delen.push("weekmenu");
  if (r.shopping_view || r.shopping_edit) delen.push("boodschappen");
  return delen.length ? delen.join(", ") : "niets";
}

function uitnodigingsLink(token: string) {
  return `${appOrigin()}/uitnodiging?code=${token}`;
}

type Persoon = {
  id: string;
  gezin: boolean;
  ikDeel: Share | null;
  zijDelen: Share | null;
};

function VriendenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rechten, setRechten] = useState<Rechten>(STANDAARD);
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [nieuwId, setNieuwId] = useState<string | null>(null);
  const [voorWie, setVoorWie] = useState("");
  const [zoek, setZoek] = useState("");
  const [gezocht, setGezocht] = useState("");
  const [keuze, setKeuze] = useState<
    | { modus: "uitnodigen"; id: string; naam: string }
    | { modus: "aannemen"; id: string; naam: string; token: string }
    | null
  >(null);

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

  // Live meeluisteren: aanvaarden of rechten wijzigen is meteen zichtbaar.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("vrienden-shares")
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, () => {
        qc.invalidateQueries({ queryKey: ["shares"] });
        qc.invalidateQueries({ queryKey: ["profielnamen"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

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
        .eq("status", "actief")
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
        .eq("group_id", gezinId!)
        .eq("status", "actief");
      if (error) throw error;
      return (data ?? []).filter((m) => m.user_id !== user!.id);
    },
  });

  // Gezinsuitnodigingen voor jou (nog niet beantwoord).
  const { data: gezinsuitnodigingen = [] } = useQuery({
    queryKey: ["gezinsuitnodigingen", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "uitgenodigd");
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.group_id);
      if (ids.length === 0) return [] as { group_id: string; naam: string; owner_id: string }[];
      const { data: groepen, error: gErr } = await supabase
        .from("groups")
        .select("id, naam, owner_id")
        .in("id", ids);
      if (gErr) throw gErr;
      return (groepen ?? []).map((g) => ({ group_id: g.id, naam: g.naam, owner_id: g.owner_id }));
    },
  });

  // Nieuwe of beantwoorde gezinsuitnodigingen meteen tonen.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("vrienden-gezin")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        qc.invalidateQueries({ queryKey: ["gezinsuitnodigingen"] });
        qc.invalidateQueries({ queryKey: ["gezin-kort"] });
        qc.invalidateQueries({ queryKey: ["gezin-leden-kort"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

  const gezinAntwoord = useMutation({
    mutationFn: async ({ groupId, ja }: { groupId: string; ja: boolean }) =>
      beantwoordGezinsUitnodiging({ data: { groupId, ja } }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["gezinsuitnodigingen"] });
      qc.invalidateQueries({ queryKey: ["gezin-kort"] });
      qc.invalidateQueries({ queryKey: ["gezin-leden-kort"] });
      qc.invalidateQueries({ queryKey: ["gezin"] });
      qc.invalidateQueries({ queryKey: ["planner-gezin"] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      toast.success(vars.ja ? "Je hoort er nu bij!" : "Uitnodiging geweigerd.");
    },
    onError: () => toast.error("Dat lukte niet. Probeer het opnieuw."),
  });

  const mijnAlles = shares.filter((s) => s.owner_id === user?.id);
  const voorMij = shares.filter(
    (s) => s.member_id === user?.id && s.owner_id !== user?.id && s.status === "pending",
  );

  const nodigUit = useMutation({
    mutationFn: async ({ doelId, kies }: { doelId: string; kies: Rechten }) =>
      nodigUitVriend({ data: { doelId, rechten: kies } }),
    onSuccess: (res) => {
      setKeuze(null);
      qc.invalidateQueries({ queryKey: ["shares"] });
      if (!res.ok) {
        toast.info("Deze persoon is al uitgenodigd of al met jou verbonden.");
        return;
      }
      setZoek("");
      setGezocht("");
      toast.success("Uitnodiging verstuurd. Die persoon krijgt meteen een bericht.");
    },
    onError: () => toast.error("De uitnodiging versturen lukte niet."),
  });

  const antwoord = useMutation({
    mutationFn: async ({
      token,
      ja,
      kies,
    }: {
      token: string;
      ja: boolean;
      kies?: Rechten | null;
    }) => beantwoordUitnodiging({ data: { token, ja, terug: kies ?? null } }),
    onSuccess: (res, vars) => {
      setKeuze(null);
      qc.invalidateQueries({ queryKey: ["shares"] });
      if (!vars.ja) {
        toast.success("Uitnodiging geweigerd.");
        return;
      }
      if (res.terugGedeeld === false) {
        toast.info("Jullie zijn verbonden. Wat jij deelt, stel je in bij die persoon.");
        return;
      }
      toast.success("Gelukt! Jullie zijn nu verbonden.");
    },
    onError: () => toast.error("Dat lukte niet. Probeer het opnieuw."),
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
      const gekozen = await nav.contacts.select(["name", "email"], { multiple: false });
      const mail = gekozen[0]?.email?.[0];
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
  const vrienden: Persoon[] = (() => {
    const map = new Map<string, Persoon>();
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

  // Namen van iedereen waarmee al een verbinding of uitnodiging loopt.
  const verbondenNamen = new Set<string>(
    [
      ...vrienden.map((v) => namen[v.id]),
      ...shares
        .filter((s) => s.status === "pending" && s.member_id)
        .map((s) => namen[s.owner_id === user?.id ? s.member_id! : s.owner_id]),
    ]
      .filter(Boolean)
      .map((n) => n!.trim().toLowerCase()),
  );

  // Losse linkuitnodigingen verbergen zodra die persoon al in de app zit.
  const linkUitnodigingen = mijnAlles.filter((s) => {
    if (s.member_id) return false;
    const naam = s.invited_name.trim().toLowerCase();
    if (!naam) return true;
    return ![...verbondenNamen].some((v) => v === naam || v.includes(naam) || naam.includes(v));
  });

  const gevraagd = mijnAlles.filter((s) => s.member_id && s.status === "pending");

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
    mutationFn: async ({
      persoon,
      key,
      waarde,
    }: {
      persoon: Persoon;
      key: keyof Rechten;
      waarde: boolean;
    }) => {
      const patch: Partial<Rechten> = { [key]: waarde };
      if (waarde && key.endsWith("_edit")) {
        patch[key.replace("_edit", "_view") as keyof Rechten] = true;
      }
      if (persoon.ikDeel) {
        const { error } = await supabase.from("shares").update(patch).eq("id", persoon.ikDeel.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("shares").insert({
        owner_id: user!.id,
        member_id: persoon.id,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        ...patch,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares"] }),
    onError: () => toast.error("Wijzigen lukte niet"),
  });

  const verwijder = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from("shares").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Verbinding verbroken");
    },
    onError: () => toast.error("Dat lukte niet"),
  });

  return (
    <AppShell title="Vrienden en gezin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-lg leading-relaxed">
            Hier staan de mensen waarmee je kookt. Klik op + om iemand uit te nodigen.
          </p>
          <button
            type="button"
            onClick={() => setNieuwOpen((v) => !v)}
            aria-label={nieuwOpen ? "Uitnodiging sluiten" : "Iemand toevoegen"}
            aria-expanded={nieuwOpen}
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
          >
            {nieuwOpen ? <X className="size-8" aria-hidden /> : <Plus className="size-8" aria-hidden />}
          </button>
        </div>

        {(voorMij.length > 0 || gezinsuitnodigingen.length > 0) && (
          <section className="space-y-3 rounded-3xl border-2 border-primary/40 bg-primary/5 p-4">
            <h2 className="font-display text-xl">
              Uitnodigingen voor jou ({voorMij.length + gezinsuitnodigingen.length})
            </h2>
            {gezinsuitnodigingen.map((g) => (
              <div key={g.group_id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar naam={g.naam} sleutel={g.group_id} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">Gezin “{g.naam}”</p>
                    <p className="text-base text-muted-foreground">
                      Je bent uitgenodigd om lid te worden
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => gezinAntwoord.mutate({ groupId: g.group_id, ja: true })}
                    disabled={gezinAntwoord.isPending}
                    className="h-14 w-full text-base sm:flex-1"
                  >
                    <Check className="size-5" /> Aannemen
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => gezinAntwoord.mutate({ groupId: g.group_id, ja: false })}
                    disabled={gezinAntwoord.isPending}
                    className="h-14 w-full text-base sm:flex-1"
                  >
                    Nee, bedankt
                  </Button>
                </div>
              </div>
            ))}
            {voorMij.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar naam={namen[s.owner_id] ?? "Iemand"} sleutel={s.owner_id} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">
                      {namen[s.owner_id] ?? "Iemand"}
                    </p>
                    <p className="text-base text-muted-foreground">
                      Wil {samenvatting(s, false)} met jou delen
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() =>
                      setKeuze({
                        modus: "aannemen",
                        id: s.owner_id,
                        naam: namen[s.owner_id] ?? "deze persoon",
                        token: s.token,
                      })
                    }
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
          <h2 className="font-display text-xl">Mijn mensen</h2>
          {vrienden.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
              Je hebt nog niemand toegevoegd. Klik op + om iemand uit te nodigen.
            </p>
          ) : (
            vrienden.map((v) => (
              <PersoonKaart
                key={v.id}
                persoon={v}
                naam={namen[v.id] ?? "Vriend"}
                onWijzig={(key, waarde) => wijzig.mutate({ persoon: v, key, waarde })}
                onVerbreek={() =>
                  verwijder.mutate(
                    [v.ikDeel?.id, v.zijDelen?.id].filter((x): x is string => Boolean(x)),
                  )
                }
              />
            ))
          )}
        </section>

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
          <span className="text-base text-muted-foreground">{gezinId ? "Bekijken" : "Starten"}</span>
        </Link>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="font-display text-xl">Iemand toevoegen</h2>
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
          {zoek.length === 1 && <p className="text-sm text-muted-foreground">Typ minstens 2 tekens.</p>}
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
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar naam={g.display_name} sleutel={g.id} className="size-12" />
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold">{g.display_name}</p>
                          {g.handle ? (
                            <p className="truncate text-sm text-muted-foreground">@{g.handle}</p>
                          ) : null}
                        </div>
                      </div>
                      {status === "nieuw" ? (
                        <Button
                          onClick={() =>
                            setKeuze({ modus: "uitnodigen", id: g.id, naam: g.display_name })
                          }
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

        {nieuwOpen && (
          <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
            <h2 className="font-display text-xl">Uitnodiging met een link</h2>

            <p className="text-base text-muted-foreground">
              Kies eerst wat je wil delen. Daarna krijg je een link die je kan doorsturen via
              WhatsApp, sms of hoe je wil. Wie erop klikt, wordt jouw vriend.
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

        {(gevraagd.length > 0 || linkUitnodigingen.length > 0) && (
          <section className="space-y-3">
            <h2 className="font-display text-xl">Wacht op antwoord</h2>
            {gevraagd.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    naam={namen[s.member_id!] ?? "Vriend"}
                    sleutel={s.member_id!}
                    className="size-12"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">
                      {namen[s.member_id!] ?? "Vriend"}
                    </p>
                    <p className="text-base text-muted-foreground">Uitgenodigd</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => verwijder.mutate([s.id])}
                  className="h-12 shrink-0 text-base"
                >
                  Intrekken
                </Button>
              </div>
            ))}
            {linkUitnodigingen.map((s) => (
              <UitnodigingKaart
                key={s.id}
                share={s}
                naam={s.invited_name || null}
                startOpen={s.id === nieuwId}
                onWijzig={async (patch) => {
                  const { error } = await supabase.from("shares").update(patch).eq("id", s.id);
                  if (error) toast.error("Wijzigen lukte niet");
                  else qc.invalidateQueries({ queryKey: ["shares"] });
                }}
                onVerwijder={() => verwijder.mutate([s.id])}
              />
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

      {keuze ? (
        <RechtenVenster
          titel={
            keuze.modus === "uitnodigen"
              ? `Wat wil je delen met ${keuze.naam}?`
              : `Wat deel jij met ${keuze.naam}?`
          }
          uitleg={
            keuze.modus === "uitnodigen"
              ? "Kies wat deze persoon van jou mag zien. Je kan dit later altijd aanpassen."
              : "Je neemt de uitnodiging aan. Kies nu wat jij op jouw beurt deelt — dat mag ook niets zijn."
          }
          bevestig={keuze.modus === "uitnodigen" ? "Uitnodiging versturen" : "Aannemen"}
          bezig={nodigUit.isPending || antwoord.isPending}
          extraKnop={keuze.modus === "aannemen" ? "Aannemen, nu niets delen" : null}
          onExtra={() =>
            antwoord.mutate({ token: (keuze as { token: string }).token, ja: true, kies: null })
          }
          onSluiten={() => setKeuze(null)}
          onBevestig={(kies) => {
            if (keuze.modus === "uitnodigen") {
              nodigUit.mutate({ doelId: keuze.id, kies });
            } else {
              antwoord.mutate({ token: keuze.token, ja: true, kies });
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}

function PersoonKaart({
  persoon,
  naam,
  onWijzig,
  onVerbreek,
}: {
  persoon: Persoon;
  naam: string;
  onWijzig: (key: keyof Rechten, waarde: boolean) => void;
  onVerbreek: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ik = persoon.ikDeel;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar naam={naam} sleutel={persoon.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">
            {naam}
            <span
              className={
                persoon.gezin
                  ? "ml-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                  : "ml-2 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground"
              }
            >
              {persoon.gezin ? "Gezin" : "Vriend"}
            </span>
          </p>
          <p className="mt-1 text-base text-muted-foreground">
            Jij deelt: {samenvatting(ik, persoon.gezin)}
          </p>
          <p className="text-base text-muted-foreground">
            Zij delen: {samenvatting(persoon.zijDelen, persoon.gezin)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/vrienden/$id"
          params={{ id: persoon.id }}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground sm:flex-1"
        >
          <ChefHat className="size-5" aria-hidden /> Openen
        </Link>
        {!persoon.gezin && (
          <Button
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
            className="h-14 w-full text-base sm:flex-1"
          >
            {open ? "Sluiten" : `Wat mag ${naam} zien?`}
          </Button>
        )}
      </div>

      {open && !persoon.gezin && (
        <div className="mt-4 space-y-4">
          <ul className="space-y-1">
            {RECHTEN.map((r) => (
              <li
                key={r.key}
                className="flex min-h-14 items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0"
              >
                <Label
                  htmlFor={`${persoon.id}-${r.key}`}
                  className="text-base font-normal leading-snug"
                >
                  {r.label}
                </Label>
                <Switch
                  id={`${persoon.id}-${r.key}`}
                  checked={Boolean(ik?.[r.key])}
                  onCheckedChange={(v) => onWijzig(r.key, v)}
                />
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={onVerbreek} className="h-14 w-full text-base">
            <Trash2 className="size-5" /> Verbinding verbreken
          </Button>
        </div>
      )}
    </div>
  );
}

function RechtenVenster({
  titel,
  uitleg,
  bevestig,
  bezig,
  extraKnop,
  onExtra,
  onBevestig,
  onSluiten,
}: {
  titel: string;
  uitleg: string;
  bevestig: string;
  bezig: boolean;
  extraKnop: string | null;
  onExtra: () => void;
  onBevestig: (rechten: Rechten) => void;
  onSluiten: () => void;
}) {
  const [kies, setKies] = useState<Rechten>(STANDAARD);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-card p-5 sm:rounded-[2rem]">
        <h2 className="font-display text-xl">{titel}</h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">{uitleg}</p>

        <div className="mt-4 space-y-2">
          {RECHTEN.map((r) => (
            <label
              key={r.key}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-2"
            >
              <Label className="text-base">{r.label}</Label>
              <Switch
                checked={kies[r.key]}
                onCheckedChange={(v) =>
                  setKies((h) => ({
                    ...h,
                    [r.key]: v,
                    ...(v && r.key.endsWith("_edit")
                      ? { [r.key.replace("_edit", "_view")]: true }
                      : {}),
                  }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <Button onClick={() => onBevestig(kies)} disabled={bezig} className="h-14 w-full text-base">
            <Check className="size-5" /> {bevestig}
          </Button>
          {extraKnop ? (
            <Button variant="secondary" onClick={onExtra} disabled={bezig} className="h-14 w-full text-base">
              {extraKnop}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onSluiten} className="h-14 w-full text-base">
            Annuleren
          </Button>
        </div>
      </div>
    </div>
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
    if (!open || !link) return;
    QRCode.toDataURL(link, { width: 512, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, link]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold leading-snug">
            {naam ?? share.invited_email ?? "Uitnodiging zonder naam"}
          </p>
          <span className="mt-1 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground">
            Link verstuurd
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
                <Label htmlFor={`${share.id}-${r.key}`} className="text-base font-normal leading-snug">
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

          <div className="space-y-3 rounded-2xl bg-secondary p-4">
            {qr ? (
              <img src={qr} alt="QR-code van de uitnodiging" className="mx-auto size-52 rounded-xl" />
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

          <Button variant="secondary" onClick={onVerwijder} className="h-14 w-full text-base">
            <Trash2 className="size-5" /> Uitnodiging intrekken
          </Button>
        </div>
      )}
    </div>
  );
}
