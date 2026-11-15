import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Groot, duidelijk tekstveld met label boven en fout eronder (designsysteem §5). */
export function Veld({
  label,
  waarde,
  onWijzig,
  fout,
  verplicht,
  meerRegels,
  type = "text",
  uitleg,
  disabled,
}: {
  label: string;
  waarde: string;
  onWijzig: (v: string) => void;
  fout?: string | null | undefined;
  verplicht?: boolean | undefined;
  meerRegels?: boolean | undefined;
  type?: "text" | "url" | "date" | "number";
  uitleg?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const id = useId();
  const foutId = `${id}-fout`;
  const uitlegId = `${id}-uitleg`;
  const beschreven = [fout ? foutId : null, uitleg ? uitlegId : null].filter(Boolean).join(" ");
  const gemeen = {
    id,
    value: waarde,
    disabled,
    required: verplicht,
    "aria-invalid": fout ? true : undefined,
    "aria-describedby": beschreven || undefined,
    className: "min-h-14 text-base",
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      {uitleg ? (
        <p id={uitlegId} className="text-[0.95rem] text-muted-foreground">
          {uitleg}
        </p>
      ) : null}
      {meerRegels ? (
        <Textarea {...gemeen} rows={3} onChange={(e) => onWijzig(e.target.value)} />
      ) : (
        <Input
          {...gemeen}
          // "url" zonder https:// zou de browser weigeren; wij vullen het zelf aan.
          type={type === "url" ? "text" : type}
          inputMode={type === "url" ? "url" : undefined}
          onChange={(e) => onWijzig(e.target.value)}
        />
      )}
      {fout ? (
        <p id={foutId} className="text-[0.95rem] font-semibold text-destructive">
          {fout}
        </p>
      ) : null}
    </div>
  );
}

export function Keuze<T extends string>({
  label,
  waarde,
  onWijzig,
  opties,
  disabled,
}: {
  label: string;
  waarde: T;
  onWijzig: (v: T) => void;
  opties: readonly { waarde: T; label: string }[];
  disabled?: boolean | undefined;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={waarde}
        disabled={disabled}
        onChange={(e) => onWijzig(e.target.value as T)}
        className="min-h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
