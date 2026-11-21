/**
 * P5 — De meldingen in de app (bel-icoon): van je gezin (`app_meldingen`, voorstel 0017) en
 * restjes die bijna over datum zijn (afgeleid op dit toestel, niets opgeslagen).
 * Soorten die je uitzette, verschijnen niet en tellen niet mee. Ververst bij focus, elke minuut
 * en (waar Realtime werkt) meteen.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMeldingInstellingen } from "@/hooks/useMeldingInstellingen";
import { useRestjes } from "@/hooks/useRestjes";
import { bijnaOpRestjes } from "@/lib/intelligentie/restjes";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { haalVolgendFeed } from "@/lib/makers-db";
import { nieuwVanGevolgden } from "@/lib/makers-feed";
import { MELDINGEN_TABEL } from "@/lib/samenwerking/db";
import {
  aantalOngelezen,
  restjeTekst,
  veiligeLink,
  zichtbareMeldingen,
  type AppMelding,
  type MeldingSoort,
} from "@/lib/samenwerking/meldingen";
import { lokaleDatum } from "@/lib/tijd";

const gelezenSleutel = (userId: string) => `foodlo:meldingen-gelezen:${userId}`;
function leesGelezen(userId: string): string[] {
  try {
    const l = JSON.parse(window.localStorage.getItem(gelezenSleutel(userId)) ?? "[]") as unknown;
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(-200) : [];
  } catch {
    return [];
  }
}
function bewaarGelezen(userId: string, ids: string[]) {
  try {
    window.localStorage.setItem(gelezenSleutel(userId), JSON.stringify(ids.slice(-200)));
  } catch {
    // Opslag geblokkeerd: gelezen tot je de pagina sluit.
  }
}

export function useAppMeldingen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { inst } = useMeldingInstellingen();
  const { beschikbaar } = useModuleBeschikbaar(MELDINGEN_TABEL);
  const restjes = useRestjes();
  const [gelezen, setGelezen] = useState<string[]>([]);
  useEffect(() => {
    if (user) setGelezen(leesGelezen(user.id));
  }, [user]);

  const sleutel = ["app-meldingen", user?.id];
  const { data: gezin = [] } = useQuery({
    queryKey: sleutel,
    enabled: !!user && beschikbaar,
    staleTime: 20_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AppMelding[]> => {
      const { data, error } = await db
        .from(MELDINGEN_TABEL)
        .select("id, soort, tekst, link, gelezen_op, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id as string,
        soort: r.soort as MeldingSoort,
        tekst: r.tekst as string,
        link: veiligeLink(r.link),
        gelezen: !!r.gelezen_op,
        op: r.created_at as string,
        bron: "gezin" as const,
      }));
    },
  });

  // Nieuwe melding van een gezinslid: meteen tonen (waar Realtime werkt).
  useEffect(() => {
    if (!user || !beschikbaar) return;
    const kanaal = supabase
      .channel(`app-meldingen:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: MELDINGEN_TABEL, filter: `user_id=eq.${user.id}` },
        () => void qc.invalidateQueries({ queryKey: ["app-meldingen"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kanaal);
    };
  }, [user, beschikbaar, qc]);

  // Fase 4: nieuw recept van een maker die je volgt — afgeleid op dit toestel uit de feed
  // "Volgend" (zelfde query als op Ontdek). De maker krijgt hier niets van te zien.
  const volgen = useModuleBeschikbaar("follows");
  const makerAan = !inst.uit.includes("maker");
  const { data: volgend } = useQuery({
    queryKey: ["volgend-feed", user?.id],
    enabled: !!user && volgen.beschikbaar && makerAan,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: () => haalVolgendFeed(user!.id),
  });

  const vandaag = lokaleDatum();
  const alle = useMemo(() => {
    const vanMakers: AppMelding[] = volgend
      ? nieuwVanGevolgden(volgend.feed, volgend.volgt).map((m) => ({
          id: m.id,
          soort: "maker",
          tekst: m.tekst,
          link: veiligeLink(m.link),
          gelezen: gelezen.includes(m.id),
          op: m.op,
          bron: "toestel",
        }))
      : [];
    const vanRestjes: AppMelding[] = bijnaOpRestjes(restjes).map((r) => {
      const id = `restje:${r.id}:${r.laatsteDag ? "laatst" : "bijna"}`;
      return {
        id,
        soort: "restje",
        tekst: restjeTekst(r),
        link: "/",
        gelezen: gelezen.includes(id),
        op: `${vandaag}T07:00:00`,
        bron: "toestel",
      };
    });
    return [...gezin, ...vanRestjes, ...vanMakers];
  }, [gezin, restjes, gelezen, vandaag, volgend]);

  const lijst = zichtbareMeldingen(alle, inst);
  const ongelezen = aantalOngelezen(alle, inst);

  async function markeer(ids: string[]) {
    if (!user || !ids.length) return;
    const opToestel = (id: string) => id.startsWith("restje:") || id.startsWith("maker:");
    const lokaal = ids.filter(opToestel);
    const opAccount = ids.filter((id) => !opToestel(id));
    if (lokaal.length) {
      const nieuw = [...new Set([...gelezen, ...lokaal])];
      setGelezen(nieuw);
      bewaarGelezen(user.id, nieuw);
    }
    if (opAccount.length) {
      qc.setQueryData<AppMelding[]>(sleutel, (oud) =>
        (oud ?? []).map((m) => (opAccount.includes(m.id) ? { ...m, gelezen: true } : m)),
      );
      const { error } = await db
        .from(MELDINGEN_TABEL)
        .update({ gelezen_op: new Date().toISOString() })
        .in("id", opAccount);
      if (error) void qc.invalidateQueries({ queryKey: ["app-meldingen"] });
    }
  }

  return {
    lijst,
    ongelezen,
    markeer,
    allesGelezen: () => markeer(lijst.filter((m) => !m.gelezen).map((m) => m.id)),
  };
}
