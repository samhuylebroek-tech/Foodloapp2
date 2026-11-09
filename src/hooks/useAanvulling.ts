/** Gedeelde toegang tot "wat ontbreekt er voor je komende maaltijden?" + acties met ongedaan maken. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { HalfGelukt, haalVanLijst, laadAanvulling, vulAan, type Herstel } from "@/lib/kringloop-db";
import { meet } from "@/lib/meten";

export function useKringloopVernieuw() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["aanvulling"] });
    void qc.invalidateQueries({ queryKey: ["shopping"] });
    void qc.invalidateQueries({ queryKey: ["voorraad"] });
  };
}

/** Korte melding met één knop "Ongedaan maken". */
export function meldMetHerstel(tekst: string, herstel: Herstel, vernieuw: () => void) {
  toast.success(tekst, {
    duration: 8000,
    action: {
      label: "Ongedaan maken",
      onClick: async () => {
        try {
          await herstel();
          toast("Teruggezet");
        } catch {
          toast.error("Terugzetten lukte niet helemaal. Kijk je lijst en voorraad even na.");
        } finally {
          vernieuw();
        }
      },
    },
  });
}

export function useAanvulling() {
  const { user } = useAuth();
  const vernieuw = useKringloopVernieuw();
  const q = useQuery({
    queryKey: ["aanvulling", user?.id],
    enabled: !!user,
    staleTime: 20_000,
    queryFn: () => laadAanvulling(user!.id),
  });

  async function zetOpLijst(gekozen: Set<string> | "alles") {
    if (!user) return 0;
    try {
      const { aantal, herstel } = await vulAan(user.id, gekozen);
      vernieuw();
      if (!aantal) {
        toast("Alles staat al op je lijst");
        return 0;
      }
      void meet("kringloop.aangevuld", undefined, { aantal });
      meldMetHerstel(
        `${aantal} ${aantal === 1 ? "ding" : "dingen"} op je lijst`,
        herstel,
        vernieuw,
      );
      return aantal;
    } catch (fout) {
      toast.error(
        fout instanceof HalfGelukt
          ? "Dat lukte maar half. Kijk je lijst even na."
          : "Op je lijst zetten lukte niet. Er is niets veranderd.",
      );
      return 0;
    }
  }

  async function haalWeg(ids: string[]) {
    try {
      const herstel = await haalVanLijst(ids);
      vernieuw();
      meldMetHerstel(
        `${ids.length} ${ids.length === 1 ? "ding" : "dingen"} van je lijst gehaald`,
        herstel,
        vernieuw,
      );
    } catch {
      toast.error("Weghalen lukte niet.");
    }
  }

  return { ...q, zetOpLijst, haalWeg, vernieuw };
}
