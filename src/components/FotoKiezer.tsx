import { Camera, ImagePlus, Loader2 } from "lucide-react";

/**
 * Twee grote knoppen: meteen een foto nemen, of er eentje kiezen van je toestel.
 * Op één knop staat capture="environment" (camera), op de andere niet (fotorolletje).
 */
export function FotoKiezer({
  bezig,
  heeftFoto,
  onBestand,
  className = "",
}: {
  bezig?: boolean;
  heeftFoto?: boolean;
  onBestand: (bestand: File) => void;
  className?: string;
}) {
  const knop =
    "flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 text-base font-semibold transition-colors hover:bg-muted";

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      <label className={knop}>
        {bezig ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-5" aria-hidden />
        )}
        {heeftFoto ? "Nieuwe foto nemen" : "Foto nemen"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onBestand(f);
          }}
        />
      </label>

      <label className={knop}>
        <ImagePlus className="size-5" aria-hidden />
        {heeftFoto ? "Andere foto kiezen" : "Foto kiezen"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onBestand(f);
          }}
        />
      </label>
    </div>
  );
}
