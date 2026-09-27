import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useVoorkeuren } from "@/lib/voorkeuren";
import {
  bewaarMeldingVoorkeuren,
  haalMeldingVoorkeuren,
  stuurTestMelding,
  type MeldingVoorkeuren,
} from "@/lib/meldingen.functions";
import { huidigeStatus, zetMeldingenAan, zetMeldingenUit, type MeldingStatus } from "@/lib/meldingen";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/meldingen")({
  head: () => ({
    meta: [
      { title: "Meldingen – Foodlo" },
      {
        name: "description",
        content: "Kies zelf welke herinneringen je krijgt voor je menu, je weekplanning, je boodschappen en het koken.",
      },
      { property: "og:title", content: "Meldingen – Foodlo" },
      { property: "og:description", content: "Herinneringen voor menu, weekplanning, boodschappen en koken." },
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
          toast.error(t("Je telefoon blokkeert meldingen. Zet ze aan bij de instellingen van je browser."));
        else if (nieuw === "open-in-eigen-tab")
          toast.error(t("Open Foodlo in een eigen venster of vanaf je beginscherm om meldingen aan te zetten."));
        else if (nieuw === "niet-ondersteund")
          toast.error(t("Dit toestel ondersteunt geen meldingen. Zet Foodlo eerst op je beginscherm."));
      }
    } finally {
      setBezig(false);
    }
  }

  const aan = status === "aan";

  return (
    <AppShell title={t("Meldingen")}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">{t("Meldingen op dit toestel")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {aan
              ? t("Je krijgt herinneringen op dit toestel.")
              : t("Zet meldingen aan om herinneringen te krijgen voor je menu, boodschappen en koken.")}
          </p>
          <Button onClick={() => void schakel()} disabled={bezig} className="mt-4 h-16 w-full text-lg">
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
              variant="outline"
              className="mt-3 h-14 w-full text-base"
              onClick={async () => {
                const r = await test();
                if (r.ok) toast.success(t("Testmelding verstuurd"));
                else toast.error(t("Versturen lukte niet. Probeer meldingen opnieuw aan te zetten."));
              }}
            >
              <Send className="size-5" /> {t("Testmelding sturen")}
            </Button>
          )}
        </section>

        {v && (
          <Accordion type="single" collapsible defaultValue="voorkeuren" className="rounded-2xl bg-card px-4 ring-1 ring-border/60">
            <AccordionItem value="voorkeuren" className="border-0">
              <AccordionTrigger className="min-h-16 text-lg no-underline hover:no-underline">{t("Kies je herinneringen")}</AccordionTrigger>
              <AccordionContent className="space-y-4">
            <Blok
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
              titel={t("Weekmenu plannen")}
              tekst={t("Een duwtje om je week te plannen. Heb je al gepland, dan krijg je niets.")}
              aan={v.weekly_on}
              zet={(x) => opslaan.mutate({ weekly_on: x })}
            >
              <Label className="mt-4 block text-base font-semibold">{t("Dag")}</Label>
              <select
                value={v.weekly_dow}
                onChange={(e) => opslaan.mutate({ weekly_dow: Number(e.target.value) })}
                className="mt-2 h-14 w-full rounded-2xl border border-input bg-muted px-4 text-base capitalize"
              >
                {DAGEN.map((d, i) => (
                  <option key={d} value={i}>
                    {t(d)}
                  </option>
                ))}
              </select>
              <Tijd label={t("Tijd")} waarde={v.weekly_time} zet={(x) => opslaan.mutate({ weekly_time: x })} />
            </Blok>

            <Blok
              titel={t("Maaltijd komt eraan")}
              tekst={t("Een herinnering vlak voor een geplande maaltijd.")}
              aan={v.meal_on}
              zet={(x) => opslaan.mutate({ meal_on: x })}
            >
              <Vooraf waarde={v.meal_lead_min} zet={(x) => opslaan.mutate({ meal_lead_min: x })} t={t} />
            </Blok>

            <Blok
              titel={t("Boodschappen")}
              tekst={t("Alleen wanneer er nog iets op je lijst staat.")}
              aan={v.shopping_on}
              zet={(x) => opslaan.mutate({ shopping_on: x })}
            >
              <Tijd label={t("Tijd")} waarde={v.shopping_time} zet={(x) => opslaan.mutate({ shopping_time: x })} />
            </Blok>

            <Blok
              titel={t("Tijd om te koken")}
              tekst={t("Een seintje om aan de slag te gaan.")}
              aan={v.cooking_on}
              zet={(x) => opslaan.mutate({ cooking_on: x })}
            >
              <Vooraf waarde={v.cooking_lead_min} zet={(x) => opslaan.mutate({ cooking_lead_min: x })} t={t} />
            </Blok>

            <section className="rounded-2xl bg-muted p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{t("Toon gerechtnaam op vergrendelscherm")}</h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    {t("Staat dit uit, dan zie je enkel dat Foodlo iets voor je heeft.")}
                  </p>
                </div>
                <Switch
                  checked={v.lockscreen_details}
                  onCheckedChange={(x) => opslaan.mutate({ lockscreen_details: x })}
                  aria-label={t("Toon gerechtnaam op vergrendelscherm")}
                />
              </div>
            </section>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </AppShell>
  );
}

function Blok({
  titel,
  tekst,
  aan,
  zet,
  children,
}: {
  titel: string;
  tekst: string;
  aan: boolean;
  zet: (x: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{titel}</h2>
          <p className="mt-2 text-base text-muted-foreground">{tekst}</p>
        </div>
        <Switch checked={aan} onCheckedChange={zet} aria-label={titel} />
      </div>
      {aan && children}
    </section>
  );
}

function Tijd({ label, waarde, zet }: { label: string; waarde: string; zet: (x: string) => void }) {
  return (
    <>
      <Label className="mt-4 block text-base font-semibold">{label}</Label>
      <input
        type="time"
        value={waarde}
        onChange={(e) => zet(e.target.value)}
        aria-label={label}
        className="mt-2 h-14 w-full rounded-2xl border border-input bg-muted px-4 text-base"
      />
    </>
  );
}

function Vooraf({ waarde, zet, t }: { waarde: number; zet: (x: number) => void; t: (s: string) => string }) {
  return (
    <>
      <Label className="mt-4 block text-base font-semibold">{t("Hoelang vooraf")}</Label>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {VOORAF.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => zet(m)}
            aria-pressed={waarde === m}
            className={
              waarde === m
                ? "min-h-14 rounded-2xl bg-primary text-base font-semibold text-primary-foreground"
                : "min-h-14 rounded-2xl border border-border bg-secondary text-base font-semibold hover:bg-muted"
            }
          >
            {m < 60 ? `${m} ${t("min")}` : `${m / 60} ${t("uur")}`}
          </button>
        ))}
      </div>
    </>
  );
}
