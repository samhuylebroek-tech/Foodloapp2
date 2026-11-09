import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Check,
  ChefHat,
  ChevronRight,
  Copy,
  Home,
  LogOut,
  Search,
  Share2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { appOrigin } from "@/lib/app-url";
import { beantwoordGezinsUitnodiging, nodigUitGezin } from "@/lib/gezin.functions";
import { Groep, KnopRij, Paneel } from "@/components/mobiel/Lijst";
import { PageSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/gezin")({
  head: () => ({
    meta: [
      { title: "Mijn gezin – Foodlo" },
      {
        name: "description",
        content:
          "Zet je gezin samen in één omgeving: iedereen ziet en bewerkt dezelfde recepten, weekmenu en boodschappenlijst.",
      },
      { property: "og:title", content: "Mijn gezin – Foodlo" },
      {
        property: "og:description",
        content: "Mama, papa en de rest van het gezin koken samen in dezelfde omgeving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GezinPage,
});

type Rechten = {
  recipes_view: boolean;
  recipes_edit: boolean;
  planner_view: boolean;
  planner_edit: boolean;
  shopping_view: boolean;
  shopping_edit: boolean;
};

type Lid = Rechten & {
  id: string;
  group_id: string;
  user_id: string;
  rol: string;
  status: string;
};

type Groep = { id: string; naam: string; owner_id: string; token: string };

const RECHTEN: { key: keyof Rechten; label: string }[] = [
  { key: "recipes_view", label: "Mijn recepten bekijken" },
  { key: "recipes_edit", label: "Mijn recepten bewerken" },
  { key: "planner_view", label: "Mijn weekmenu bekijken" },
  { key: "planner_edit", label: "Mijn weekmenu bewerken" },
  { key: "shopping_view", label: "Mijn boodschappen bekijken" },
  { key: "shopping_edit", label: "Mijn boodschappen bewerken" },
];

function gezinsLink(token: string) {
  return `${appOrigin()}/uitnodiging?groep=${token}`;
}

function GezinPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [naam, setNaam] = useState("Ons gezin");
  const [qr, setQr] = useState("");
  const [zoek, setZoek] = useState("");
  const [gezocht, setGezocht] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["gezin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: eigen, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "actief")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!eigen) return null;
      const [{ data: groep }, { data: leden }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", eigen.group_id).maybeSingle(),
        supabase.from("group_members").select("*").eq("group_id", eigen.group_id),
      ]);
      if (!groep) return null;
      return { groep: groep as Groep, leden: (leden ?? []) as Lid[] };
    },
  });

  // Staat er een gezinsuitnodiging voor jou klaar? Dan toont het startscherm die.
  const { data: uitnodiging } = useQuery({
    queryKey: ["gezin-uitnodiging", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rij, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "uitgenodigd")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!rij) return null;
      const { data: groep } = await supabase
        .from("groups")
        .select("id, naam")
        .eq("id", rij.group_id)
        .maybeSingle();
      return groep ? ({ id: groep.id, naam: groep.naam } as { id: string; naam: string }) : null;
    },
  });

  const gezinAntwoord = useMutation({
    mutationFn: async ({ groupId, ja }: { groupId: string; ja: boolean }) =>
      beantwoordGezinsUitnodiging({ data: { groupId, ja } }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["gezin-uitnodiging"] });
      qc.invalidateQueries({ queryKey: ["gezin"] });
      qc.invalidateQueries({ queryKey: ["planner-gezin"] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      toast.success(vars.ja ? "Je hoort er nu bij!" : "Uitnodiging geweigerd.");
    },
    onError: () => toast.error("Dat lukte niet. Probeer het opnieuw."),
  });

  // Live meeluisteren: nieuwe leden en antwoorden zijn meteen zichtbaar.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("gezin-leden")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        qc.invalidateQueries({ queryKey: ["gezin"] });
        qc.invalidateQueries({ queryKey: ["gezinnamen"] });
        qc.invalidateQueries({ queryKey: ["gezin-uitnodiging"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

  const ids = (data?.leden ?? []).map((l) => l.user_id);
  const { data: namen = {} } = useQuery({
    queryKey: ["gezinnamen", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (error) throw error;
      return Object.fromEntries(p.map((r) => [r.id, r.display_name])) as Record<string, string>;
    },
  });

  const link = data ? gezinsLink(data.groep.token) : "";
  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { width: 512, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [link]);

  const {
    data: gevonden = [],
    isFetching: zoekt,
    isError: zoekMislukt,
  } = useQuery({
    queryKey: ["zoek-gebruiker", gezocht],
    enabled: gezocht.trim().length >= 2,
    queryFn: async () => {
      const { data: r, error } = await supabase.rpc("zoek_gebruiker", { _term: gezocht.trim() });
      if (error) throw error;
      return (r ?? []) as { id: string; display_name: string; handle: string | null }[];
    },
  });

  const maakGezin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("groups")
        .insert({ naam: naam.trim() || "Ons gezin", owner_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gezin"] });
      toast.success("Je gezin staat klaar. Nodig nu de anderen uit.");
    },
    onError: () => toast.error("Het gezin maken lukte niet"),
  });

  const nodigUit = useMutation({
    mutationFn: async (doelId: string) =>
      nodigUitGezin({ data: { groupId: data!.groep.id, doelId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["gezin"] });
      if (!res.ok) {
        toast.info(
          res.reden === "bestaat"
            ? "Deze persoon is al uitgenodigd of hoort er al bij."
            : "De uitnodiging lukte niet.",
        );
        return;
      }
      setZoek("");
      setGezocht("");
      toast.success("Uitnodiging verstuurd. Die persoon krijgt meteen een bericht.");
    },
    onError: () => toast.error("De uitnodiging versturen lukte niet"),
  });

  const wijzigRechten = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Rechten> }) => {
      const { error } = await supabase.from("group_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gezin"] }),
    onError: () => toast.error("Aanpassen lukte niet"),
  });

  const hernoem = useMutation({
    mutationFn: async (nieuw: string) => {
      const { error } = await supabase
        .from("groups")
        .update({ naam: nieuw })
        .eq("id", data!.groep.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gezin"] }),
  });

  const verwijderLid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gezin"] });
      toast.success("Aangepast");
    },
    onError: () => toast.error("Dat lukte niet"),
  });

  const ikBenEigenaar = data?.groep.owner_id === user?.id;
  const mijnRij = data?.leden.find((l) => l.user_id === user?.id);

  const actieveLeden = data?.leden.filter((l) => l.status === "actief") ?? [];
  const naamVan = (id: string) =>
    id === user?.id ? (namen[id] ?? "Jij") : (namen[id] ?? "Gezinslid");

  async function deelLink() {
    try {
      if (navigator.share) await navigator.share({ title: "Foodlo", url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Link gekopieerd");
      }
    } catch {
      /* gebruiker annuleerde */
    }
  }

  return (
    <AppShell title="Mijn gezin">
      <div className="space-y-7">
        {isLoading ? (
          <PageSkeleton rows={2} />
        ) : !data ? (
          <>
            {uitnodiging && (
              <div className="rounded-[1.25rem] bg-honing-zacht p-4 ring-1 ring-honing/40">
                <p className="text-lg font-semibold text-honing-foreground">
                  Je bent uitgenodigd voor gezin “{uitnodiging.naam}”
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => gezinAntwoord.mutate({ groupId: uitnodiging.id, ja: true })}
                    disabled={gezinAntwoord.isPending}
                  >
                    <Check className="size-5" /> Aannemen
                  </Button>
                  <Button
                    variant="zacht"
                    onClick={() => gezinAntwoord.mutate({ groupId: uitnodiging.id, ja: false })}
                    disabled={gezinAntwoord.isPending}
                  >
                    Nee, bedankt
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-[1.5rem] bg-inkt p-6 text-inkt-foreground shadow-kaart">
              <span className="flex size-14 items-center justify-center rounded-full bg-honing text-honing-foreground">
                <Home className="size-7" aria-hidden />
              </span>
              <h2 className="mt-4 text-sectietitel">Kook samen als gezin</h2>
              <p className="mt-2 text-base text-inkt-zacht">
                Deel recepten, je weekmenu en boodschappen met de mensen thuis.
              </p>
            </div>
            <Paneel>
              <Label htmlFor="gezinnaam">Hoe noem je jullie gezin?</Label>
              <Input
                id="gezinnaam"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className="mt-2"
              />
              <Button
                onClick={() => maakGezin.mutate()}
                disabled={maakGezin.isPending}
                className="mt-3 w-full"
              >
                <UserPlus className="size-5" /> Gezin starten
              </Button>
            </Paneel>
          </>
        ) : (
          <>
            {/* Kop van het gezin: naam en wie erbij hoort, in één oogopslag. */}
            <div className="rounded-[1.5rem] bg-inkt p-5 text-inkt-foreground shadow-kaart">
              <p className="text-label text-inkt-zacht">Jullie gezin</p>
              <h2 className="mt-1 text-sectietitel">{data.groep.naam}</h2>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {actieveLeden.slice(0, 5).map((l) => (
                    <Avatar
                      key={l.id}
                      naam={naamVan(l.user_id)}
                      sleutel={l.user_id}
                      className="size-11 ring-2 ring-inkt"
                    />
                  ))}
                </div>
                <p className="text-base text-inkt-zacht">
                  {actieveLeden.length === 1 ? "1 lid" : `${actieveLeden.length} leden`}
                </p>
              </div>
            </div>

            <Groep titel="Wie hoort erbij">
              {actieveLeden.map((l) => {
                const ik = l.user_id === user?.id;
                return (
                  <div key={l.id} className="flex min-h-18 items-center gap-1 pr-2">
                    {ik ? (
                      <div className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3">
                        <Avatar naam={naamVan(l.user_id)} sleutel={l.user_id} className="size-11" />
                        <span className="min-w-0">
                          <span className="block text-[1.05rem] font-semibold">Jij</span>
                          {l.rol === "eigenaar" && (
                            <span className="block text-[0.95rem] text-muted-foreground">
                              heeft het gezin gestart
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <Link
                        to="/vrienden/$id"
                        params={{ id: l.user_id }}
                        className="flex min-h-16 min-w-0 flex-1 items-center gap-3.5 rounded-xl px-4 py-3 hover:bg-muted/70"
                      >
                        <Avatar naam={naamVan(l.user_id)} sleutel={l.user_id} className="size-11" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[1.05rem] font-semibold">
                            {naamVan(l.user_id)}
                          </span>
                          <span className="flex items-center gap-1 text-[0.95rem] text-primary">
                            <ChefHat className="size-4" aria-hidden /> Bekijk hun gerechten
                          </span>
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    )}
                    {ikBenEigenaar && !ik && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Wil je deze persoon echt uit het gezin halen?"))
                            verwijderLid.mutate(l.id);
                        }}
                        aria-label={`Uit het gezin halen: ${naamVan(l.user_id)}`}
                        className="flex size-12 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-muted"
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })}
            </Groep>

            {data.leden.some((l) => l.status === "uitgenodigd") && (
              <Groep titel="Wacht op antwoord">
                {data.leden
                  .filter((l) => l.status === "uitgenodigd")
                  .map((l) => (
                    <div key={l.id} className="flex min-h-16 items-center gap-3.5 px-4 py-3">
                      <Avatar
                        naam={namen[l.user_id] ?? "Gezinslid"}
                        sleutel={l.user_id}
                        className="size-11 opacity-70"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[1.05rem] font-semibold">
                          {namen[l.user_id] ?? "Gezinslid"}
                        </span>
                        <span className="block text-[0.95rem] text-muted-foreground">
                          Uitgenodigd
                        </span>
                      </span>
                      {ikBenEigenaar && (
                        <Button
                          variant="zacht"
                          size="sm"
                          onClick={() => verwijderLid.mutate(l.id)}
                          className="shrink-0"
                        >
                          <X className="size-5" /> Intrekken
                        </Button>
                      )}
                    </div>
                  ))}
              </Groep>
            )}

            <Groep
              titel="Iemand uitnodigen"
              voet="Deel deze link met wie erbij hoort. Wie erop klikt, komt in jullie gezin."
            >
              <div className="space-y-3 p-4">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="search"
                      value={zoek}
                      onChange={(e) => setZoek(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && zoek.trim().length >= 2) setGezocht(zoek.trim());
                      }}
                      aria-label="Naam, Foodlo-naam of e-mailadres"
                      placeholder="Sofie of @sofie"
                      className="pl-11"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setGezocht(zoek.trim())}
                    disabled={zoek.trim().length < 2}
                    className="shrink-0 px-5"
                  >
                    Zoeken
                  </Button>
                </div>
                {gezocht.trim().length >= 2 &&
                  (zoekt ? (
                    <p role="status" className="text-base text-muted-foreground">
                      Even zoeken…
                    </p>
                  ) : zoekMislukt ? (
                    <p role="alert" className="text-base text-destructive">
                      Zoeken lukte even niet.
                    </p>
                  ) : gevonden.length === 0 ? (
                    <p role="status" className="text-base text-muted-foreground">
                      Niemand gevonden. Deel anders de link of QR-code hieronder.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {gevonden.map((g) => {
                        const lid = data.leden.find((l) => l.user_id === g.id);
                        return (
                          <li
                            key={g.id}
                            className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted p-3"
                          >
                            <Avatar naam={g.display_name} sleutel={g.id} className="size-11" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold">{g.display_name}</p>
                              {g.handle ? (
                                <p className="truncate text-[0.95rem] text-muted-foreground">
                                  @{g.handle}
                                </p>
                              ) : null}
                            </div>
                            {lid ? (
                              <span className="shrink-0 rounded-full bg-card px-3 py-1.5 text-[0.95rem] font-semibold text-muted-foreground">
                                {lid.status === "actief" ? "Hoort erbij" : "Uitgenodigd"}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => nodigUit.mutate(g.id)}
                                disabled={nodigUit.isPending}
                                className="shrink-0"
                              >
                                <UserPlus className="size-5" /> Uitnodigen
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ))}
              </div>
              <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center">
                {qr ? (
                  <img
                    src={qr}
                    alt="QR-code van de gezinsuitnodiging"
                    className="size-40 shrink-0 rounded-2xl bg-white p-2 ring-1 ring-border"
                  />
                ) : null}
                <div className="grid w-full gap-2">
                  <Button onClick={() => void deelLink()} className="w-full">
                    <Share2 className="size-5" /> Uitnodiging delen
                  </Button>
                  <Button
                    variant="zacht"
                    onClick={async () => {
                      await navigator.clipboard.writeText(link);
                      toast.success("Link gekopieerd");
                    }}
                    className="w-full"
                  >
                    <Copy className="size-5" /> Kopiëren
                  </Button>
                </div>
              </div>
            </Groep>

            {mijnRij && (
              <Groep titel="Wat deel ik met het gezin?">
                {RECHTEN.map((r) => (
                  <div key={r.key} className="flex min-h-16 items-center gap-4 px-4 py-3">
                    <Label
                      htmlFor={`gezin-${r.key}`}
                      className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug"
                    >
                      {r.label}
                    </Label>
                    <Switch
                      id={`gezin-${r.key}`}
                      checked={mijnRij[r.key]}
                      onCheckedChange={(v) =>
                        wijzigRechten.mutate({
                          id: mijnRij.id,
                          patch: { [r.key]: v } as Partial<Rechten>,
                        })
                      }
                    />
                  </div>
                ))}
              </Groep>
            )}

            {ikBenEigenaar && (
              <Groep titel="Naam van het gezin">
                <div className="p-4">
                  <Input
                    defaultValue={data.groep.naam}
                    aria-label="Naam van het gezin"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== data.groep.naam) hernoem.mutate(v);
                    }}
                  />
                </div>
              </Groep>
            )}

            {mijnRij && (
              <Groep>
                <KnopRij
                  icoon={LogOut}
                  gevaar
                  titel="Het gezin verlaten"
                  onClick={() => {
                    if (window.confirm("Wil je het gezin echt verlaten?"))
                      verwijderLid.mutate(mijnRij.id);
                  }}
                />
              </Groep>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
