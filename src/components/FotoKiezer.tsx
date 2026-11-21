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
  rustig = false,
}: {
  bezig?: boolean;
  heeftFoto?: boolean;
  onBestand: (bestand: File) => void;
  className?: string;
  /** Voor extra foto's (naast de hoofdfoto): andere, duidelijke labels. */
  extra?: boolean;
  /** Onder een receptomslag: lichte, omlijnde knoppen die de omslag niet overstemmen. */
  rustig?: boolean;
}) {
  const knop = `flex w-full cursor-pointer flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl px-3 text-center text-base font-semibold leading-tight transition-colors hover:bg-muted focus-within:outline focus-within:outline-3 focus-within:outline-ring ${
    rustig
      ? "min-h-12 border border-dashed border-border bg-transparent py-1.5 text-muted-foreground"
      : "min-h-14 border border-border bg-secondary py-2"
  }`;

  return (
    <div
      className={`grid gap-2 ${rustig ? "grid-cols-2" : "grid-cols-1 min-[400px]:grid-cols-2"} ${className}`}
    >
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
