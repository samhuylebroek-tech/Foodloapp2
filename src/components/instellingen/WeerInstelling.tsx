/**
 * Instellingen › Maaltijden › Weer: zacht signaal op Vandaag en in de voorstellen. Per toestel.
 * Zonder weerbron (productie, tot de beslissing over de weerdienst) staat de schakelaar uit en
 * zegt de uitleg waarom.
 */
import { Groep } from "@/components/mobiel/Lijst";
import { Switch } from "@/components/ui/switch";
import { useWeer, useWeerAan } from "@/hooks/useWeer";

export function WeerInstelling() {
  const [aan, zet] = useWeerAan();
  const { heeftBron } = useWeer();
  return (
    <Groep
      titel="Weer"
      voet={
        heeftBron
          ? "Op warme dagen komt er iets fris bovenaan, op koude dagen iets warms. Foodlo gebruikt hier vaste testgegevens: er is nog geen echte weerdienst aangesloten. Je locatie wordt niet gevraagd. Deze keuze geldt op dit toestel."
          : "Nog geen weerdienst aangesloten. Zodra die er is, kan je het weer hier aanzetten. Zonder weer werkt alles zoals nu."
      }
    >
      <label className="flex min-h-16 cursor-pointer items-center gap-3.5 px-4 py-3">
        <span className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug">
          Weer gebruiken in voorstellen
          {heeftBron ? (
            <span className="block text-[0.95rem] font-normal text-muted-foreground">
              Testgegevens
            </span>
          ) : null}
        </span>
        <Switch checked={heeftBron && aan} disabled={!heeftBron} onCheckedChange={zet} />
      </label>
    </Groep>
  );
}
