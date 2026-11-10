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
  extra = false,
}: {
  bezig?: boolean;
  heeftFoto?: boolean;
  onBestand: (bestand: File) => void;
  className?: string;
  /** Voor extra foto's (naast de hoofdfoto): andere, duidelijke labels. */
  extra?: boolean;
}) {
  const knop =
    "flex min-h-14 w-full cursor-pointer flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl py-2 border border-border bg-secondary px-3 text-center text-base font-semibold leading-tight transition-colors hover:bg-muted focus-within:outline focus-within:outline-3 focus-within:outline-ring";

  return (
    <div className={`grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 ${className}`}>
      <label className={knop}>
        {bezig ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-5" aria-hidden />
        )}
        {extra ? "Extra foto nemen" : heeftFoto ? "Nieuwe foto nemen" : "Foto nemen"}
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
        {extra ? "Extra foto kiezen" : heeftFoto ? "Andere foto kiezen" : "Foto kiezen"}
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
