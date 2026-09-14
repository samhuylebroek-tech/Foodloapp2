import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { creditOverzicht, mijnCreditAanvraag, vraagCredits } from "@/lib/credits.functions";
import { useVoorkeuren } from "@/lib/voorkeuren";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: "AI-credits – Foodlo" },
      {
        name: "description",
        content: "Bekijk je AI-credits, waarvoor ze dienen en wat je er nog mee kan doen.",
      },
      { property: "og:title", content: "AI-credits – Foodlo" },
      { property: "og:description", content: "Slimme functies gebruiken credits. De rest van Foodlo blijft gratis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreditsPagina,
});

const UITLEG: Record<string, string> = {
  signup_bonus: "Welkomstcredits",
  purchase: "Credits gekocht",
  usage: "Slimme functie gebruikt",
  refund: "Teruggestort",
  admin_adjustment: "Aangepast door het team",
  promotional_bonus: "Cadeau",
};

function euro(cent: number) {
  return (cent / 100).toLocaleString("nl-BE", { style: "currency", currency: "EUR" });
}

function CreditsPagina() {
  const { t } = useVoorkeuren();
  const fn = useServerFn(creditOverzicht);
  const { data, isLoading } = useQuery({ queryKey: ["credits"], queryFn: () => fn() });

  const saldo = data?.saldo ?? 0;
  const laag = data ? saldo <= data.waarschuwingVanaf : false;

  return (
    <AppShell title={t("AI-credits")}>
      {isLoading || !data ? (
        <p className="text-base text-muted-foreground">{t("Laden…")}</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-border bg-card p-6 text-center shadow-sm">
            <Sparkles className="mx-auto size-8 text-primary" aria-hidden />
            <p className="mt-2 text-5xl font-bold tracking-tight">{saldo}</p>
            <p className="mt-1 text-base text-muted-foreground">{t("AI-credits")}</p>
            {saldo === 0 ? (
              <p className="mt-4 rounded-2xl bg-muted p-3 text-base">
                {t("Je AI-credits zijn op. Alle gewone functies blijven werken: recepten, weekmenu, boodschappen en kookstand.")}
              </p>
            ) : laag ? (
              <p className="mt-4 rounded-2xl bg-muted p-3 text-base">
                {t("Je hebt nog weinig AI-credits over.")}
              </p>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight">{t("Waarvoor dienen credits?")}</h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("Enkel slimme functies gebruiken credits. Zoeken, koken, plannen en boodschappen zijn altijd gratis.")}
            </p>
            <ul className="mt-4 space-y-2">
              {data.kosten
                .filter((k) => k.enabled && k.credit_cost > 0)
                .map((k) => (
                  <li
                    key={k.feature}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-muted px-4 text-base"
                  >
                    <span>{t(k.label || k.feature)}</span>
                    <span className="whitespace-nowrap font-semibold">
                      {k.credit_cost} {k.credit_cost === 1 ? t("credit") : t("credits")}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("Hetzelfde recept of dezelfde link opnieuw invoeren kost niets: we onthouden het resultaat.")}
            </p>
          </section>

          <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight">{t("Meer credits")}</h2>
            {data.kopenActief ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.pakketten.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border p-4">
                    <p className="text-lg font-semibold">{p.naam}</p>
                    <p className="text-base">
                      {p.credits + p.bonus} {t("credits")}
                      {p.bonus > 0 ? ` (+${p.bonus} ${t("bonus")})` : ""}
                    </p>
                    <p className="mt-1 text-base text-muted-foreground">{euro(p.prijs_cent)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-base text-muted-foreground">
                {t("Extra credits kopen kan binnenkort. Heb je er nu al meer nodig? Vraag het gerust.")}
              </p>
            )}
            <ExtraVragen t={t} />
          </section>

          <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight">{t("Recent")}</h2>
            <ul className="mt-3 divide-y divide-border">
              {data.boekingen.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-base">
                  <span>{t(UITLEG[b.type] ?? b.type)}</span>
                  <span className={b.amount < 0 ? "font-semibold" : "font-semibold text-primary"}>
                    {b.amount > 0 ? `+${b.amount}` : b.amount}
                  </span>
                </li>
              ))}
              {data.boekingen.length === 0 ? (
                <li className="py-3 text-base text-muted-foreground">{t("Nog niets gebeurd.")}</li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function ExtraVragen({ t }: { t: (s: string) => string }) {
  const qc = useQueryClient();
  const lezen = useServerFn(mijnCreditAanvraag);
  const sturen = useServerFn(vraagCredits);
  const { data: aanvraag } = useQuery({ queryKey: ["credit-aanvraag"], queryFn: () => lezen() });
  const [open, setOpen] = useState(false);
  const [bericht, setBericht] = useState("");

  const versturen = useMutation({
    mutationFn: () => sturen({ data: { aantal: 0, bericht } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(t(r.melding));
        setOpen(false);
        setBericht("");
      } else {
        toast.info(t(r.melding));
      }
      qc.invalidateQueries({ queryKey: ["credit-aanvraag"] });
    },
    onError: () => toast.error(t("Versturen lukte niet. Probeer straks opnieuw.")),
  });

  if (aanvraag?.status === "open") {
    return (
      <p className="mt-4 rounded-2xl bg-muted p-4 text-base">
        {t("Je vraag om extra credits staat klaar. We laten iets weten zodra ze behandeld is.")}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {aanvraag?.status === "toegekend" && aanvraag.toegekend > 0 ? (
        <p className="mb-3 rounded-2xl bg-muted p-4 text-base">
          {t("Je kreeg extra credits toegekend")}: +{aanvraag.toegekend}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3">
          <label className="block text-base font-semibold" htmlFor="credit-bericht">
            {t("Waarvoor heb je ze nodig? (mag kort)")}
          </label>
          <Textarea
            id="credit-bericht"
            value={bericht}
            onChange={(e) => setBericht(e.target.value)}
            rows={3}
            maxLength={500}
            className="text-base"
            placeholder={t("Bijvoorbeeld: ik wil nog een paar recepten inlezen van een link.")}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => versturen.mutate()}
              disabled={versturen.isPending}
              className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Send className="size-5" aria-hidden />
              {versturen.isPending ? t("Versturen…") : t("Versturen")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-14 items-center rounded-2xl border border-border px-5 text-base font-semibold"
            >
              {t("Annuleren")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-base font-semibold transition-colors hover:bg-muted"
        >
          <Send className="size-5" aria-hidden />
          {t("Vraag extra credits")}
        </button>
      )}
    </div>
  );
}
