import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { ChefHat, Copy, Home, LogOut, Search, Share2, Trash2, UserPlus, X } from "lucide-react";
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
import { nodigUitGezin } from "@/lib/gezin.functions";

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

  // Live meeluisteren: nieuwe leden en antwoorden zijn meteen zichtbaar.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("gezin-leden")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        qc.invalidateQueries({ queryKey: ["gezin"] });
        qc.invalidateQueries({ queryKey: ["gezinnamen"] });
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

  return (
    <AppShell title="Mijn gezin">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-base text-muted-foreground">Even geduld…</p>
        ) : !data ? (
          <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Home className="size-7" aria-hidden />
            </div>
            <h2 className="font-display text-xl">Kook samen als gezin</h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              In een gezin zien en bewerken jullie elkaars recepten, weekmenu en boodschappenlijst.
              Alsof jullie in dezelfde keuken staan. Je kan later nog per onderdeel kiezen wat je
              deelt.
            </p>
            <div>
              <Label htmlFor="gezinnaam" className="text-base">
                Hoe noem je jullie gezin?
              </Label>
              <Input
                id="gezinnaam"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className="mt-2 h-14 text-base"
              />
            </div>
            <Button
              onClick={() => maakGezin.mutate()}
              disabled={maakGezin.isPending}
              className="h-16 w-full text-lg"
            >
              <UserPlus className="size-5" /> Gezin starten
            </Button>
          </section>
        ) : (
          <>
            <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
              <h2 className="font-display text-xl">{data.groep.naam}</h2>
              {ikBenEigenaar && (
                <Input
                  defaultValue={data.groep.naam}
                  aria-label="Naam van het gezin"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== data.groep.naam) hernoem.mutate(v);
                  }}
                  className="h-14 text-base"
                />
              )}
              <p className="text-base text-muted-foreground">
                Deel deze link met wie erbij hoort. Wie erop klikt, komt in jullie gezin.
              </p>
              {qr ? (
                <img src={qr} alt="QR-code van de gezinsuitnodiging" className="mx-auto size-48 rounded-xl" />
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={async () => {
                    try {
                      if (navigator.share) await navigator.share({ title: "Foodlo", url: link });
                      else {
                        await navigator.clipboard.writeText(link);
                        toast.success("Link gekopieerd");
                      }
                    } catch {
                      /* gebruiker annuleerde */
                    }
                  }}
                  className="h-14 w-full text-base sm:flex-1"
                >
                  <Share2 className="size-5" /> Uitnodiging delen
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
            </section>

            <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
              <h2 className="font-display text-xl">Iemand uitnodigen</h2>
              <p className="text-base text-muted-foreground">
                Zoek op naam, @Foodlo-naam of het volledige e-mailadres. Die persoon krijgt meteen
                een bericht in de app.
              </p>
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
              {gezocht.trim().length >= 2 &&
                (zoekt ? (
                  <p className="text-base text-muted-foreground">Even zoeken…</p>
                ) : zoekMislukt ? (
                  <p className="text-base text-destructive">Zoeken lukte even niet.</p>
                ) : gevonden.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    Niemand gevonden. Deel anders de link of QR-code hierboven.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gevonden.map((g) => {
                      const lid = data.leden.find((l) => l.user_id === g.id);
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
                                <p className="truncate text-sm text-muted-foreground">
                                  @{g.handle}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {lid ? (
                            <span className="shrink-0 rounded-full bg-card px-3 py-2 text-sm font-semibold text-muted-foreground">
                              {lid.status === "actief" ? "Hoort erbij" : "Uitgenodigd"}
                            </span>
                          ) : (
                            <Button
                              onClick={() => nodigUit.mutate(g.id)}
                              disabled={nodigUit.isPending}
                              className="h-12 shrink-0 text-base"
                            >
                              <UserPlus className="size-5" /> Uitnodigen
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </section>

            {data.leden.some((l) => l.status === "uitgenodigd") && (
              <section className="space-y-3">
                <h2 className="font-display text-xl">Wacht op antwoord</h2>
                {data.leden
                  .filter((l) => l.status === "uitgenodigd")
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          naam={namen[l.user_id] ?? "Gezinslid"}
                          sleutel={l.user_id}
                          className="size-12"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold">
                            {namen[l.user_id] ?? "Gezinslid"}
                          </p>
                          <p className="text-base text-muted-foreground">Uitgenodigd</p>
                        </div>
                      </div>
                      {ikBenEigenaar && (
                        <Button
                          variant="secondary"
                          onClick={() => verwijderLid.mutate(l.id)}
                          className="h-12 shrink-0 text-base"
                        >
                          <X className="size-5" /> Intrekken
                        </Button>
                      )}
                    </div>
                  ))}
              </section>
            )}

            <section className="space-y-3">
              <h2 className="font-display text-xl">Wie hoort erbij</h2>
              {data.leden
                .filter((l) => l.status === "actief")
                .map((l) => (
                <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      naam={l.user_id === user?.id ? (namen[l.user_id] ?? "Jij") : (namen[l.user_id] ?? "Gezinslid")}
                      sleutel={l.user_id}
                      className="size-12"
                    />
                    <p className="min-w-0 flex-1 truncate text-lg font-semibold">
                      {l.user_id === user?.id ? "Jij" : (namen[l.user_id] ?? "Gezinslid")}{" "}
                      {l.rol === "eigenaar" && (
                        <span className="ml-2 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground">
                          gestart door
                        </span>
                      )}
                    </p>
                  </div>
                  {l.user_id !== user?.id && (
                    <Link
                      to="/vrienden/$id"
                      params={{ id: l.user_id }}
                      className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground"
                    >
                      <ChefHat className="size-5" aria-hidden /> Bekijk hun gerechten
                    </Link>
                  )}
                  {ikBenEigenaar && l.user_id !== user?.id && (
                    <Button
                      variant="secondary"
                      onClick={() => verwijderLid.mutate(l.id)}
                      className="mt-3 h-14 w-full text-base"
                    >
                      <Trash2 className="size-5" /> Uit het gezin halen
                    </Button>
                  )}
                </div>
              ))}
            </section>

            {mijnRij && (
              <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
                <h2 className="font-display text-xl">Wat deel ik met het gezin?</h2>
                <p className="text-base text-muted-foreground">
                  Standaard deel je alles. Zet gerust iets af als je dat liever voor jezelf houdt.
                </p>
                <ul className="space-y-1">
                  {RECHTEN.map((r) => (
                    <li
                      key={r.key}
                      className="flex min-h-14 items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0"
                    >
                      <Label htmlFor={`gezin-${r.key}`} className="text-base font-normal leading-snug">
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
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {mijnRij && (
              <Button
                variant="secondary"
                onClick={() => verwijderLid.mutate(mijnRij.id)}
                className="h-14 w-full text-base"
              >
                <LogOut className="size-5" /> Het gezin verlaten
              </Button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
