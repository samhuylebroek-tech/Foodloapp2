import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { VoedingKeuze } from "@/components/voeding/VoedingKeuze";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { bewaarKennismaking, leesToestelKennismaking, type Kennismaking } from "@/lib/kennismaking";
import {
  LEGE_VOEDING,
  normaliseerVoeding,
  toestemmingDatum,
  type Voeding,
} from "@/lib/persoonlijke-voeding";
import {
  bewaarPersoonlijkeVoeding,
  usePersoonlijkeVoeding,
  wisPersoonlijkeVoeding,
} from "@/lib/voeding-db";

export const Route = createFileRoute("/mijn-voeding")({
  head: () => ({
    meta: [
      { title: "Mijn allergieën en voorkeuren – Foodlo" },
      {
        name: "description",
        content: "Je allergieën, intoleranties, dieet en wat je liever niet eet. Alleen voor jou.",
      },
    ],
  }),
  component: MijnVoedingPagina,
});

const BELOFTE = "Alleen voor jou. Nooit naar de AI. Niet zichtbaar voor je gezin.";

function MijnVoedingPagina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = usePersoonlijkeVoeding();
  const account = q.data?.data ?? null;
  const opAccountMogelijk = q.data?.beschikbaar !== false;
  const [v, setV] = useState<Voeding | null>(null);
  const [vraagToestemming, setVraagToestemming] = useState(false);
  const [bezig, setBezig] = useState(false);

  // Beginwaarde: wat op je account staat, anders wat op dit toestel staat (zoals voorheen).
  useEffect(() => {
    if (!user || q.isLoading || v) return;
    if (account) {
      setV(account);
      return;
    }
    const k = leesToestelKennismaking(user.id);
    setV(normaliseerVoeding({ ...LEGE_VOEDING, allergieen: k.allergieen, dieet: k.dieet ?? null }));
  }, [user, q.isLoading, account, v]);

  function opToestel(w: Voeding) {
    if (!user) return;
    const k = leesToestelKennismaking(user.id);
    const nieuw: Kennismaking = { ...k, allergieen: w.allergieen };
    if (w.dieet) nieuw.dieet = w.dieet;
    else delete nieuw.dieet;
    bewaarKennismaking(user.id, nieuw);
  }

  async function naarAccount(w: Voeding, toestemmingOp: string, eersteKeer: boolean) {
    if (!user) return;
    setBezig(true);
    try {
      await bewaarPersoonlijkeVoeding(user.id, w, toestemmingOp);
      await qc.invalidateQueries({ queryKey: ["persoonlijke-voeding", user.id] });
      setVraagToestemming(false);
      if (eersteKeer) {
        toast.success("Bewaard op je account. Ook op je andere toestellen.", {
          action: {
            label: "Ongedaan maken",
            onClick: () => {
              void wisPersoonlijkeVoeding(user.id).then(() =>
                qc.invalidateQueries({ queryKey: ["persoonlijke-voeding", user.id] }),
              );
            },
          },
        });
      } else toast.success("Bewaard");
    } catch {
      toast.error("Bewaren lukte niet. Je keuzes staan nog op dit toestel.");
      opToestel(w);
    } finally {
      setBezig(false);
    }
  }

  function bewaar() {
    if (!v || !user) return;
    if (account) {
      void naarAccount(v, account.toestemming_op, false);
      return;
    }
    if (opAccountMogelijk) {
      setVraagToestemming(true);
      return;
    }
    opToestel(v);
    toast.success("Bewaard op dit toestel");
  }

  async function trekIn() {
    if (!user || !account) return;
    if (
      !window.confirm(
        "Wil je je allergieën en voorkeuren van je account wissen? Op dit toestel blijven ze staan.",
      )
    )
      return;
    setBezig(true);
    try {
      opToestel(account);
      await wisPersoonlijkeVoeding(user.id);
      await qc.invalidateQueries({ queryKey: ["persoonlijke-voeding", user.id] });
      toast.success("Gewist van je account. Ze staan nu alleen nog op dit toestel.");
    } catch {
      toast.error("Wissen lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <AppShell title="Mijn allergieën en voorkeuren">
      <div className="space-y-7">
        <Button asChild variant="ghost" className="-ml-2 w-fit">
          <Link to="/instellingen" hash="maaltijden">
            <ArrowLeft className="size-5" aria-hidden /> Instellingen
          </Link>
        </Button>

        <div className="paneel flex items-start gap-3 p-4">
          <Lock className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{BELOFTE}</p>
            {account ? (
              <p className="mt-1 text-base text-muted-foreground">
                Op je account bewaard met je toestemming van{" "}
                {toestemmingDatum(account.toestemming_op)}.
              </p>
            ) : (
              <p className="mt-1 text-base text-muted-foreground">
                Nu staan je keuzes alleen op dit toestel.
              </p>
            )}
          </div>
        </div>

        {!opAccountMogelijk ? <ModuleNietBeschikbaar compact naam="Bewaren op je account" /> : null}

        {q.isLoading || !v ? (
          <PageSkeleton rows={3} />
        ) : (
          <>
            <VoedingKeuze waarde={v} onWijzig={setV} />

            {vraagToestemming ? (
              <section
                aria-labelledby="toestemming-titel"
                className="rounded-[1.25rem] bg-honing-zacht p-4 ring-1 ring-honing/40"
              >
                <h2 id="toestemming-titel" className="text-lg font-semibold text-honing-foreground">
                  Mogen we dit bewaren op je account?
                </h2>
                <p className="mt-2 text-base text-honing-foreground">
                  {BELOFTE} Dan weet Foodlo het ook op je andere toestellen. Je kan dit altijd weer
                  wissen.
                </p>
                <div className="mt-4 grid gap-2">
                  <Button
                    onClick={() => void naarAccount(v, new Date().toISOString(), true)}
                    disabled={bezig}
                    className="w-full"
                  >
                    <ShieldCheck className="size-5" aria-hidden /> Ja, bewaar op mijn account
                  </Button>
                  <Button
                    variant="zacht"
                    onClick={() => {
                      opToestel(v);
                      setVraagToestemming(false);
                      toast.success("Bewaard op dit toestel");
                    }}
                    disabled={bezig}
                    className="w-full"
                  >
                    <Smartphone className="size-5" aria-hidden /> Nee, alleen op dit toestel
                  </Button>
                </div>
              </section>
            ) : (
              <Button onClick={bewaar} disabled={bezig} className="w-full">
                Bewaren
              </Button>
            )}

            {opAccountMogelijk && !account && !vraagToestemming ? (
              <p className="text-base text-muted-foreground">
                Intoleranties en “liever niet” onthoudt Foodlo pas als je ze op je account bewaart.
              </p>
            ) : null}

            {account ? (
              <Button
                variant="ghost"
                onClick={() => void trekIn()}
                disabled={bezig}
                className="w-full text-destructive"
              >
                Toestemming intrekken en wissen van mijn account
              </Button>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
