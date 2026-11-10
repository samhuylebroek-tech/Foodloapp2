import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  Check,
  ChevronDown,
  Compass,
  Download,
  ExternalLink,
  Loader2,
  LogOut,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Groep, KnopRij, LinkRij, Paneel } from "@/components/mobiel/Lijst";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { etenstijd } from "@/lib/vandaag";
import { marketingUrl } from "@/lib/app-url";
import { exporteerMijnGegevens } from "@/lib/export.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { creditOverzicht } from "@/lib/credits.functions";
import { verwijderMijnAccount } from "@/lib/account.functions";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { beeindigSessie } from "@/lib/meten";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrDeelKaart } from "@/components/QrDeelKaart";
import { useLimiet } from "@/lib/limiet";
import {
  ALLE_MOMENTEN,
  EEN_BLOK,
  TALEN,
  THEMAS,
  useVoorkeuren,
  type ThemaId,
} from "@/lib/voorkeuren";

export const Route = createFileRoute("/instellingen")({
  head: () => ({
    meta: [
      { title: "Instellingen – Foodlo" },
      {
        name: "description",
        content: "Pas je wachtwoord aan, kies een kleurenthema en je taal.",
      },
      { property: "og:title", content: "Instellingen – Foodlo" },
      {
        property: "og:description",
        content: "Wachtwoord, kleuren en taal: alles op één plek.",
      },
    ],
  }),
  component: InstellingenPage,
});

function InstellingenPage() {
  const { taal, zetTaal, thema, zetThema, momenten, zetMomenten, weekmenu, zetWeekmenu, t } =
    useVoorkeuren();
  const creditFn = useServerFn(creditOverzicht);
  const { user: ingelogd } = useAuth();
  const credits = useQuery({
    queryKey: ["credits"],
    queryFn: () => creditFn(),
    enabled: !!ingelogd,
    retry: false,
  });
  const [handle, setHandle] = useState("");
  const [handleBezig, setHandleBezig] = useState(false);

  useQuery({
    queryKey: ["mijn-handle", ingelogd?.id],
    enabled: !!ingelogd,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", ingelogd!.id)
        .maybeSingle();
      setHandle(data?.handle ?? "");
      return data?.handle ?? "";
    },
  });

  async function bewaarHandle() {
    if (!ingelogd) return;
    const schoon = handle.trim().replace(/^@/, "").toLowerCase();
    if (schoon && !/^[a-z0-9._-]{3,20}$/.test(schoon)) {
      toast.error(t("Kies 3 tot 20 tekens: letters, cijfers, punt of streepje"));
      return;
    }
    setHandleBezig(true);
    const { error } = await supabase
      .from("profiles")
      .update({ handle: schoon || null })
      .eq("id", ingelogd.id);
    setHandleBezig(false);
    if (error) toast.error(t("Die naam is al bezet. Kies een andere."));
    else {
      setHandle(schoon);
      toast.success(t("Bewaard"));
    }
  }

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [wachtwoordBezig, setWachtwoordBezig] = useState(false);

  async function bewaarWachtwoord() {
    if (wachtwoord.length < 8) {
      toast.error(t("Kies een wachtwoord van minstens 8 tekens"));
      return;
    }
    if (wachtwoord !== herhaal) {
      toast.error(t("De twee wachtwoorden zijn niet gelijk"));
      return;
    }
    setWachtwoordBezig(true);
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });
    setWachtwoordBezig(false);
    if (error) toast.error(t("Aanpassen lukte niet"));
    else {
      setWachtwoord("");
      setHerhaal("");
      toast.success(t("Je wachtwoord is aangepast"));
    }
  }

  const eenBlok = momenten.length === 1 && momenten[0] === EEN_BLOK[0];

  return (
    <AppShell title={t("Instellingen")}>
      <div className="space-y-7">
        <Groep titel={t("Profiel")}>
          <div className="p-4">
            <Label htmlFor="handle">{t("Jouw Foodlo-naam")}</Label>
            <p id="handle-uitleg" className="mt-1 text-[0.95rem] text-muted-foreground">
              {t("Met deze naam kunnen vrienden je terugvinden. Bijvoorbeeld: marie")}
            </p>
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  @
                </span>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  aria-describedby="handle-uitleg"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-9"
                />
              </div>
              <Button onClick={bewaarHandle} disabled={handleBezig} className="shrink-0">
                {handleBezig ? <Loader2 className="size-5 animate-spin" /> : null}
                {t("Bewaren")}
              </Button>
            </div>
          </div>
        </Groep>

        <Groep titel={t("Weergave")}>
          <div className="p-4">
            <h3 className="text-base font-semibold">{t("Kleuren")}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {THEMAS.map((k) => {
                const actief = thema === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => zetThema(k.id as ThemaId)}
                    aria-pressed={actief}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 text-left text-[0.95rem] font-semibold leading-tight transition-colors",
                      actief
                        ? "border-primary bg-secondary text-foreground"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-7 shrink-0 rounded-full ring-2 ring-card"
                      style={{ background: STAAL[k.id] }}
                    />
                    <span className="min-w-0 flex-1">{t(k.label)}</span>
                    {actief ? <Check className="size-5 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <Label htmlFor="taal">{t("Taal")}</Label>
            <p id="taal-uitleg" className="mt-1 text-[0.95rem] text-muted-foreground">
              {t("De hele app en je recepten worden dan in die taal getoond.")}
            </p>
            <div className="relative mt-3">
              <select
                id="taal"
                value={taal}
                onChange={(e) => zetTaal(e.target.value)}
                aria-describedby="taal-uitleg"
                className="h-14 w-full appearance-none rounded-2xl border-2 border-input bg-card pl-4 pr-12 text-base font-semibold focus-visible:border-primary"
              >
                {TALEN.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>
        </Groep>

        <Groep titel={t("Weekmenu")} voet={t("Kies welke momenten je per dag wil inplannen.")}>
          <label className="flex min-h-16 cursor-pointer items-center gap-3.5 px-4 py-3">
            <span className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug">
              {t("Alles in 1 blok (geen ontbijt/middag/avond)")}
            </span>
            <Switch
              checked={eenBlok}
              onCheckedChange={(aan) => zetMomenten(aan ? [...EEN_BLOK] : [...ALLE_MOMENTEN])}
            />
          </label>
          {!eenBlok
            ? ALLE_MOMENTEN.map((m) => (
                <label
                  key={m}
                  className="flex min-h-16 cursor-pointer items-center gap-3.5 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-[1.05rem] font-semibold capitalize leading-snug">
                    {t(m)}
                  </span>
                  <Switch
                    checked={momenten.includes(m)}
                    onCheckedChange={(aan) =>
                      zetMomenten(
                        aan
                          ? ALLE_MOMENTEN.filter((x) => x === m || momenten.includes(x))
                          : momenten.filter((x) => x !== m),
                      )
                    }
                  />
                </label>
              ))
            : null}
        </Groep>

        <Groep
          titel={t("Wanneer eet je?")}
          voet={t("Foodlo zegt op Vandaag wanneer je moet beginnen met koken, en kijkt na je avondeten naar morgen.")}
        >
          {(eenBlok ? ["maaltijd"] : ALLE_MOMENTEN.filter((m) => momenten.includes(m))).map((m) => (
            <label key={m} className="flex min-h-16 flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3">
              <span className="min-w-[7rem] flex-1 text-[1.05rem] font-semibold capitalize leading-snug">
                {t(m === "maaltijd" ? "Eten" : m)}
              </span>
              <input
                type="time"
                step={300}
                aria-label={`${t("Etenstijd")} ${t(m === "maaltijd" ? "eten" : m)}`}
                value={etenstijd(m, weekmenu.etenstijden) ?? ""}
                onChange={(e) => {
                  const waarde = e.target.value;
                  if (!/^\d{2}:\d{2}$/.test(waarde)) return;
                  const sleutel = m === "maaltijd" ? "avondeten" : m;
                  zetWeekmenu({ etenstijden: { ...weekmenu.etenstijden, [sleutel]: waarde } });
                }}
                className="h-12 rounded-xl border border-input bg-background px-3 text-lg tabular-nums"
              />
            </label>
          ))}
        </Groep>

        <Groep titel={t("Jouw Foodlo")}>
          <LinkRij
            to="/credits"
            icoon={Sparkles}
            tint="honing"
            titel={t("Credits")}
            rechts={
              credits.data ? (
                <span className="text-base font-semibold text-muted-foreground">
                  {credits.data.saldo}
                </span>
              ) : null
            }
          />
          <LinkRij to="/meldingen" icoon={Bell} tint="honing" titel={t("Meldingen")} />
          <LinkRij
            to="/installeren"
            icoon={Smartphone}
            tint="groen"
            titel={t("Foodlo op je telefoon zetten")}
          />
          <LinkRij
            to="/rondleiding"
            icoon={Compass}
            tint="groen"
            titel={t("Rondleiding opnieuw bekijken")}
          />
        </Groep>

        <Groep titel={t("Beveiliging")}>
          <div className="space-y-3 p-4">
            <h3 className="text-base font-semibold">{t("Wachtwoord")}</h3>
            <div>
              <Label htmlFor="pw" className="text-[0.95rem]">
                {t("Nieuw wachtwoord")}
              </Label>
              <Input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pw2" className="text-[0.95rem]">
                {t("Herhaal het wachtwoord")}
              </Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={herhaal}
                onChange={(e) => setHerhaal(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button
              variant="outline"
              onClick={bewaarWachtwoord}
              disabled={wachtwoordBezig}
              className="w-full"
            >
              {wachtwoordBezig ? <Loader2 className="size-5 animate-spin" /> : null}
              {t("Wachtwoord bewaren")}
            </Button>
          </div>
        </Groep>

        <Groep
          titel={t("Deel met vrienden")}
          voet={t("Laat anderen Foodlo openen zonder app store.")}
        >
          <div className="p-4">
            <QrDeelKaart compact />
          </div>
          <LinkRij to="/deel" icoon={QrCode} tint="groen" titel={t("Grotere QR-code tonen")} />
        </Groep>

        <Pakketten t={t} />

        <OverFoodlo t={t} />

        <BeheerLink />

        <Groep titel={t("Account")}>
          <KnopRij
            icoon={LogOut}
            tint="grijs"
            titel={t("Afmelden")}
            onClick={async () => {
              await beeindigSessie();
              await supabase.auth.signOut();
            }}
          />
          <AccountVerwijderen />
        </Groep>
      </div>
    </AppShell>
  );
}

const STAAL: Record<ThemaId, string> = {
  sage: "linear-gradient(135deg, oklch(0.41 0.07 160) 50%, oklch(0.975 0.011 80) 50%)",
  warm: "linear-gradient(135deg, oklch(0.55 0.13 38) 50%, oklch(0.96 0.03 70) 50%)",
  fris: "linear-gradient(135deg, oklch(0.55 0.14 150) 50%, oklch(0.98 0.01 150) 50%)",
  donker: "linear-gradient(135deg, oklch(0.74 0.12 155) 50%, oklch(0.19 0.01 150) 50%)",
  contrast: "linear-gradient(135deg, oklch(0.2 0 0) 50%, oklch(1 0 0) 50%)",
};

function AccountVerwijderen() {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);
  const verwijder = useServerFn(verwijderMijnAccount);
  if (!open)
    return (
      <KnopRij
        icoon={Trash2}
        gevaar
        titel="Account verwijderen"
        uitleg="Wist al je gegevens definitief"
        onClick={() => setOpen(true)}
      />
    );
  return (
    <div className="space-y-3 bg-[oklch(0.97_0.02_25)] p-4 dark:bg-transparent">
      <p className="text-lg font-semibold">Weet je het zeker?</p>
      <p className="text-base text-muted-foreground">
        Je account, recepten, weekmenu's, lijsten en foto's worden definitief gewist. Dit kan niet
        ongedaan gemaakt worden. Typ VERWIJDER om te bevestigen.
      </p>
      <Input
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        className="h-14 text-lg"
        aria-label="Typ VERWIJDER"
        autoCapitalize="characters"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-14 text-base" onClick={() => setOpen(false)}>
          Annuleren
        </Button>
        <Button
          variant="destructive"
          className="h-14 text-base"
          disabled={tekst.trim() !== "VERWIJDER" || bezig}
          onClick={async () => {
            setBezig(true);
            try {
              await verwijder({ data: { bevestiging: "VERWIJDER" } });
              await supabase.auth.signOut();
              toast.success("Je account is verwijderd.");
              window.location.href = "/";
            } catch (e) {
              toast.error((e as Error).message);
              setBezig(false);
            }
          }}
        >
          {bezig ? <Loader2 className="size-5 animate-spin" /> : "Definitief verwijderen"}
        </Button>
      </div>
    </div>
  );
}

function Pakketten({ t }: { t: (s: string) => string }) {
  const { user } = useAuth();
  const { data: limiet } = useLimiet(user?.id);
  if (!limiet?.betalenActief) return null;

  const percentage =
    Number.isFinite(limiet.totaal) && limiet.totaal > 0
      ? Math.min(100, Math.round((limiet.gebruikt / limiet.totaal) * 100))
      : 0;

  return (
    <Paneel titel={t("Pakketten")}>
      <p className="text-base text-muted-foreground">
        {limiet.gebruikt} {t("van")} {limiet.totaal} {t("gerechten in gebruik")}
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <Button disabled className="mt-4 h-14 w-full text-base">
        {t("Extra pakket kopen (binnenkort beschikbaar)")}
      </Button>
    </Paneel>
  );
}

function OverFoodlo({ t }: { t: (s: string) => string }) {
  const [bezig, setBezig] = useState(false);
  const links = [
    { label: "Website", pad: "/" },
    { label: "Over Foodlo", pad: "/over" },
    { label: "Contact", pad: "/contact" },
    { label: "Privacy", pad: "/privacy" },
    { label: "Voorwaarden", pad: "/voorwaarden" },
  ];

  const download = async () => {
    setBezig(true);
    try {
      const gegevens = await exporteerMijnGegevens();
      const blob = new Blob([JSON.stringify(gegevens, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "foodlo-mijn-gegevens.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("Downloaden lukte niet. Probeer het straks opnieuw."));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Groep titel={t("Gegevens en privacy")}>
      <KnopRij
        icoon={Download}
        tint="groen"
        titel={bezig ? t("Bezig…") : t("Mijn gegevens downloaden")}
        uitleg={t("Een bestand met al je recepten en lijsten")}
        disabled={bezig}
        onClick={() => void download()}
      />
      <LinkRij to="/privacy" icoon={ShieldCheck} tint="grijs" titel={t("Privacybeleid")} />
      {links.map((l) => (
        <a
          key={l.pad}
          href={marketingUrl(l.pad)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-[1.05rem] font-semibold hover:bg-muted/70"
        >
          {t(l.label)}
          <ExternalLink className="size-5 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("(opent in een nieuw venster)")}</span>
        </a>
      ))}
    </Groep>
  );
}

function BeheerLink() {
  const { profiel } = useAdmin();
  if (!profiel) return null;
  return (
    <Groep titel="Beheer">
      <LinkRij to="/beheer" icoon={ShieldCheck} tint="inkt" titel="Control Center openen" />
    </Groep>
  );
}
