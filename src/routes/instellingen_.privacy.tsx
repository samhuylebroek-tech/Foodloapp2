/**
 * Fase 8 — Instellingen › Privacy & toestemmingen. Eén pagina met elke toestemming: wat, waarom,
 * sinds wanneer, en intrekken met de gevolgen erbij. Intrekken werkt meteen (ook vóór de
 * toestemmingentabel uit voorstel 0025 bestaat: dan op dit toestel).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";
import { ToestemmingKaart } from "@/components/privacy/ToestemmingKaart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leesToestelKennismaking, bewaarKennismaking } from "@/lib/kennismaking";
import { huidigeStatus, zetMeldingenUit } from "@/lib/meldingen";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { toestemmingDatum } from "@/lib/persoonlijke-voeding";
import { wisMijnGebruiksgegevens } from "@/lib/privacy.functions";
import { useToestemmingen, type Keuze, type Soort } from "@/lib/privacy/toestemmingen";
import { usePersoonlijkeVoeding, wisPersoonlijkeVoeding } from "@/lib/voeding-db";

export const Route = createFileRoute("/instellingen_/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & toestemmingen – Foodlo" },
      {
        name: "description",
        content:
          "Zie welke toestemmingen je gaf, sinds wanneer, en trek ze in met duidelijke uitleg.",
      },
    ],
  }),
  component: PrivacyPagina,
});

const datum = (iso: string | null | undefined) => toestemmingDatum(iso) || null;
const standTekst = (k: Keuze) => (k.aan ? "Aan" : "Uit");
const bronZin = (k: Keuze, opAccount: boolean) =>
  k.bron === "standaard"
    ? "Standaard aan (je hebt nog niets gekozen)."
    : k.bron === "account" || opAccount
      ? "Bewaard op je account."
      : "Bewaard op dit toestel (je account volgt na de activering van deze functie).";

function PrivacyPagina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { keuzes, zet, opAccount } = useToestemmingen(user?.id);
  const voeding = usePersoonlijkeVoeding();
  const wisGebruik = useServerFn(wisMijnGebruiksgegevens);
  const community = useModuleBeschikbaar("community_bijdragen");

  const gezin = useQuery({
    queryKey: ["privacy-gezin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, group_id, status, created_at")
        .eq("user_id", user!.id)
        .eq("status", "actief");
      if (error) throw error;
      const rij = data?.[0] ?? null;
      if (!rij) return null;
      const { data: g } = await supabase
        .from("groups")
        .select("naam, owner_id")
        .eq("id", rij.group_id)
        .maybeSingle();
      return { ...rij, naam: g?.naam ?? "je gezin", eigenaar: g?.owner_id === user!.id };
    },
  });
  const bijdragen = useQuery({
    queryKey: ["privacy-bijdragen", user?.id, community.beschikbaar],
    enabled: !!user && community.beschikbaar,
    queryFn: async () => {
      const { data, error } = await db
        .from("community_bijdragen")
        .select("id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) return [];
      return (data ?? []) as { id: string; created_at: string }[];
    },
  });
  const push = useQuery({ queryKey: ["push-status"], queryFn: () => huidigeStatus() });

  if (!user) return null;
  const account = voeding.data?.data ?? null;
  const toestel = leesToestelKennismaking(user.id);
  const gezondheidOpToestel = (toestel.allergieen?.length ?? 0) > 0 || !!toestel.dieet;

  async function trekGezondheidIn() {
    if (!user) return;
    try {
      // Bestaande regel (mijn-voeding): van het account wissen, op dit toestel bewaren zodat de
      // veiligheidswaarschuwingen blijven werken.
      if (account) {
        const k = leesToestelKennismaking(user.id);
        bewaarKennismaking(user.id, {
          ...k,
          allergieen: account.allergieen,
          ...(account.dieet ? { dieet: account.dieet } : {}),
        });
      }
      await wisPersoonlijkeVoeding(user.id);
      await qc.invalidateQueries({ queryKey: ["persoonlijke-voeding", user.id] });
      toast.success("Gewist van je account. Op dit toestel staan ze nog, voor je veiligheid.");
    } catch {
      toast.error("Wissen lukte niet. Probeer het opnieuw.");
    }
  }

  async function verlaatGezin() {
    if (!gezin.data) return;
    const { error } = await supabase.from("group_members").delete().eq("id", gezin.data.id);
    if (error) {
      toast.error("Het gezin verlaten lukte niet. Probeer het opnieuw.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["privacy-gezin"] });
    await qc.invalidateQueries({ queryKey: ["gezin"] });
    toast.success("Je hebt het gezin verlaten. Je eigen recepten en lijsten blijven van jou.");
  }

  async function trekCommunityIn() {
    if (!user) return;
    try {
      const { error } = await db.from("community_bijdragen").delete().eq("user_id", user.id);
      if (error && community.beschikbaar) throw error;
      // Eigen foto's bij die bijdragen (map {userId}/ in community-fotos).
      try {
        const { data: fotos } = await supabase.storage.from("community-fotos").list(user.id);
        const paden = (fotos ?? []).map((f) => `${user.id}/${f.name}`);
        if (paden.length) await supabase.storage.from("community-fotos").remove(paden);
      } catch {
        /* opslag (nog) niet beschikbaar */
      }
      // Pas na het wissen: zo betekent "Uit" ook echt "gewist".
      await zet("community", false);
      await qc.invalidateQueries({ queryKey: ["privacy-bijdragen"] });
      await qc.invalidateQueries({ queryKey: ["bijdragen"] });
      toast.success("Je reacties en foto's zijn gewist. Delen in de community staat uit.");
    } catch {
      toast.error("Wissen lukte niet. Probeer het opnieuw.");
    }
  }

  async function wissel(soort: Soort, aan: boolean) {
    try {
      await zet(soort, aan);
      if (soort === "meldingen" && !aan) {
        await zetMeldingenUit().catch(() => undefined);
        await qc.invalidateQueries({ queryKey: ["push-status"] });
      }
      if (soort === "analyse" && !aan) await wisGebruik();
      toast.success(aan ? "Weer aangezet." : "Ingetrokken.");
    } catch {
      toast.error("Dat lukte niet. Probeer het opnieuw.");
    }
  }

  const aantalBijdragen = bijdragen.data?.length ?? 0;

  return (
    <AppShell
      title="Privacy & toestemmingen"
      ondertitel="Wat je deelt, waarom, en hoe je het intrekt."
    >
      <div className="mx-auto max-w-2xl space-y-5 pb-8">
        <Link
          to="/instellingen"
          hash="account"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Instellingen
        </Link>
        <p className="text-base text-muted-foreground">
          Foodlo verkoopt nooit je gegevens. Hieronder staat elke toestemming apart. Intrekken
          gebeurt meteen; we zeggen eerst wat er met je gegevens gebeurt.
        </p>

        <ToestemmingKaart
          testId="toestemming-gezondheid"
          titel="Allergieën en dieet"
          stand={account ? "aan" : "geen"}
          standTekst={
            account
              ? "Op je account"
              : gezondheidOpToestel
                ? "Alleen op dit toestel"
                : "Niets bewaard"
          }
          wat="Je allergieën, intoleranties en dieet (gezondheidsgegevens)."
          waarom="Zodat Foodlo je waarschuwt bij recepten en voorstellen, ook op je andere toestellen. Ze gaan nooit naar de AI en nooit naar je gezin of makers."
          sinds={account ? datum(account.toestemming_op) : null}
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>We wissen ze meteen van je account (ook op je andere toestellen).</li>
              <li>
                Op dit toestel blijven ze staan, zodat de waarschuwingen hier blijven werken. Je kan
                ze daar wissen bij{" "}
                <Link to="/mijn-voeding" className="font-semibold text-primary underline">
                  Mijn allergieën en voorkeuren
                </Link>
                .
              </li>
              <li>Allergieën van gezinsleden die jij invulde, beheer je op de Gezin-pagina.</li>
            </ul>
          }
          intrekLabel="Toestemming intrekken"
          bevestigLabel="Ja, wis van mijn account"
          onIntrekken={account ? trekGezondheidIn : undefined}
          extra={
            !account ? (
              <p className="text-base">
                <Link to="/mijn-voeding" className="font-semibold text-primary underline">
                  Allergieën en voorkeuren aanpassen
                </Link>
              </p>
            ) : null
          }
        />

        <ToestemmingKaart
          testId="toestemming-gezin"
          titel="Delen met je gezin"
          stand={gezin.data ? "aan" : "geen"}
          standTekst={gezin.data ? `Lid van ${gezin.data.naam}` : "Geen gezin"}
          wat="Je gezin ziet de gezinslijst, het gezinsmenu, de gedeelde voorraad en wie wat haalt."
          waarom="Samen plannen en boodschappen doen. Je eigen recepten en je allergieën deel je niet automatisch."
          sinds={gezin.data ? datum(gezin.data.created_at) : null}
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>Je ziet de gezinslijst en het gezinsmenu niet meer.</li>
              <li>Wat jij op de gezinslijst zette, blijft daar staan voor de anderen.</li>
              <li>Je eigen recepten, lijsten en voorraad blijven van jou.</li>
            </ul>
          }
          intrekLabel="Gezin verlaten"
          bevestigLabel="Ja, verlaat het gezin"
          onIntrekken={gezin.data && !gezin.data.eigenaar ? verlaatGezin : undefined}
          extra={
            gezin.data?.eigenaar ? (
              <p className="text-base">
                Jij bent de eigenaar. Geef het gezin door of hef het op via{" "}
                <Link to="/gezin" className="font-semibold text-primary underline">
                  Gezin
                </Link>
                .
              </p>
            ) : null
          }
        />

        <ToestemmingKaart
          testId="toestemming-community"
          titel="Zichtbaar in de community"
          stand={keuzes.community.aan ? "aan" : "uit"}
          standTekst={standTekst(keuzes.community)}
          wat={
            <>
              Je voornaam bij reacties en "Ik heb het gemaakt", met je foto's. Nu:{" "}
              {aantalBijdragen === 1 ? "1 bijdrage" : `${aantalBijdragen} bijdragen`}.
            </>
          }
          waarom="Andere koks zien hoe het jou lukte. Pas zichtbaar als je zelf iets deelt."
          sinds={
            keuzes.community.sinds
              ? datum(keuzes.community.sinds)
              : datum(bijdragen.data?.[0]?.created_at)
          }
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>Al je reacties en "Ik heb het gemaakt"-foto's worden definitief gewist.</li>
              <li>Je kan niets meer delen tot je dit weer aanzet.</li>
              <li>Je makerprofiel (als je dat hebt) blijft staan; dat beheer je bij Maker.</li>
            </ul>
          }
          intrekLabel="Intrekken en wissen"
          bevestigLabel="Ja, wis mijn bijdragen"
          onIntrekken={trekCommunityIn}
          onAanzetten={() => wissel("community", true)}
          extra={
            <p className="text-[0.95rem] text-muted-foreground">
              {bronZin(keuzes.community, opAccount)}
            </p>
          }
        />

        <ToestemmingKaart
          testId="toestemming-meldingen"
          titel="Meldingen"
          stand={keuzes.meldingen.aan ? "aan" : "uit"}
          standTekst={
            !keuzes.meldingen.aan
              ? "Uit"
              : push.data === "aan"
                ? "Aan op dit toestel"
                : "Alleen in de app"
          }
          wat="Herinneringen (bv. wanneer beginnen met koken) en meldingen van je gezin."
          waarom="Zodat je op tijd begint en weet wat je gezin plande."
          sinds={datum(keuzes.meldingen.sinds)}
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>Dit toestel krijgt geen pushmeldingen meer; het toestel wordt afgemeld.</li>
              <li>
                Welke tips en meldingen je in de app ziet, kies je apart bij{" "}
                <Link
                  to="/instellingen/suggesties"
                  className="font-semibold text-primary underline"
                >
                  Suggesties en meldingen
                </Link>
                .
              </li>
            </ul>
          }
          onIntrekken={() => wissel("meldingen", false)}
          onAanzetten={() => wissel("meldingen", true)}
          extra={
            <p className="text-[0.95rem] text-muted-foreground">
              {bronZin(keuzes.meldingen, opAccount)}
            </p>
          }
        />

        <ToestemmingKaart
          testId="toestemming-ai"
          titel="Slimme hulp (AI)"
          stand={keuzes.ai.aan ? "aan" : "uit"}
          standTekst={keuzes.ai.aan ? "Aan · minimaal" : "Uit"}
          wat={
            <>
              Alleen wat nodig is voor de vraag: de recepttekst, de foto of link die je zelf kiest,
              en neutrale smaakwensen (bv. "geen bloemkool"). <strong>Nooit</strong> je allergieën,
              dieet of gezondheid, nooit je naam of je gezin.
            </>
          }
          waarom="Recepten uit een foto of tekst halen, de kookhulp en de weekassistent."
          sinds={datum(keuzes.ai.sinds)}
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>Er gaat niets meer naar de AI-dienst; de server weigert elke slimme vraag.</li>
              <li>
                Slimme knoppen werken niet meer. Recepten zelf invoeren, zoeken, plannen en de vaste
                tips blijven gewoon werken.
              </li>
              <li>Eerdere vragen bewaren we niet; alleen het aantal (zie AI-gebruik).</li>
            </ul>
          }
          intrekLabel="AI uitzetten"
          bevestigLabel="Ja, zet AI uit"
          onIntrekken={() => wissel("ai", false)}
          onAanzetten={() => wissel("ai", true)}
          aanzetLabel="AI weer aanzetten (minimaal)"
          extra={
            <p className="text-[0.95rem] text-muted-foreground">{bronZin(keuzes.ai, opAccount)}</p>
          }
        />

        <ToestemmingKaart
          testId="toestemming-analyse"
          titel="Gebruiksanalyse"
          stand={keuzes.analyse.aan ? "aan" : "uit"}
          standTekst={standTekst(keuzes.analyse)}
          wat="Welke schermen en knoppen je gebruikt, met je toestel en browser. Nooit wat je typt, nooit je recepten."
          waarom="Zien wat werkt en wat vastloopt, om Foodlo te verbeteren."
          sinds={datum(keuzes.analyse.sinds)}
          gevolgen={
            <ul className="list-disc space-y-1 pl-5">
              <li>We meten niets meer.</li>
              <li>Je bestaande gebruiksgegevens worden meteen gewist.</li>
              <li>
                De lijst van toestellen waarop je aangemeld bent, blijft (voor je veiligheid, zie
                Aanmelden en beveiliging).
              </li>
            </ul>
          }
          intrekLabel="Intrekken en wissen"
          bevestigLabel="Ja, stop en wis"
          onIntrekken={() => wissel("analyse", false)}
          onAanzetten={() => wissel("analyse", true)}
          extra={
            <p className="text-[0.95rem] text-muted-foreground">
              {bronZin(keuzes.analyse, opAccount)}
            </p>
          }
        />

        <Groep titel="Meer">
          <LinkRij
            to="/instellingen/beveiliging"
            icoon={KeyRound}
            tint="inkt"
            titel="Aanmelden en beveiliging"
            uitleg="Waar je aangemeld bent, afmelden op andere toestellen, tweestapsverificatie"
          />
        </Groep>
      </div>
    </AppShell>
  );
}
