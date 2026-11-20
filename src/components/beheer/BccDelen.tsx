/**
 * Gedeelde stukken voor het Business Control Center (fase 5): testmodusband, een veld voor een
 * verplichte reden, en de laad-, fout- en "binnenkort"-staten in de donkere beheerstijl.
 */
import { useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";

export function BccTestmodus({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100"
    >
      <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">
        <strong>Testmodus.</strong> {children}
      </span>
    </p>
  );
}

export function BccLaden() {
  return (
    <p role="status" className="text-slate-400">
      Laden…
    </p>
  );
}

export function BccFout({ tekst, opnieuw }: { tekst: string; opnieuw: () => void }) {
  return (
    <Kaart>
      <p role="alert" className="font-medium">
        {tekst}
      </p>
      <Button variant="secondary" className="mt-3 min-h-11" onClick={opnieuw}>
        Opnieuw proberen
      </Button>
    </Kaart>
  );
}

export function BccBinnenkort({ wat }: { wat: string }) {
  return (
    <Kaart>
      <p className="font-medium">{wat} wordt binnenkort geactiveerd.</p>
      <p className="mt-1 text-sm text-slate-300">
        De tabellen hiervoor bestaan nog niet in deze omgeving (migratievoorstel, nog niet
        uitgevoerd).
      </p>
    </Kaart>
  );
}

/** Knop die een veld voor een verplichte reden opent (min. 3 tekens). */
export function RedenKnop({
  label,
  bevestig,
  uitleg,
  bezig,
  onBevestig,
}: {
  label: string;
  bevestig: string;
  uitleg: string;
  bezig: boolean;
  onBevestig: (reden: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  if (!open)
    return (
      <Button
        variant="outline"
        className="h-auto min-h-11 whitespace-normal text-left"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  return (
    <div className="w-full space-y-2">
      <label className="block text-sm text-slate-300">
        {uitleg}
        <textarea
          value={reden}
          onChange={(e) => setReden(e.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-slate-100"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={bezig || reden.trim().length < 3}
          onClick={() => onBevestig(reden.trim())}
        >
          {bevestig}
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={() => setOpen(false)}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

export function datumTijd(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Twee stappen voor een ingrijpende actie: eerst vragen, dan pas uitvoeren. */
export function BevestigKnop({
  label,
  vraag,
  bevestig,
  bezig,
  onBevestig,
}: {
  label: string;
  vraag: string;
  bevestig: string;
  bezig: boolean;
  onBevestig: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        variant="outline"
        className="h-auto min-h-11 whitespace-normal text-left"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  return (
    <div className="w-full space-y-2" role="group" aria-label={vraag}>
      <p className="text-sm text-slate-200">{vraag}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={bezig}
          onClick={() => {
            onBevestig();
            setOpen(false);
          }}
        >
          {bevestig}
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={() => setOpen(false)}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
