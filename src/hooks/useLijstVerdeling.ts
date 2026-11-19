/**
 * P5 — De lijst verdelen: wie haalt wat en in welke winkel, met de rechten van de kijker.
 *
 * Opslag: `lijst_toewijzingen` (voorstel 0017) of, zolang die tabel niet bestaat, op dit toestel
 * (dan ziet alleen dit toestel de verdeling; de app zegt dat ook). Toewijzen aan een gezinslid
 * stuurt die persoon een melding in de app ("Marie vraagt of jij brood haalt").
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import type { ShoppingList } from "@/lib/boodschappen";
import {
  bewaarToestelVerdeling,
  leesToestelVerdeling,
  lijstRechten,
  schoneWinkel,
  zetToewijzing,
  type LijstRechten,
  type Toewijzing,
} from "@/lib/samenwerking/verdelen";
import { itemRegel } from "@/lib/samenwerking/conflict";
import { toegewezenTekst } from "@/lib/samenwerking/meldingen";
import {
  logActiviteit,
  mijnNaam,
  namenVan,
  stuurMelding,
  TOEWIJZINGEN_TABEL,
} from "@/lib/samenwerking/db";

export type GezinsLid = { id: string; naam: string };

const ALLES: LijstRechten = { afvinken: true, bewerken: true, verwijderen: true, verdelen: true };

export function useLijstVerdeling(lijst: Pick<ShoppingList, "id" | "group_id"> | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar, laden: modLaden } = useModuleBeschikbaar(TOEWIJZINGEN_TABEL);
  const listId = lijst?.id ?? null;
  const groupId = lijst?.group_id ?? null;
  const sleutel = ["lijst-verdeling", listId, beschikbaar];

  const { data: toewijzingen = [] } = useQuery({
    queryKey: sleutel,
    enabled: !!user && !!listId && !modLaden,
    staleTime: 15_000,
    queryFn: async (): Promise<Toewijzing[]> => {
      if (!beschikbaar) return leesToestelVerdeling(listId!);
      const { data, error } = await db
        .from(TOEWIJZINGEN_TABEL)
        .select("item_id, toegewezen_aan, winkel")
        .eq("list_id", listId!);
      if (error) return leesToestelVerdeling(listId!);
      return (data ?? []) as Toewijzing[];
    },
  });

  // Gezinsleden (met account) en mijn eigen rechten op deze gezinslijst.
  const { data: gezin } = useQuery({
    queryKey: ["lijst-gezin", groupId, user?.id],
    enabled: !!user && !!groupId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("user_id, rol, status, shopping_view, shopping_edit")
        .eq("group_id", groupId!);
      const rijen = (data ?? []) as {
        user_id: string;
        rol: string;
        status: string;
        shopping_view: boolean;
        shopping_edit: boolean;
      }[];
      const actief = rijen.filter((r) => r.status === "actief");
      const namen = await namenVan(actief.map((r) => r.user_id));
      // Kind in het huishouden (voorstel 0010)? Ontbreekt de tabel, dan geldt de gewone rol.
      let kind = false;
      try {
        const { data: hl, error } = await db
          .from("huishouden_leden")
          .select("rol")
          .eq("group_id", groupId!)
          .eq("user_id", user!.id)
          .limit(1);
        kind = !error && (hl ?? [])[0]?.rol === "kind";
      } catch {
        kind = false;
      }
      const ik = rijen.find((r) => r.user_id === user!.id) ?? null;
      return {
        leden: actief.map((r) => ({ id: r.user_id, naam: namen[r.user_id] || "Gezinslid" })),
        namen,
        ik,
        kind,
      };
    },
  });

  const rechten: LijstRechten = !groupId
    ? ALLES
    : gezin
      ? lijstRechten({
          gezinslijst: true,
          eigenaarVanLijst: gezin.ik?.rol === "eigenaar" && gezin.ik.status === "actief",
          lid: gezin.ik,
          huishoudRol: gezin.kind ? "kind" : null,
        })
      : // Nog aan het laden: afvinken mag al, de rest wacht.
        { afvinken: true, bewerken: false, verwijderen: false, verdelen: false };

  /** Wie haalt het / welke winkel. `item` voor de melding ("vraagt of jij 2 l melk haalt"). */
  async function wijs(
    item: { id: string; name: string; quantity: number | null; unit: string },
    nieuw: { aan: string | null; winkel: string | null },
  ): Promise<boolean> {
    if (!user || !listId || !rechten.verdelen) return false;
    const aan = groupId ? nieuw.aan : null;
    const winkel = schoneWinkel(nieuw.winkel);
    const vorig = toewijzingen.find((t) => t.item_id === item.id);
    if ((vorig?.toegewezen_aan ?? null) === aan && (vorig?.winkel ?? null) === winkel) return true;
    const lijstNa = zetToewijzing(toewijzingen, { item_id: item.id, toegewezen_aan: aan, winkel });
    qc.setQueryData(sleutel, lijstNa);
    try {
      if (beschikbaar) {
        const { error } =
          aan || winkel
            ? await db
                .from(TOEWIJZINGEN_TABEL)
                .upsert(
                  { item_id: item.id, list_id: listId, toegewezen_aan: aan, winkel },
                  { onConflict: "item_id" },
                )
            : await db.from(TOEWIJZINGEN_TABEL).delete().eq("item_id", item.id);
        if (error) throw error;
      } else bewaarToestelVerdeling(listId, lijstNa);
    } catch {
      qc.setQueryData(sleutel, toewijzingen);
      return false;
    }
    // Nieuw toegewezen aan iemand anders: die krijgt een melding en het gezinslog een regel.
    if (groupId && aan && aan !== vorig?.toegewezen_aan) {
      const ik = await mijnNaam(user.id);
      const product = itemRegel(item);
      void stuurMelding({
        groupId,
        actorId: user.id,
        soort: "toegewezen",
        naar: [aan],
        link: "/boodschappen?lijst=gezin",
        tekst: toegewezenTekst({ wie: ik, product }),
      });
      void logActiviteit({
        groupId,
        actorId: user.id,
        soort: "toewijzing",
        tekst: `${product}: ${aan === user.id ? "haalt " + (ik ?? "iemand") + " zelf" : "gevraagd aan " + (gezin?.namen[aan] || "een gezinslid")}`,
        refId: item.id,
      });
    }
    return true;
  }

  return {
    toewijzingen,
    leden: (gezin?.leden ?? []) as GezinsLid[],
    namen: gezin?.namen ?? {},
    rechten,
    opslag: beschikbaar ? ("account" as const) : ("toestel" as const),
    wijs,
  };
}
