import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarDays,
  ChefHat,
  Loader2,
  Lock,
  Send,
  ShoppingCart,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useVoorkeuren } from "@/lib/voorkeuren";
import {
  bewaarMeldingVoorkeuren,
  haalMeldingVoorkeuren,
  stuurTestMelding,
  type MeldingVoorkeuren,
} from "@/lib/meldingen.functions";
import {
  huidigeStatus,
  zetMeldingenAan,
  zetMeldingenUit,
  type MeldingStatus,
} from "@/lib/meldingen";
import { Groep, Icoon } from "@/components/mobiel/Lijst";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meldingen")({
  head: () => ({
    meta: [
      { title: "Meldingen – Foodlo" },
      {
        name: "description",
        content:
          "Kies zelf welke herinneringen je krijgt voor je menu, je weekplanning, je boodschappen en het koken.",
      },
      { property: "og:title", content: "Meldingen – Foodlo" },
      {
        property: "og:description",
        content: "Herinneringen voor menu, weekplanning, boodschappen en koken.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeldingenPagina,
});

const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const VOORAF = [15, 30, 60, 120];

function MeldingenPagina() {
  const { t } = useVoorkeuren();
  const { user } = useAuth();
  const qc = useQueryClient();
  const haal = useServerFn(haalMeldingVoorkeuren);
  const bewaar = useServerFn(bewaarMeldingVoorkeuren);
  const test = useServerFn(stuurTestMelding);

  const [status, setStatus] = useState<MeldingStatus>("uit");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    void huidigeStatus().then(setStatus);
  }, []);

  const { data: v } = useQuery({
    queryKey: ["melding-voorkeuren"],
    queryFn: () => haal(),
    enabled: !!user,
  });

  const opslaan = useMutation({
    mutationFn: (velden: Partial<MeldingVoorkeuren>) => bewaar({ data: velden }),
    onMutate: async (velden) => {
      qc.setQueryData(["melding-voorkeuren"], (oud: MeldingVoorkeuren | undefined) =>
        oud ? { ...oud, ...velden } : oud,
      );
    },
    onError: () => toast.error(t("Bewaren lukte niet")),
  });

  async function schakel() {
    setBezig(true);
    try {
      if (status === "aan") {
        setStatus(await zetMeldingenUit());
        toast.success(t("Meldingen staan uit"));
      } else {
        const nieuw = await zetMeldingenAan();
        setStatus(nieuw);
        if (nieuw === "aan") toast.success(t("Meldingen staan aan"));
        else if (nieuw === "geweigerd")
          toast.error(
            t("Je telefoon blokkeert meldingen. Zet ze aan bij de instellingen van je browser."),
          );
        else if (nieuw === "open-in-eigen-tab")
          toast.error(
            t(
              "Open Foodlo in een eigen venster of vanaf je beginscherm om meldingen aan te zetten.",
            ),
          );
        else if (nieuw === "niet-ondersteund")
          toast.error(
            t("Dit toestel ondersteunt geen meldingen. Zet Foodlo eerst op je beginscherm."),
          );
      }
    } finally {
      setBezig(false);
    }
  }

  const aan = status === "aan";

  return (
    <AppShell title={t("Meldingen")}>
      <div className="space-y-7">
        {/* Status op dit toestel: één duidelijke schakelaar. */}
        <section
          className={cn(
            "rounded-[1.5rem] p-5 shadow-kaart",
            aan ? "bg-inkt text-inkt-foreground" : "paneel",
          )}
        >
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-full",
                aan ? "bg-honing text-honing-foreground" : "bg-secondary text-primary",
              )}
            >
              {aan ? (
                <Bell className="size-7" aria-hidden />
              ) : (
                <BellOff className="size-7" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-kaarttitel">{t("Meldingen op dit toestel")}</h2>
              <p
                className={cn("mt-1 text-base", aan ? "text-inkt-zacht" : "text-muted-foreground")}
              >
                {aan
                  ? t("Je krijgt herinneringen op dit toestel.")
                  : t(
                      "Zet meldingen aan om herinneringen te krijgen voor je menu, boodschappen en koken.",
                    )}
              </p>
            </div>
          </div>
          <div className={cn("mt-5 grid gap-2", aan && "sm:grid-cols-2")}>
            <Button
              variant={aan ? "zacht" : "default"}
              onClick={() => void schakel()}
              disabled={bezig}
              className="w-full"
            >
              {bezig ? (
                <Loader2 className="size-5 animate-spin" />
              ) : aan ? (
                <BellOff className="size-5" />
              ) : (
                <Bell className="size-5" />
              )}
              {aan ? t("Meldingen uitzetten") : t("Meldingen aanzetten")}
            </Button>
            {aan && (
              <Button
                variant="zacht"
                className="w-full"
                onClick={async () => {
                  const r = await test();
                  if (r.ok) toast.success(t("Testmelding verstuurd"));
                  else
                    toast.error(
                      t("Versturen lukte niet. Probeer meldingen opnieuw aan te zetten."),
                    );
                }}
              >
                <Send className="size-5" /> {t("Testmelding sturen")}
              </Button>
            )}
          </div>
        </section>

        {v && (
          <>
            <Groep titel={t("Kies je herinneringen")}>
              <Blok
                icoon={CalendarCheck}
                titel={t("Menu van vandaag")}
                tekst={t("Elke dag een berichtje met wat er op het menu staat.")}
                aan={v.daily_menu_on}
                zet={(x) => opslaan.mutate({ daily_menu_on: x })}
              >
                <Tijd
                  label={t("Tijd")}
                  waarde={v.daily_menu_time}
                  zet={(x) => opslaan.mutate({ daily_menu_time: x })}
                />
              </Blok>

              <Blok
                icoon={CalendarDays}
                titel={t("Weekmenu plannen")}
                tekst={t(
                  "Een duwtje om je week te plannen. Heb je al gepland, dan krijg je niets.",
                )}
                aan={v.weekly_on}
                zet={(x) => opslaan.mutate({ weekly_on: x })}
              >
                <label className="flex min-h-14 items-center justify-between gap-3">
                  <span className="text-base font-semibold">{t("Dag")}</span>
                  <select
                    value={v.weekly_dow}
                    onChange={(e) => opslaan.mutate({ weekly_dow: Number(e.target.value) })}
                    className="h-12 w-40 rounded-xl border-2 border-input bg-card px-3 text-base font-semibold capitalize"
                  >
                    {DAGEN.map((d, i) => (
                      <option key={d} value={i}>
                        {t(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <Tijd
                  label={t("Tijd")}
                  waarde={v.weekly_time}
                  zet={(x) => opslaan.mutate({ weekly_time: x })}
                />
              </Blok>

              <Blok
                icoon={UtensilsCrossed}
                titel={t("Maaltijd komt eraan")}
                tekst={t("Een herinnering vlak voor een geplande maaltijd.")}
                aan={v.meal_on}
                zet={(x) => opslaan.mutate({ meal_on: x })}
              >
                <Vooraf
                  waarde={v.meal_lead_min}
                  zet={(x) => opslaan.mutate({ meal_lead_min: x })}
                  t={t}
                />
              </Blok>

              <Blok
                icoon={ShoppingCart}
                titel={t("Boodschappen")}
                tekst={t("Alleen wanneer er nog iets op je lijst staat.")}
                aan={v.shopping_on}
                zet={(x) => opslaan.mutate({ shopping_on: x })}
              >
                <Tijd
                  label={t("Tijd")}
                  waarde={v.shopping_time}
                  zet={(x) => opslaan.mutate({ shopping_time: x })}
                />
              </Blok>

              <Blok
                icoon={ChefHat}
                titel={t("Tijd om te koken")}
                tekst={t("Een seintje om aan de slag te gaan.")}
                aan={v.cooking_on}
                zet={(x) => opslaan.mutate({ cooking_on: x })}
              >
                <Vooraf
                  waarde={v.cooking_lead_min}
                  zet={(x) => opslaan.mutate({ cooking_lead_min: x })}
                  t={t}
                />
              </Blok>
            </Groep>

            <Groep titel={t("Privacy")}>
              <Blok
                icoon={Lock}
                titel={t("Toon gerechtnaam op vergrendelscherm")}
                tekst={t("Staat dit uit, dan zie je enkel dat Foodlo iets voor je heeft.")}
                aan={v.lockscreen_details}
                zet={(x) => opslaan.mutate({ lockscreen_details: x })}
              />
            </Groep>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Blok({
  icoon,
  titel,
  tekst,
  aan,
  zet,
  children,
}: {
  icoon: LucideIcon;
  titel: string;
  tekst: string;
  aan: boolean;
  zet: (x: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex min-h-18 cursor-pointer items-start gap-3.5 px-4 py-4">
        <Icoon icoon={icoon} tint={aan ? "honing" : "grijs"} />
        <span className="min-w-0 flex-1">
          <span className="block text-[1.05rem] font-semibold leading-snug">{titel}</span>
          <span className="mt-0.5 block text-[0.95rem] leading-snug text-muted-foreground">
            {tekst}
          </span>
        </span>
        <Switch checked={aan} onCheckedChange={zet} aria-label={titel} className="mt-1" />
      </label>
      {aan && children ? (
        <div className="mx-4 mb-4 space-y-2 rounded-2xl bg-muted px-4 py-2 sm:ml-[4.25rem]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Tijd({ label, waarde, zet }: { label: string; waarde: string; zet: (x: string) => void }) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-3">
      <span className="text-base font-semibold">{label}</span>
      <input
        type="time"
        value={waarde}
        onChange={(e) => zet(e.target.value)}
        className="h-12 w-40 rounded-xl border-2 border-input bg-card px-3 text-base font-semibold tabular-nums"
      />
    </label>
  );
}

function Vooraf({
  waarde,
  zet,
  t,
}: {
  waarde: number;
  zet: (x: number) => void;
  t: (s: string) => string;
}) {
  return (
    <fieldset className="py-2">
      <legend className="text-base font-semibold">{t("Hoelang vooraf")}</legend>
      <div className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-card p-1 ring-1 ring-border">
        {VOORAF.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => zet(m)}
            aria-pressed={waarde === m}
            className={cn(
              "min-h-12 rounded-full text-[0.95rem] font-semibold transition-colors",
              waarde === m ? "bg-inkt text-inkt-foreground" : "hover:bg-muted",
            )}
          >
            {m < 60 ? `${m} ${t("min")}` : `${m / 60} ${t("uur")}`}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
