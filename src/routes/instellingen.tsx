import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Compass, Download, ExternalLink, Loader2, LogOut, QrCode, Smartphone, Sparkles } from "lucide-react";
import { marketingUrl } from "@/lib/app-url";
import { exporteerMijnGegevens } from "@/lib/export.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { creditOverzicht } from "@/lib/credits.functions";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrDeelKaart } from "@/components/QrDeelKaart";
import { useLimiet } from "@/lib/limiet";
import { ALLE_MOMENTEN, EEN_BLOK, TALEN, THEMAS, useVoorkeuren, type ThemaId } from "@/lib/voorkeuren";

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
  const { taal, zetTaal, thema, zetThema, momenten, zetMomenten, t } = useVoorkeuren();
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

  return (
    <AppShell title={t("Instellingen")}>
      <div className="space-y-6">
        <Link
          to="/credits"
          className="flex min-h-16 items-center justify-between gap-3 rounded-[2rem] border border-border bg-card px-5 shadow-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <span className="text-base font-semibold">
              {credits.data ? `${credits.data.saldo} ${t("credits")}` : t("Credits")}
            </span>
          </span>
          <span className="text-base text-muted-foreground">{t("Bekijken")}</span>
        </Link>

        <Link
          to="/meldingen"
          className="flex min-h-16 items-center justify-between gap-3 rounded-[2rem] border border-border bg-card px-5 shadow-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <Bell className="size-5 text-primary" aria-hidden />
            <span className="text-base font-semibold">{t("Meldingen")}</span>
          </span>
          <span className="text-base text-muted-foreground">{t("Instellen")}</span>
        </Link>

        <Link
          to="/installeren"
          className="flex min-h-16 items-center justify-between gap-3 rounded-[2rem] border border-border bg-card px-5 shadow-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <Smartphone className="size-5 text-primary" aria-hidden />
            <span className="text-base font-semibold">{t("Foodlo op je telefoon zetten")}</span>
          </span>
          <span className="text-base text-muted-foreground">{t("Tonen")}</span>
        </Link>

        <Link
          to="/rondleiding"
          className="flex min-h-16 items-center justify-between gap-3 rounded-[2rem] border border-border bg-card px-5 shadow-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <Compass className="size-5 text-primary" aria-hidden />
            <span className="text-base font-semibold">{t("Rondleiding opnieuw bekijken")}</span>
          </span>
          <span className="text-base text-muted-foreground">{t("Starten")}</span>
        </Link>


        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Jouw Foodlo-naam")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("Met deze naam kunnen vrienden je terugvinden. Bijvoorbeeld: marie")}
          </p>
          <Label htmlFor="handle" className="mt-4 block text-base font-semibold">
            {t("Foodlo-naam")}
          </Label>
          <Input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="marie"
            className="mt-2 h-14 text-base"
          />
          <Button onClick={bewaarHandle} disabled={handleBezig} className="mt-3 h-14 w-full text-base">
            {handleBezig ? <Loader2 className="size-5 animate-spin" /> : null} {t("Bewaren")}
          </Button>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">


          <h2 className="text-xl font-bold tracking-tight">{t("Wachtwoord")}</h2>
          <Label htmlFor="pw" className="mt-4 block text-base font-semibold">
            {t("Nieuw wachtwoord")}
          </Label>
          <Input
            id="pw"
            type="password"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base focus-visible:ring-primary/20"
          />
          <Label htmlFor="pw2" className="mt-3 block text-base font-semibold">
            {t("Herhaal het wachtwoord")}
          </Label>
          <Input
            id="pw2"
            type="password"
            value={herhaal}
            onChange={(e) => setHerhaal(e.target.value)}
            className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base focus-visible:ring-primary/20"
          />
          <Button
            onClick={bewaarWachtwoord}
            disabled={wachtwoordBezig}
            className="mt-4 h-14 w-full text-base shadow-md shadow-primary/15"
          >
            {wachtwoordBezig ? <Loader2 className="size-5 animate-spin" /> : null}
            {t("Wachtwoord bewaren")}
          </Button>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Kleuren")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {THEMAS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => zetThema(k.id as ThemaId)}
                aria-pressed={thema === k.id}
                className={
                  thema === k.id
                    ? "min-h-16 rounded-2xl bg-primary px-3 text-base font-semibold text-primary-foreground shadow-md shadow-primary/15"
                    : "min-h-16 rounded-2xl border border-border bg-secondary px-3 text-base font-semibold transition-colors hover:bg-muted"
                }
              >
                {t(k.label)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Taal")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("De hele app en je recepten worden dan in die taal getoond.")}
          </p>
          <select
            value={taal}
            onChange={(e) => zetTaal(e.target.value)}
            aria-label={t("Taal kiezen")}
            className="mt-4 h-14 w-full rounded-2xl border border-input bg-muted px-4 text-base focus-visible:ring-primary/20"
          >
            {TALEN.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Weekmenu")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("Kies welke momenten je per dag wil inplannen.")}
          </p>
          <div className="mt-4 space-y-2">
            <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-muted px-4 text-base font-semibold">
              <input
                type="checkbox"
                checked={momenten.length === 1 && momenten[0] === EEN_BLOK[0]}
                onChange={(e) =>
                  zetMomenten(e.target.checked ? [...EEN_BLOK] : [...ALLE_MOMENTEN])
                }
                className="size-6 accent-primary"
              />
              {t("Alles in 1 blok (geen ontbijt/middag/avond)")}
            </label>
            {momenten.length > 1 &&
              ALLE_MOMENTEN.map((m) => (
                <label
                  key={m}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-muted px-4 text-base font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={momenten.includes(m)}
                    onChange={(e) =>
                      zetMomenten(
                        e.target.checked
                          ? ALLE_MOMENTEN.filter((x) => x === m || momenten.includes(x))
                          : momenten.filter((x) => x !== m),
                      )
                    }
                    className="size-6 accent-primary"
                  />
                  <span className="capitalize">{t(m)}</span>
                </label>
              ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Deel met vrienden")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("Laat anderen Foodlo openen zonder app store.")}
          </p>
          <div className="mt-4">
            <QrDeelKaart compact />
          </div>
          <Link
            to="/deel"
            className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-base font-semibold transition-colors hover:bg-muted"
          >
            <QrCode className="size-5" />
            {t("Grotere QR-code tonen")}
          </Link>
        </section>

        <Pakketten t={t} />

        <OverFoodlo t={t} />

        <BeheerLink />

        <Button
          variant="ghost"
          onClick={() => supabase.auth.signOut()}
          className="h-16 w-full text-lg"
        >
          <LogOut className="size-5" /> {t("Afmelden")}
        </Button>
      </div>
    </AppShell>
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
    <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold tracking-tight">{t("Pakketten")}</h2>
      <p className="mt-2 text-base text-muted-foreground">
        {limiet.gebruikt} {t("van")} {limiet.totaal} {t("gerechten in gebruik")}
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <Button disabled className="mt-4 h-14 w-full text-base">
        {t("Extra pakket kopen (binnenkort beschikbaar)")}
      </Button>
    </section>
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
    <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold tracking-tight">{t("Over Foodlo")}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.pad}>
            <a
              href={marketingUrl(l.pad)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center justify-between rounded-2xl border border-border px-4 text-lg font-semibold"
            >
              {t(l.label)}
              <ExternalLink className="size-5" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <Button onClick={() => void download()} disabled={bezig} className="mt-4 h-14 w-full text-base">
        <Download className="size-5" /> {bezig ? t("Bezig…") : t("Mijn gegevens downloaden")}
      </Button>
    </section>
  );
}

function BeheerLink() {
  const { profiel } = useAdmin();
  if (!profiel) return null;
  return (
    <Link
      to="/beheer"
      className="block rounded-2xl border border-border bg-card p-5 text-lg font-medium text-foreground shadow-sm"
    >
      Control Center openen
    </Link>
  );
}
