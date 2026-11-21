/**
 * Fase 8 — Instellingen › Aanmelden en beveiliging: waar je aangemeld bent, afmelden op andere
 * toestellen, en eerlijke uitleg over tweestapsverificatie (BUG-095).
 *
 * Bron van de lijst: je eigen sessies via public.mijn_aanmeldingen() (voorstel 0025, nagebootst in
 * de nep-databank). Zolang die functie ontbreekt: de toestellen waarop je Foodlo recent
 * gebruikte (user_sessions), duidelijk zo benoemd. "Afmelden op alle andere toestellen" werkt
 * altijd (supabase.auth.signOut met scope "others").
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { huidigeSessieId } from "@/lib/meten";
import { db } from "@/lib/module-beschikbaar";
import {
  isOntbrekendeFunctie,
  recenteToestellen,
  toestelNaam,
  wanneer,
  type Aanmelding,
} from "@/lib/privacy/sessies";

export const Route = createFileRoute("/instellingen_/beveiliging")({
  head: () => ({
    meta: [
      { title: "Aanmelden en beveiliging – Foodlo" },
      {
        name: "description",
        content: "Zie waar je aangemeld bent en meld je af op andere toestellen.",
      },
    ],
  }),
  component: BeveiligingPagina,
});

type Lijst = { rijen: Aanmelding[]; echt: boolean };

async function haalAanmeldingen(userId: string): Promise<Lijst> {
  const { data, error } = await db.rpc("mijn_aanmeldingen");
  if (!error && Array.isArray(data)) {
    return {
      echt: true,
      rijen: (
        data as {
          id: string;
          created_at: string | null;
          refreshed_at: string | null;
          user_agent: string | null;
          huidige: boolean;
        }[]
      ).map((r) => ({
        id: r.id,
        toestel: toestelNaam(r.user_agent),
        laatst: r.refreshed_at ?? r.created_at,
        sinds: r.created_at,
        huidige: !!r.huidige,
        echt: true,
      })),
    };
  }
  if (error && !isOntbrekendeFunctie(error)) throw error;
  const sinds = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: s } = await supabase
    .from("user_sessions")
    .select("id, device, browser, platform, last_seen_at, started_at")
    .eq("user_id", userId)
    .gte("started_at", sinds)
    .order("started_at", { ascending: false })
    .limit(100);
  return { echt: false, rijen: recenteToestellen(s ?? [], huidigeSessieId()) };
}

function BeveiligingPagina() {
  const { user } = useAuth();
  const { profiel } = useAdmin();
  const [bezig, setBezig] = useState<string | null>(null);
  const lijst = useQuery({
    queryKey: ["aanmeldingen", user?.id],
    enabled: !!user,
    queryFn: () => haalAanmeldingen(user!.id),
    retry: 1,
  });

  async function afmeldenAnderen() {
    setBezig("anderen");
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Je bent afgemeld op al je andere toestellen. Hier blijf je aangemeld.");
      await lijst.refetch();
    } catch {
      toast.error("Afmelden lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(null);
    }
  }

  async function afmeldenEen(a: Aanmelding) {
    setBezig(a.id);
    try {
      const { error } = await db.rpc("meld_aanmelding_af", { _id: a.id });
      if (error) throw error;
      toast.success(`Afgemeld op ${a.toestel}.`);
      await lijst.refetch();
    } catch {
      toast.error("Afmelden lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(null);
    }
  }

  const rijen = lijst.data?.rijen ?? [];
  return (
    <AppShell title="Aanmelden en beveiliging" ondertitel="Waar je aangemeld bent.">
      <div className="mx-auto max-w-2xl space-y-7 pb-8">
        <Link
          to="/instellingen/privacy"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Privacy & toestemmingen
        </Link>

        <section aria-labelledby="sessies-titel" className="space-y-3">
          <h2 id="sessies-titel" className="text-sectietitel">
            {lijst.data?.echt === false ? "Recent gebruikte toestellen" : "Waar je aangemeld bent"}
          </h2>
          {lijst.data?.echt === false ? (
            <p className="text-base text-muted-foreground">
              Dit zijn de toestellen waarop je Foodlo de laatste 30 dagen gebruikte. Of je daar nog
              aangemeld bent, kunnen we nog niet per toestel tonen. Afmelden op alle andere
              toestellen werkt wel meteen.
            </p>
          ) : null}
          {lijst.isLoading ? (
            <p className="text-base text-muted-foreground">Even laden…</p>
          ) : lijst.isError ? (
            <p role="alert" className="text-base">
              De lijst laden lukte niet.{" "}
              <button
                type="button"
                className="min-h-12 font-semibold text-primary underline"
                onClick={() => void lijst.refetch()}
              >
                Opnieuw proberen
              </button>
            </p>
          ) : rijen.length === 0 ? (
            <p className="text-base text-muted-foreground">Alleen dit toestel.</p>
          ) : (
            <ul className="paneel divide-y" data-testid="sessies">
              {rijen.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <Smartphone className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-base font-semibold">
                      {a.toestel}
                      {a.huidige ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.95rem] text-primary">
                          Dit toestel
                        </span>
                      ) : null}
                    </p>
                    {a.laatst ? (
                      <p className="text-[0.95rem] text-muted-foreground">
                        Laatst actief {wanneer(a.laatst)}
                      </p>
                    ) : null}
                  </div>
                  {a.echt && !a.huidige ? (
                    <Button
                      variant="outline"
                      className="min-h-12 text-base"
                      disabled={bezig !== null}
                      onClick={() => void afmeldenEen(a)}
                      aria-label={`Afmelden op ${a.toestel}`}
                    >
                      {bezig === a.id ? (
                        <Loader2 className="size-5 animate-spin" aria-hidden />
                      ) : (
                        <LogOut className="size-5" aria-hidden />
                      )}
                      Afmelden
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Button
            className="min-h-14 w-full text-base"
            disabled={bezig !== null}
            onClick={() => void afmeldenAnderen()}
          >
            {bezig === "anderen" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            Afmelden op alle andere toestellen
          </Button>
          <p className="text-[0.95rem] text-muted-foreground">
            Doe dit als je een toestel kwijt bent of iemand anders je wachtwoord kent. Verander dan
            ook je wachtwoord.
          </p>
        </section>

        <section aria-labelledby="tweestap-titel" className="paneel space-y-3 p-4">
          <h2 id="tweestap-titel" className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-6 shrink-0 text-primary" aria-hidden />
            Tweestapsverificatie (2FA)
          </h2>
          <p className="text-base">
            Voor gewone accounts is tweestapsverificatie nog niet beschikbaar. Je account is
            beschermd met je wachtwoord; Foodlo vraagt nooit je wachtwoord via e-mail of chat.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
            <li>Kies een wachtwoord dat je nergens anders gebruikt.</li>
            <li>Meld je af op toestellen die je niet (meer) kent.</li>
          </ul>
          {profiel ? (
            <p className="text-base" data-testid="tweestap-beheer">
              Voor het Control Center stel je 2FA in bij Beheer › Beveiliging. Let op: de server
              eist die tweede stap nog niet af; dat gaat pas aan na het akkoord op het herstelplan
              (zodat je jezelf niet buitensluit).
            </p>
          ) : null}
        </section>

        <Groep titel="Meer">
          <LinkRij
            to="/instellingen"
            icoon={ShieldCheck}
            tint="grijs"
            titel="Wachtwoord veranderen"
          />
        </Groep>
      </div>
    </AppShell>
  );
}
