import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Baby, Eye, EyeOff, Plus, ShieldCheck, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { Groep } from "@/components/mobiel/Lijst";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { VoedingKeuze } from "@/components/voeding/VoedingKeuze";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  lidSamenvatting,
  magVoorkeurenBeheren,
  type HuishoudenLid,
  type HuishoudenRol,
} from "@/lib/gezin-veiligheid";
import { LEGE_VOEDING, toestemmingDatum, type Voeding } from "@/lib/persoonlijke-voeding";
import {
  bewaarLidVoeding,
  useHuishouden,
  verwijderHuishoudenLid,
  voegLidToe,
  wisLidVoeding,
} from "@/lib/voeding-db";

/**
 * Gezinsleden met voorkeuren (voorstel 0010). Ook leden zonder account (bv. kinderen).
 * Wie plant, ziet alleen of iets veilig is; de reden alleen als het lid "delen" aanzette.
 */
export function HuishoudenLeden({
  groupId,
  userId,
  mijnNaam,
  ikBenEigenaar,
}: {
  groupId: string;
  userId: string;
  mijnNaam: string;
  ikBenEigenaar: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useHuishouden(groupId);
  const [open, setOpen] = useState<HuishoudenLid | null>(null);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwRol, setNieuwRol] = useState<HuishoudenRol>("kind");
  const [bezig, setBezig] = useState(false);
  const zelfGemaakt = useRef(false);

  const leden = data?.data.leden ?? [];
  const voeding = data?.data.voeding ?? new Map();
  const ververs = () => qc.invalidateQueries({ queryKey: ["huishouden", groupId] });

  // Jezelf staat altijd in de lijst van mee-eters (één keer aangemaakt, alleen je eigen rij).
  useEffect(() => {
    if (!data?.beschikbaar || zelfGemaakt.current) return;
    if (leden.some((l) => l.user_id === userId)) return;
    zelfGemaakt.current = true;
    void voegLidToe({
      group_id: groupId,
      naam: mijnNaam.split(" ")[0] || "Ik",
      rol: "volwassene",
      user_id: userId,
      beheerder_id: userId,
    })
      .then(ververs)
      .catch(() => {
        /* geen ramp: je kan jezelf later toevoegen */
      });
  }, [data, leden, userId, groupId, mijnNaam]);

  if (isLoading) return null;
  if (isError)
    return (
      <Groep titel="Wie eet mee thuis">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-base text-destructive">
            De gezinsleden laden lukte even niet.
          </p>
          <Button variant="zacht" onClick={() => void refetch()} className="w-full">
            Opnieuw proberen
          </Button>
        </div>
      </Groep>
    );
  if (!data?.beschikbaar) return <ModuleNietBeschikbaar compact naam="Voorkeuren per gezinslid" />;

  async function voegToe() {
    const naam = nieuwNaam.trim().slice(0, 40);
    if (!naam) return;
    setBezig(true);
    try {
      await voegLidToe({
        group_id: groupId,
        naam,
        rol: nieuwRol,
        user_id: null,
        beheerder_id: userId,
      });
      setNieuwNaam("");
      await ververs();
      toast.success(`${naam} staat erbij. Tik op “Voorkeuren” om allergieën in te vullen.`);
    } catch {
      toast.error("Toevoegen lukte niet");
    } finally {
      setBezig(false);
    }
  }

  async function haalWeg(l: HuishoudenLid) {
    if (!window.confirm(`${l.naam} uit de lijst van mee-eters halen? De voorkeuren worden gewist.`))
      return;
    try {
      await verwijderHuishoudenLid(l.id);
      await ververs();
      toast.success("Aangepast");
    } catch {
      toast.error("Dat lukte niet");
    }
  }

  return (
    <>
      <Groep
        titel="Wie eet mee thuis"
        voet="Wie plant, ziet alleen óf een gerecht veilig is voor iemand, niet waarom, tenzij die persoon het deelt."
      >
        <ul>
          {leden.map((l) => {
            const v = voeding.get(l.id);
            const beheer = magVoorkeurenBeheren(l, userId);
            const ik = l.user_id === userId;
            return (
              <li
                key={l.id}
                data-testid="lidkaart"
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Avatar naam={l.naam} sleutel={l.id} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-[1.05rem] font-semibold">{ik ? `${l.naam} (jij)` : l.naam}</p>
                  <p className="flex items-start gap-1.5 text-[0.95rem] text-muted-foreground">
                    {l.rol === "kind" ? (
                      <Baby className="mt-1 size-4 shrink-0" aria-hidden />
                    ) : (
                      <User className="mt-1 size-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      {l.rol === "kind"
                        ? "Kind"
                        : l.user_id
                          ? "Heeft een account"
                          : "Zonder account"}
                      {" · "}
                      {lidSamenvatting(l, v, userId)}
                      {v?.delen_met_gezin ? " · gedeeld met het gezin" : ""}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {beheer ? (
                    <Button variant="zacht" size="sm" onClick={() => setOpen(l)}>
                      Voorkeuren
                    </Button>
                  ) : null}
                  {!l.user_id && (l.beheerder_id === userId || ikBenEigenaar) ? (
                    <button
                      type="button"
                      onClick={() => void haalWeg(l)}
                      aria-label={`Uit de lijst halen: ${l.naam}`}
                      className="flex size-12 items-center justify-center rounded-full text-destructive hover:bg-muted"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-3 border-t border-border p-4">
          <Label htmlFor="nieuw-lid" className="text-[1.05rem] font-semibold">
            Iemand zonder account toevoegen
          </Label>
          <Input
            id="nieuw-lid"
            value={nieuwNaam}
            maxLength={40}
            onChange={(e) => setNieuwNaam(e.target.value)}
            placeholder="bv. Lotte"
          />
          <div role="radiogroup" aria-label="Wie is het?" className="grid grid-cols-2 gap-2">
            {(
              [
                ["kind", "Een kind"],
                ["volwassene", "Een volwassene"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={nieuwRol === id}
                onClick={() => setNieuwRol(id)}
                className={
                  nieuwRol === id
                    ? "min-h-14 rounded-2xl border-2 border-primary bg-secondary px-3 text-base font-semibold"
                    : "min-h-14 rounded-2xl border-2 border-transparent bg-card px-3 text-base font-semibold ring-1 ring-border"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => void voegToe()}
            disabled={bezig || !nieuwNaam.trim()}
            className="w-full"
          >
            <Plus className="size-5" aria-hidden /> Toevoegen
          </Button>
        </div>
      </Groep>

      {open ? (
        <VoorkeurenSheet
          lid={open}
          userId={userId}
          bestaand={voeding.get(open.id) ?? null}
          onSluit={() => setOpen(null)}
          onBewaard={() => {
            setOpen(null);
            void ververs();
          }}
        />
      ) : null}
    </>
  );
}

function VoorkeurenSheet({
  lid,
  userId,
  bestaand,
  onSluit,
  onBewaard,
}: {
  lid: HuishoudenLid;
  userId: string;
  bestaand: (Voeding & { delen_met_gezin: boolean; toestemming_op: string }) | null;
  onSluit: () => void;
  onBewaard: () => void;
}) {
  const zelf = lid.user_id === userId;
  const [v, setV] = useState<Voeding>(bestaand ?? LEGE_VOEDING);
  const [delen, setDelen] = useState(bestaand?.delen_met_gezin ?? false);
  const [toestemming, setToestemming] = useState(!!bestaand);
  const [bezig, setBezig] = useState(false);
  const wie = zelf ? "je" : lid.naam;

  async function bewaar() {
    if (!toestemming) return;
    setBezig(true);
    try {
      await bewaarLidVoeding(lid.id, v, {
        door: userId,
        soort: zelf ? "zelf" : "beheerder",
        delen,
        op: bestaand?.toestemming_op || new Date().toISOString(),
      });
      toast.success(`Voorkeuren van ${zelf ? "jou" : lid.naam} bewaard`);
      onBewaard();
    } catch {
      toast.error("Bewaren lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  async function wis() {
    if (!window.confirm("Alle voorkeuren van dit lid wissen?")) return;
    setBezig(true);
    try {
      await wisLidVoeding(lid.id);
      toast.success("Gewist");
      onBewaard();
    } catch {
      toast.error("Wissen lukte niet");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => (!o ? onSluit() : undefined)}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
          <SheetTitle>Voorkeuren van {zelf ? "jou" : lid.naam}</SheetTitle>
          <SheetDescription>
            Nooit naar de AI. Alleen gebruikt om veilig te plannen.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
          <VoedingKeuze waarde={v} onWijzig={setV} wie={wie} />

          <div className="flex min-h-16 items-center gap-4 rounded-2xl bg-muted p-4">
            {delen ? (
              <Eye className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <EyeOff className="size-6 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <Label
              htmlFor="lid-delen"
              className="min-w-0 flex-1 text-base font-semibold leading-snug"
            >
              Delen met mijn gezin
              <span className="block font-normal text-muted-foreground">
                {delen
                  ? "Het gezin ziet waarom een gerecht niet past."
                  : "Het gezin ziet alleen “niet veilig”, niet waarom."}
              </span>
            </Label>
            <Switch id="lid-delen" checked={delen} onCheckedChange={setDelen} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-honing-zacht p-4 ring-1 ring-honing/40">
            <input
              type="checkbox"
              checked={toestemming}
              onChange={(e) => setToestemming(e.target.checked)}
              className="mt-1 size-6 shrink-0 accent-primary"
            />
            <span className="text-base text-honing-foreground">
              <span className="block font-semibold">
                {zelf ? "Ik vul dit zelf in" : `Ik beheer dit voor ${lid.naam}`}
              </span>
              Ik geef toestemming om dit te bewaren voor het plannen in ons gezin.
              {bestaand?.toestemming_op
                ? ` Gegeven op ${toestemmingDatum(bestaand.toestemming_op)}.`
                : ""}
            </span>
          </label>
        </div>
        <div className="space-y-2 border-t border-border p-4">
          <Button onClick={() => void bewaar()} disabled={bezig || !toestemming} className="w-full">
            <ShieldCheck className="size-5" aria-hidden /> Bewaren
          </Button>
          {bestaand ? (
            <Button
              variant="ghost"
              onClick={() => void wis()}
              disabled={bezig}
              className="w-full text-destructive"
            >
              Toestemming intrekken en wissen
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
