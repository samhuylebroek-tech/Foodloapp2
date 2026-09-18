import { useEffect, useRef, useState } from "react";
import { useNavigate, Link as RouterLink } from "@tanstack/react-router";
import {
  BookOpen,
  Camera,
  Link2,
  Loader2,
  Sparkles,
  ChevronDown,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadRecipePhoto, uploadDataUrl, fileToDataUrl, isAfbeelding } from "@/lib/photos";
import { FotoKiezer } from "@/components/FotoKiezer";
import {
  importRecipeFromUrl,
  importRecipeFromText,
  importRecipeFromScreenshot,
  recognizeIngredients,
  recipeFromPhoto,
  gerechtFoto,
  gerechtVoorstellen,
  receptVanNaam,
  zoekReceptenOpWeb,
  type GerechtVoorstel,
  type WebResultaat,
  type ImportedRecipe,
} from "@/lib/ai.functions";
import { CATEGORIES, DIFFICULTIES, type Ingredient, type Recipe } from "@/lib/types";
import { parseIngredientText, ingredientToLine } from "@/lib/ingredienten";
import { kiesSoort, raadSoort } from "@/lib/soort";
import { Voedingswaarden } from "@/components/Voedingswaarden";
import { koppelStappen, normaliseer, type StapKoppeling } from "@/lib/stap-ingredienten";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { creditOverzicht } from "@/lib/credits.functions";

import { RecipePhoto } from "@/components/RecipePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Manier = "zoek" | "link" | "foto" | "zelf";

const PLATFORM_NAAM: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  pinterest: "Pinterest",
  website: "de website",
};


export function RecipeForm({
  recipe,
  ingredients,
  gedeeld,
}: {
  recipe?: Recipe;
  ingredients?: Ingredient[];
  gedeeld?: { title?: string | undefined; text?: string | undefined; url?: string | undefined };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const gedeeldeTekst = [gedeeld?.title, gedeeld?.text].filter(Boolean).join("\n\n");
  const gedeeldeLink =
    gedeeld?.url ?? [gedeeld?.text, gedeeld?.title].join(" ").match(/https?:\/\/\S+/)?.[0] ?? "";

  const [manier, setManier] = useState<Manier>("link");
  const [ingevuld, setIngevuld] = useState(Boolean(recipe));

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [prep, setPrep] = useState(String(recipe?.prep_minutes ?? 15));
  const [cook, setCook] = useState(String(recipe?.cook_minutes ?? 20));
  const [category, setCategory] = useState(recipe?.category ?? "hoofdgerecht");
  // Zodra jij zelf een soort kiest, laten we de automatische gok los.
  const [soortHandmatig, setSoortHandmatig] = useState(Boolean(recipe));
  const [difficulty, setDifficulty] = useState(recipe?.difficulty ?? "makkelijk");
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", "));
  const [photoPath, setPhotoPath] = useState<string | null>(recipe?.image_url ?? null);
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? gedeeldeLink);
  const [ingredientTekst, setIngredientTekst] = useState(
    (ingredients ?? []).map(ingredientToLine).join("\n"),
  );
  const [stappenTekst, setStappenTekst] = useState((recipe?.instructions ?? []).join("\n"));
  const [stapKeuze, setStapKeuze] = useState<StapKoppeling>(recipe?.step_ingredients ?? {});
  const [meerDetails, setMeerDetails] = useState(false);

  // Stappen en ingrediënten zoals ze nu in het formulier staan
  const stappen = stappenTekst
    .split("\n")
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  const formIngredienten = parseIngredientText(ingredientTekst);
  const stapKoppeling = koppelStappen(stappen, formIngredienten, stapKeuze);

  /** Zet een ingrediënt aan of uit bij een stap; vanaf dan telt de eigen keuze. */
  function wisselStapIngredient(stapIndex: number, naam: string) {
    setStapKeuze((vorig) => {
      const huidig =
        vorig[String(stapIndex)] ??
        (stapKoppeling[stapIndex] ?? []).map((idx) => formIngredienten[idx]!.name);
      const staatAan = huidig.some((n) => normaliseer(n) === normaliseer(naam));
      const nieuw = staatAan
        ? huidig.filter((n) => normaliseer(n) !== normaliseer(naam))
        : [...huidig, naam];
      return { ...vorig, [String(stapIndex)]: nieuw };
    });
  }



  const [importUrl, setImportUrl] = useState(gedeeldeLink);
  const [vrijeTekst, setVrijeTekst] = useState(gedeeldeTekst);

  const [importInfo, setImportInfo] = useState<
    { platform: string; gratis: boolean; ontbrekend: string[] } | null
  >(null);

  const [importing, setImporting] = useState(false);
  const [lezenTekst, setLezenTekst] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [suggereren, setSuggereren] = useState(false);
  const [screenshotBezig, setScreenshotBezig] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voorstelFoto, setVoorstelFoto] = useState<string | null>(null);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [fotoGeweigerd, setFotoGeweigerd] = useState(false);
  const laatsteFotoTitel = useRef("");

  // Een gerecht zoeken op naam
  const [zoekTerm, setZoekTerm] = useState("");
  const [zoekBezig, setZoekBezig] = useState(false);
  const [voorstellen, setVoorstellen] = useState<GerechtVoorstel[] | null>(null);
  const [webResultaten, setWebResultaten] = useState<WebResultaat[] | null>(null);
  const [webBezig, setWebBezig] = useState(false);
  const [webOphalen, setWebOphalen] = useState<string | null>(null);
  const [uitschrijven, setUitschrijven] = useState<string | null>(null);
  // Voorbeeld van een gevonden recept: eerst bekijken/aanpassen, dan pas overnemen.
  const [voorbeeld, setVoorbeeld] = useState<ImportedRecipe | null>(null);
  const [vbTitel, setVbTitel] = useState("");
  const [vbIngredienten, setVbIngredienten] = useState("");
  const [vbStappen, setVbStappen] = useState("");
  const [vbSoort, setVbSoort] = useState<string>("hoofdgerecht");
  const [vensterOpen, setVensterOpen] = useState(false);
  const [vbBezig, setVbBezig] = useState(false);
  const [vbFout, setVbFout] = useState<string | null>(null);

  /** Sluit het venster en maakt alles leeg. */
  function sluitVenster() {
    setVensterOpen(false);
    setVoorbeeld(null);
    setVbBezig(false);
    setVbFout(null);
  }

  /** Toont het gevonden recept in een venster om na te kijken. */
  function toonVoorbeeld(data: ImportedRecipe) {
    setVensterOpen(true);
    setVbBezig(false);
    setVbFout(null);
    setVoorbeeld(data);
    setVbTitel(data.title);
    setVbIngredienten(
      data.ingredients
        .map((i) => ingredientToLine({ name: i.name, quantity: i.quantity, unit: i.unit ?? "" }))
        .join("\n"),
    );
    setVbStappen(data.instructions.join("\n"));
    setVbSoort(
      kiesSoort(
        data.category,
        data.title,
        data.tags,
        data.ingredients.map((i) => i.name),
      ),
    );
  }

  /** Bouwt het nagekeken recept uit de velden in het venster. */
  function voorbeeldRecept(): ImportedRecipe | null {
    if (!voorbeeld) return null;
    return {
      ...voorbeeld,
      title: vbTitel.trim() || voorbeeld.title,
      ingredients: parseIngredientText(vbIngredienten).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit ?? "",
      })),
      category: vbSoort,
      instructions: vbStappen
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  /** Neemt het nagekeken voorbeeld over in het formulier om nog aan te passen. */
  function bevestigVoorbeeld() {
    const bijgewerkt = voorbeeldRecept();
    if (!bijgewerkt) return;
    vulIn(bijgewerkt);
    if (bijgewerkt.source_url) setSourceUrl(bijgewerkt.source_url);
    sluitVenster();
    toast.success("Het recept staat in het formulier. Sla het op als het klopt.");
  }

  /** Bewaart het nagekeken recept meteen bij jouw gerechten. */
  async function bewaarVoorbeeld() {
    const r = voorbeeldRecept();
    if (!r) return;
    vulIn(r);
    if (r.source_url) setSourceUrl(r.source_url);
    sluitVenster();
    await handleSave({
      title: r.title,
      description: r.description,
      servings: Number(r.servings) || 1,
      prep: Number(r.prep_minutes) || 0,
      cook: Number(r.cook_minutes) || 0,
      category: kiesSoort(
        r.category,
        r.title,
        r.tags,
        r.ingredients.map((i) => i.name),
      ),
      difficulty: DIFFICULTIES.includes(r.difficulty as never) ? r.difficulty : "makkelijk",
      tags: r.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      stappen: r.instructions,
      ingredienten: r.ingredients
        .map((i) => ingredientToLine({ name: i.name, quantity: i.quantity, unit: i.unit ?? "" }))
        .join("\n"),
      sourceUrl: r.source_url ?? null,
    });
  }
  const bestaande = useQuery({
    queryKey: ["gerecht-zoeken", zoekTerm.trim().toLowerCase()],
    enabled: zoekTerm.trim().length > 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, image_url, user_id")
        .is("deleted_at", null)
        .ilike("title", `%${zoekTerm.trim()}%`)
        .limit(5);
      return data ?? [];
    },
  });

  const creditFn = useServerFn(creditOverzicht);
  const credits = useQuery({ queryKey: ["credits"], queryFn: () => creditFn(), enabled: !!user, retry: false });
  const qc = useQueryClient();

  function kost(feature: string): number {
    return credits.data?.kosten.find((k) => k.feature === feature)?.credit_cost ?? 0;
  }

  const laagSaldo =
    credits.data != null && credits.data.saldo <= credits.data.waarschuwingVanaf;


  /** Waarschuwt vooraf als het saldo te laag is. Gewone functies blijven altijd werken. */
  function magStarten(feature: string): boolean {
    const c = kost(feature);
    const saldo = credits.data?.saldo ?? 0;
    if (c > 0 && saldo < c) {
      toast.error(`Hiervoor heb je ${c} credits nodig. Je hebt er nog ${saldo}.`);
      return false;
    }
    return true;
  }

  function meldFout(err: unknown, standaard: string) {
    void qc.invalidateQueries({ queryKey: ["credits"] });
    toast.error(err instanceof Error && err.message.length < 300 ? err.message : standaard);
  }

  function naAiActie() {
    void qc.invalidateQueries({ queryKey: ["credits"] });
  }

  async function maakVoorstelFoto() {
    const naam = title.trim();
    if (!naam || fotoBezig) return;
    if (!magStarten("foto_maken")) return;
    laatsteFotoTitel.current = naam;
    setFotoBezig(true);
    try {
      const url = await gerechtFoto({ data: { titel: naam } });
      if (url) setVoorstelFoto(url);
      naAiActie();
    } catch (err) {
      meldFout(err, "De foto kon niet gemaakt worden");
    } finally {
      setFotoBezig(false);
    }
  }


  function verwijderFoto() {
    setPhotoPath(null);
    setVoorstelFoto(null);
    setFotoGeweigerd(true);
  }

  // Bewust geen automatische AI-foto: slimme functies starten alleen als jij erop tikt.


  // Raadt de soort mee terwijl je typt, tot je zelf een soort kiest.
  useEffect(() => {
    if (soortHandmatig) return;
    if (!title.trim() && !ingredientTekst.trim()) return;
    setCategory(
      raadSoort(
        title,
        tags.split(",").map((t) => t.trim()),
        parseIngredientText(ingredientTekst).map((i) => i.name),
      ),
    );
  }, [title, tags, ingredientTekst, soortHandmatig]);

  function vulIn(data: ImportedRecipe) {
    setTitle(data.title);
    setDescription(data.description);
    setServings(String(data.servings));
    setPrep(String(data.prep_minutes));
    setCook(String(data.cook_minutes));
    setCategory(
      kiesSoort(
        data.category,
        data.title,
        data.tags,
        data.ingredients.map((i) => i.name),
      ),
    );
    setSoortHandmatig(true);
    setDifficulty(DIFFICULTIES.includes(data.difficulty as never) ? data.difficulty : "makkelijk");
    setTags(data.tags.join(", "));
    if (data.ingredients.length)
      setIngredientTekst(
        data.ingredients
          .map((i) => ingredientToLine({ name: i.name, quantity: i.quantity, unit: i.unit ?? "" }))
          .join("\n"),
      );
    if (data.instructions.length) setStappenTekst(data.instructions.join("\n"));
    if (data.image_url) setPhotoPath(data.image_url);
    setIngevuld(true);
  }

  async function handleFotoSuggestie(file: File) {
    if (!magStarten("gerecht_foto")) return;
    setSuggereren(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const data = await recipeFromPhoto({ data: { imageDataUrl } });
      vulIn(data);
      naAiActie();
      if (user) {
        try {
          const path = await uploadRecipePhoto(file, user.id);
          setPhotoPath(path);
        } catch {
          // foto bewaren mag mislukken, het recept blijft staan
        }
      }
      toast.success("Voorstel klaar. Lees het even na en pas aan wat je anders wil.");
    } catch (err) {
      meldFout(err, "We konden hier geen gerecht van maken");
    } finally {
      setSuggereren(false);
    }
  }

  async function handleScreenshot(file: File) {
    if (!magStarten("import_foto")) return;
    setScreenshotBezig(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const data = await importRecipeFromScreenshot({ data: { imageDataUrl } });
      vulIn(data);
      naAiActie();
      toast.success("Recept van je schermafbeelding gehaald. Lees het even na.");
    } catch (err) {
      meldFout(err, "We konden geen recept uit deze afbeelding halen");
    } finally {
      setScreenshotBezig(false);
    }
  }

  /** Zoekt echte receptpagina's op het web. Kost geen credits. */
  async function handleZoek() {
    const term = zoekTerm.trim();
    if (term.length < 3) {
      toast.error("Typ eerst de naam van een gerecht");
      return;
    }
    setWebBezig(true);
    setVoorstellen(null);
    try {
      const lijst = await zoekReceptenOpWeb({ data: { term } });
      setWebResultaten(lijst);
      if (!lijst.length) {
        toast.message("Niets gevonden op het web. Probeer 'Nieuwe ideeën'.");
      }
    } catch (err) {
      setWebResultaten([]);
      meldFout(err, "Zoeken is niet gelukt");
    } finally {
      setWebBezig(false);
    }
  }

  /** Haalt het gekozen webrecept op via de gewone import. Het venster gaat meteen open. */
  async function kiesWeb(r: WebResultaat) {
    setWebOphalen(r.url);
    setVoorbeeld(null);
    setVbFout(null);
    setVbBezig(true);
    setVensterOpen(true);
    try {
      const data = await importRecipeFromUrl({ data: { url: r.url } });
      if (data.fout) {
        setVbBezig(false);
        setVbFout(data.fout);
        return;
      }
      toonVoorbeeld({ ...data, source_url: data.source_url ?? r.url });
      naAiActie();
    } catch (err) {
      setVbBezig(false);
      setVbFout("We konden dit recept niet ophalen van de website.");
      meldFout(err, "We konden dit recept niet ophalen");
    } finally {
      setWebOphalen(null);
    }
  }

  /** Laat de AI het recept uitschrijven (kost credits) en toont het in hetzelfde venster. */
  async function schrijfMetAi(titel: string) {
    if (!magStarten("import_tekst")) return;
    setVoorbeeld(null);
    setVbFout(null);
    setVbBezig(true);
    setVensterOpen(true);
    try {
      const data = await receptVanNaam({ data: { titel } });
      toonVoorbeeld(data);
      naAiActie();
    } catch (err) {
      setVbBezig(false);
      setVbFout("We konden dit recept niet uitschrijven.");
      meldFout(err, "We konden dit recept niet uitschrijven");
    }
  }

  /** Extra: laat de AI varianten bedenken (kost credits). */
  async function handleIdeeen() {
    const term = zoekTerm.trim();
    if (term.length < 3) {
      toast.error("Typ eerst de naam van een gerecht");
      return;
    }
    if (!magStarten("suggesties")) return;
    setZoekBezig(true);
    try {
      const lijst = await gerechtVoorstellen({ data: { term } });
      setVoorstellen(lijst);
      naAiActie();
      if (!lijst.length) toast.error("We vonden hier geen varianten van");
    } catch (err) {
      meldFout(err, "Zoeken is niet gelukt");
    } finally {
      setZoekBezig(false);
    }
  }

  async function kiesVoorstel(v: GerechtVoorstel) {
    if (!magStarten("import_tekst")) return;
    setUitschrijven(v.title);
    try {
      const data = await receptVanNaam({ data: { titel: v.title, hint: v.omschrijving } });
      toonVoorbeeld(data);
      naAiActie();
    } catch (err) {
      meldFout(err, "We konden dit recept niet uitschrijven");
    } finally {
      setUitschrijven(null);
    }
  }

  async function handleTekst() {
    if (vrijeTekst.trim().length < 5) {
      toast.error("Plak eerst wat tekst");
      return;
    }
    if (!magStarten("import_tekst")) return;
    setLezenTekst(true);
    try {
      const data = await importRecipeFromText({ data: { text: vrijeTekst.trim() } });
      vulIn(data);
      naAiActie();
      toast.success("We hebben alles ingevuld. Controleer het even en sla op.");
    } catch (err) {
      meldFout(err, "Hier konden we geen recept uit halen");
    } finally {
      setLezenTekst(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!user) return;
    if (!isAfbeelding(file)) {
      toast.error("Kies een foto (jpg of png)");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadRecipePhoto(file, user.id);
      setPhotoPath(path);
      setVoorstelFoto(null);
      setFotoGeweigerd(false);
      toast.success("Foto bewaard");
    } catch {
      toast.error("De foto kon niet worden opgeslagen. Probeer het opnieuw.");
    } finally {
      setUploading(false);
    }
  }

  async function handleIngredientPhoto(file: File) {
    if (!magStarten("ingredienten_foto")) return;
    setRecognizing(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const found = await recognizeIngredients({ data: { imageDataUrl } });
      naAiActie();
      if (!found.length) {
        toast.error("Geen ingrediënten herkend");
        return;
      }
      setIngredientTekst((prev) => [prev.trim(), found.join("\n")].filter(Boolean).join("\n"));
      toast.success(`${found.length} ingrediënten herkend`);
    } catch (err) {
      meldFout(err, "Herkennen is niet gelukt");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleImport() {
    if (!importUrl.trim()) return;
    if (!magStarten("import_url")) return;
    setImporting(true);
    setImportInfo(null);
    try {
      const data = await importRecipeFromUrl({ data: { url: importUrl.trim() } });
      if (data.fout) {
        toast.error(data.fout);
        return;
      }
      vulIn(data);

      naAiActie();
      setSourceUrl(data.source_url ?? importUrl.trim());
      const ontbrekend = (data.ontbrekend ?? []).filter((v) => v !== "foto");
      setImportInfo({
        platform: data.platform ?? "website",
        gratis: data.bron === "paginagegevens",
        ontbrekend,
      });
      toast.success(
        data.bron === "paginagegevens"
          ? "Recept ingelezen zonder credits. Controleer het even en sla op."
          : "Recept ingelezen. Controleer het even en sla op.",
      );
    } catch (err) {
      meldFout(err, "Dit recept kon niet worden ingelezen");
    } finally {
      setImporting(false);
    }
  }




  /** Gegevens die het venster meteen kan opslaan, zonder op de formulierstate te wachten. */
  type DirecteOpslag = {
    title: string;
    description: string;
    servings: number;
    prep: number;
    cook: number;
    category: string;
    difficulty: string;
    tags: string[];
    stappen: string[];
    ingredienten: string;
    sourceUrl: string | null;
  };

  async function handleSave(over?: DirecteOpslag) {
    if (!user) return;
    const naam = (over?.title ?? title).trim();
    if (!naam) {
      toast.error("Geef het gerecht een naam");
      return;
    }
    setSaving(true);
    try {
      let bewaardeFoto = photoPath;
      if (!bewaardeFoto && voorstelFoto && !fotoGeweigerd) {
        try {
          bewaardeFoto = await uploadDataUrl(voorstelFoto, user.id);
          setPhotoPath(bewaardeFoto);
        } catch {
          bewaardeFoto = null;
        }
      }
      const ingredientenBron = over ? over.ingredienten : ingredientTekst;
      const payload = {
        user_id: user.id,
        title: naam,
        description: (over?.description ?? description).trim(),
        image_url: bewaardeFoto,
        servings: over ? over.servings : Number(servings) || 1,
        prep_minutes: over ? over.prep : Number(prep) || 0,
        cook_minutes: over ? over.cook : Number(cook) || 0,
        difficulty: over?.difficulty ?? difficulty,
        category: over?.category ?? category,
        tags: over
          ? over.tags
          : tags
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
        instructions: over ? over.stappen : stappen,
        step_ingredients: !over && Object.keys(stapKeuze).length ? stapKeuze : null,
        source_url: over ? over.sourceUrl : sourceUrl.trim() || null,
      };


      let recipeId = recipe?.id;
      if (recipeId) {
        // Vorige versie bewaren zodat je ze later kan terugzetten.
        try {
          const [oud, oudeIngredienten] = await Promise.all([
            supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle(),
            supabase.from("recipe_ingredients").select("*").eq("recipe_id", recipeId),
          ]);
          if (oud.data) {
            await supabase.from("recipe_versions").insert({
              recipe_id: recipeId,
              gewijzigd_door: user.id,
              momentopname: { recept: oud.data, ingredienten: oudeIngredienten.data ?? [] },
            });
          }
        } catch {
          /* geschiedenis mag het opslaan nooit tegenhouden */
        }
        const { error } = await supabase.from("recipes").update(payload).eq("id", recipeId);
        if (error) throw error;
        await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
      } else {
        const { data, error } = await supabase
          .from("recipes")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        recipeId = data.id;
      }

      const cleanRows = parseIngredientText(ingredientenBron).map((r, index) => ({
        recipe_id: recipeId!,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        position: index,
      }));
      if (cleanRows.length) {
        const { error } = await supabase.from("recipe_ingredients").insert(cleanRows);
        if (error) throw error;
      }

      toast.success("Recept opgeslagen");
      navigate({ to: "/recepten/$id", params: { id: recipeId! } });
    } catch (err) {
      const melding = err instanceof Error ? err.message : "";
      if (melding.includes("RECEPT_LIMIET")) {
        toast.error(melding.split("RECEPT_LIMIET:").pop()?.trim() ?? "Je hebt het maximum aantal gerechten bereikt.");
      } else {
        toast.error("Opslaan is niet gelukt");
      }

    } finally {
      setSaving(false);
    }
  }

  const manieren: { id: Manier; label: string; icon: typeof Link2 }[] = [
    { id: "zoek", label: "Zoeken", icon: Search },
    { id: "link", label: "Plak link of tekst", icon: Link2 },
    { id: "foto", label: "AI foto", icon: Camera },
    { id: "zelf", label: "Zelf typen", icon: Pencil },
  ];


  return (
    <div className="space-y-6">
      {!recipe && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg">Hoe wil je beginnen?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {manieren.map((m) => {
              const Icon = m.icon;
              const actief = manier === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setManier(m.id)}
                  aria-pressed={actief}
                  className={
                    actief
                      ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-primary px-2 text-base font-semibold text-primary-foreground"
                      : "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary px-2 text-base font-semibold"
                  }
                >
                  <Icon className="size-6" aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>

          {laagSaldo && (
            <p className="mt-3 text-sm text-muted-foreground">
              Nog {credits.data?.saldo ?? 0} credits over.{" "}
              <RouterLink to="/credits" className="font-semibold underline">
                Bekijk je credits
              </RouterLink>
            </p>
          )}


          {manier === "zoek" && (
            <div className="mt-4">
              <p className="text-base text-muted-foreground">
                Typ de naam van een gerecht, bijvoorbeeld “balletjes in tomatensaus Jeroen Meus”. Je
                ziet wat je al hebt en echte recepten van het web. Zoeken kost geen credits.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={zoekTerm}
                  onChange={(e) => setZoekTerm(e.target.value)}
                  placeholder="Balletjes in tomatensaus"
                  aria-label="Naam van het gerecht"
                  className="h-14 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleZoek();
                    }
                  }}
                />
                <Button onClick={() => void handleZoek()} disabled={webBezig} className="h-14 px-6 text-base">
                  {webBezig ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
                  Zoeken
                </Button>
              </div>

              {(bestaande.data?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-base font-semibold">Al in je app</p>
                  <ul className="mt-2 space-y-2">
                    {(bestaande.data ?? []).map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/recepten/$id", params: { id: r.id } })}
                          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left text-base font-semibold hover:bg-muted"
                        >
                          <BookOpen className="size-5 shrink-0 text-primary" aria-hidden />
                          <span className="min-w-0 flex-1 break-words">{r.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {webResultaten && webResultaten.length > 0 && (
                <div className="mt-4">
                  <p className="text-base font-semibold">Gevonden op het web</p>
                  <ul className="mt-2 space-y-2">
                    {webResultaten.map((r) => (
                      <li key={r.url}>
                        <button
                          type="button"
                          disabled={webOphalen !== null}
                          onClick={() => void kiesWeb(r)}
                          className="flex min-h-16 w-full items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left hover:bg-muted"
                        >
                          {webOphalen === r.url ? (
                            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
                          ) : (
                            <Link2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-base font-semibold">
                              {r.titel}
                            </span>
                            <span className="mt-0.5 block text-sm text-primary">{r.site}</span>
                            {r.fragment ? (
                              <span className="mt-0.5 block text-base text-muted-foreground">
                                {r.fragment}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We halen het recept van de gekozen pagina op, met bronvermelding.
                  </p>
                </div>
              )}

              {webResultaten && webResultaten.length === 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                  <p className="text-base font-semibold">
                    We vonden geen betrouwbaar recept voor “{zoekTerm.trim()}”.
                  </p>
                  <p className="mt-1 text-base text-muted-foreground">
                    Laat de AI het recept uitschrijven. Je kan het daarna nog nakijken en aanpassen.
                  </p>
                  <Button
                    onClick={() => void schrijfMetAi(zoekTerm.trim())}
                    className="mt-3 h-14 w-full text-base"
                  >
                    <Sparkles className="size-5" />
                    Laat de AI dit recept uitschrijven
                  </Button>
                </div>
              )}

              {webResultaten && webResultaten.length > 0 && !voorstellen && (
                <Button
                  variant="outline"
                  onClick={() => void handleIdeeen()}
                  disabled={zoekBezig}
                  className="mt-4 h-14 w-full text-base"
                >
                  {zoekBezig ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                  Nieuwe ideeën met AI
                </Button>
              )}

              {voorstellen && voorstellen.length > 0 && (
                <div className="mt-4">
                  <p className="text-base font-semibold">Nieuwe ideeën</p>
                  <ul className="mt-2 space-y-2">
                    {voorstellen.map((v) => (
                      <li key={v.title}>
                        <button
                          type="button"
                          disabled={uitschrijven !== null}
                          onClick={() => void kiesVoorstel(v)}
                          className="flex min-h-16 w-full items-start gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-left hover:bg-muted"
                        >
                          {uitschrijven === v.title ? (
                            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
                          ) : (
                            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold">{v.title}</span>
                            {v.omschrijving ? (
                              <span className="mt-0.5 block text-base text-muted-foreground">
                                {v.omschrijving}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block text-sm text-muted-foreground">
                              ± {v.minuten} min
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Een idee kiezen schrijft het volledige recept uit met AI.
                  </p>
                </div>
              )}
            </div>
          )}

          {manier === "link" && (
            <div className="mt-4">
              <p className="text-base text-muted-foreground">
                Plak de link van een recept, ook van Instagram, TikTok, YouTube, Facebook of
                Pinterest. Wij vullen alles voor je in.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  aria-label="Link naar het recept"
                  className="h-14 text-base"
                />
                <Button onClick={handleImport} disabled={importing} className="h-14 px-6 text-base">
                  {importing ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                  Inlezen
                </Button>
              </div>

              {importInfo && (
                <div className="mt-3 rounded-2xl border border-border bg-secondary p-4 text-base">
                  <p className="font-semibold">
                    Ingelezen van {PLATFORM_NAAM[importInfo.platform] ?? "de website"}
                    {importInfo.gratis ? " — zonder credits" : ""}
                  </p>
                  {importInfo.ontbrekend.length > 0 ? (
                    <p className="mt-1 text-muted-foreground">
                      Niet alles stond erbij: vul zelf nog {importInfo.ontbrekend.join(" en ")} aan.
                      Je kan ook een schermafbeelding toevoegen met “AI foto”.
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      Kijk het even na en pas aan wat je anders wil.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-base text-muted-foreground">
                  Of plak hier gewoon de tekst van het recept: van Instagram, een bericht of je
                  eigen notities.
                </p>
              </div>
              <Textarea
                value={vrijeTekst}
                onChange={(e) => setVrijeTekst(e.target.value)}
                rows={5}
                placeholder="Plak of typ hier de tekst…"
                className="mt-3 text-base"
                aria-label="Tekst van het recept"
              />
              <Button onClick={handleTekst} disabled={lezenTekst} className="mt-3 h-14 w-full text-base">
                {lezenTekst ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Sparkles className="size-5" />
                )}
                Recept eruit halen
              </Button>

            </div>
          )}

          {manier === "foto" && (
            <div className="mt-4">
              <p className="text-base text-muted-foreground">
                Heb je een schermafbeelding van een recept (bijvoorbeeld van Instagram)? Kies die
                hieronder. Of kies een foto van een klaar gerecht: dan bedenken wij een voorstel.
              </p>
              <label className="mt-3 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 text-base font-semibold">
                {screenshotBezig ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
                Schermafbeelding van Instagram of een website
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleScreenshot(f);
                  }}
                />
              </label>

              <label className="mt-3 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground">
                {suggereren ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Sparkles className="size-5" />
                )}
                Maak een recept van mijn foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFotoSuggestie(f);
                  }}
                />
              </label>

            </div>
          )}

          {manier === "zelf" && (
            <p className="mt-4 text-base text-muted-foreground">
              Vul hieronder gewoon een naam in. Ingrediënten en stappen mag je later aanvullen.
            </p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div>
          <Label htmlFor="title" className="text-base">
            Naam van het gerecht
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijvoorbeeld: Stoofvlees van oma"
            className="mt-2 h-14 text-base"
          />
        </div>

        <div>
          <Label htmlFor="servings-top" className="text-base">
            Voor hoeveel personen zijn deze ingrediënten?
          </Label>
          <div className="mt-2 flex w-full items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setServings(String(Math.max(1, (Number(servings) || 1) - 1)))}
              aria-label="Minder personen"
              className="size-12 shrink-0 sm:size-14"
            >
              –
            </Button>
            <Input
              id="servings-top"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              inputMode="numeric"
              className="h-12 min-w-0 flex-1 text-center text-base sm:h-14 sm:w-24 sm:flex-none"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setServings(String((Number(servings) || 0) + 1))}
              aria-label="Meer personen"
              className="size-12 shrink-0 sm:size-14"
            >
              +
            </Button>
            <span className="shrink-0 text-base text-muted-foreground">personen</span>
          </div>
        </div>


        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="ingredienten" className="text-base">
              Ingrediënten — één per regel
            </Label>
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold">
              {recognizing ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Camera className="size-5" />
              )}
              Herken op foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleIngredientPhoto(f);
                }}
              />
            </label>
          </div>
          <Textarea
            id="ingredienten"
            value={ingredientTekst}
            onChange={(e) => setIngredientTekst(e.target.value)}
            rows={6}
            placeholder={"500 g bloem\n2 eieren\nsnuf zout"}
            className="mt-2 text-base"
          />
        </div>

        <Voedingswaarden
          ingredienten={parseIngredientText(ingredientTekst)}
          porties={Number(servings) || 1}
        />

        <div>
          <Label htmlFor="stappen" className="text-base">
            Bereiding — één stap per regel
          </Label>
          <Textarea
            id="stappen"
            value={stappenTekst}
            onChange={(e) => setStappenTekst(e.target.value)}
            rows={7}
            placeholder={"Verwarm de oven op 180 graden.\nMeng de bloem met de eieren."}
            className="mt-2 text-base"
          />
        </div>

        {stappen.length > 0 && formIngredienten.length > 0 && (
          <div>
            <Label className="text-base">Wat gebruik je bij elke stap?</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              We raden het zelf al aan. Tik een ingrediënt aan of uit om het bij te sturen.
            </p>
            <div className="mt-3 space-y-3">
              {stappen.map((s, i) => {
                const aan = new Set(
                  (stapKoppeling[i] ?? []).map((idx) => normaliseer(formIngredienten[idx]!.name)),
                );
                return (
                  <div key={i} className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-base">
                      <span className="mr-2 font-semibold text-primary">{i + 1}</span>
                      {s}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formIngredienten.map((ing, idx) => {
                        const actief = aan.has(normaliseer(ing.name));
                        return (
                          <button
                            key={`${i}-${idx}`}
                            type="button"
                            aria-pressed={actief}
                            onClick={() => wisselStapIngredient(i, ing.name)}
                            className={
                              actief
                                ? "inline-flex min-h-11 items-center rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                                : "inline-flex min-h-11 items-center rounded-xl border border-border bg-secondary px-3 text-base text-muted-foreground"
                            }
                          >
                            {ing.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        <div>
          <Label className="text-base">Foto van het gerecht</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative shrink-0">
              <RecipePhoto
                path={photoPath ?? voorstelFoto}
                alt={title || "Gerecht"}
                className="size-24 rounded-2xl"
              />
              {(photoPath || voorstelFoto) && (
                <button
                  type="button"
                  onClick={verwijderFoto}
                  aria-label="Foto verwijderen"
                  className="absolute -right-2 -top-2 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow"
                >
                  <X className="size-5" aria-hidden />
                </button>
              )}
              {fotoBezig && !photoPath && !voorstelFoto && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-card/70">
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <FotoKiezer
                bezig={uploading}
                heeftFoto={!!(photoPath || voorstelFoto)}
                onBestand={(f) => void handlePhoto(f)}
              />
              {!photoPath && voorstelFoto && (
                <p className="text-sm text-muted-foreground">
                  Voorgestelde foto. Niet goed? Klik op het kruisje.
                </p>
              )}
              {!photoPath && !voorstelFoto && (
                <button
                  type="button"
                  onClick={() => {
                    setFotoGeweigerd(false);
                    void maakVoorstelFoto();
                  }}
                  className="block text-base font-semibold text-primary"
                >
                  Stel een foto voor
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setMeerDetails(!meerDetails)}
          aria-expanded={meerDetails}
          className="flex min-h-14 w-full items-center justify-between px-4 text-left text-base font-semibold"
        >
          Meer details (personen, tijd, soort) — mag je overslaan
          <ChevronDown
            className={meerDetails ? "size-6 rotate-180 transition" : "size-6 transition"}
            aria-hidden
          />
        </button>

        {meerDetails && (
          <div className="space-y-4 border-t border-border p-4">
            <div>
              <Label htmlFor="description" className="text-base">
                Korte omschrijving
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <Label htmlFor="prep" className="text-base">
                  Voorbereiden (min)
                </Label>
                <Input
                  id="prep"
                  value={prep}
                  onChange={(e) => setPrep(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-14 text-base"
                />
              </div>
              <div>
                <Label htmlFor="cook" className="text-base">
                  Koken (min)
                </Label>
                <Input
                  id="cook"
                  value={cook}
                  onChange={(e) => setCook(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-14 text-base"
                />
              </div>
              <div className="sm:col-span-2">
                <p className="text-base font-medium">Soort gerecht</p>
                <SoortKeuze
                  waarde={category}
                  onKies={(c) => {
                    setCategory(c);
                    setSoortHandmatig(true);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="difficulty" className="text-base">
                  Moeilijkheid
                </Label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-2 h-14 w-full rounded-xl border border-input bg-card px-3 text-base"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="tags" className="text-base">
                  Labels (met komma)
                </Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="vegetarisch, snel"
                  className="mt-2 h-14 text-base"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {ingevuld && !recipe && (
        <p className="text-base text-muted-foreground">
          Alles ingevuld op basis van wat je gaf. Lees het even na en pas aan wat je anders wil.
        </p>
      )}

      <Button onClick={() => void handleSave()} disabled={saving} className="h-16 w-full text-lg">
        {saving ? <Loader2 className="size-5 animate-spin" /> : null}
        Recept opslaan
      </Button>

      <Dialog open={vensterOpen} onOpenChange={(open) => !open && sluitVenster()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-xl">Gevonden recept</DialogTitle>
            <DialogDescription className="text-left text-base">
              Kijk het even na en pas aan wat je anders wil. Daarna neem je het over.
            </DialogDescription>
          </DialogHeader>
          {vbBezig && (
            <p className="flex items-center gap-3 py-6 text-base text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              Recept wordt opgehaald…
            </p>
          )}
          {!vbBezig && vbFout && (
            <div className="py-2">
              <p className="text-base">{vbFout}</p>
              <Button
                onClick={() => void schrijfMetAi(zoekTerm.trim() || vbTitel)}
                className="mt-3 h-14 w-full text-base"
              >
                <Sparkles className="size-5" />
                Laat de AI dit recept uitschrijven
              </Button>
            </div>
          )}
          <div className={voorbeeld && !vbBezig ? "space-y-4" : "hidden"}>
            <div>
              <Label htmlFor="vb-titel" className="text-base">
                Naam
              </Label>
              <Input
                id="vb-titel"
                value={vbTitel}
                onChange={(e) => setVbTitel(e.target.value)}
                className="mt-2 h-14 text-base"
              />
            </div>
            <div>
              <Label htmlFor="vb-ing" className="text-base">
                Ingrediënten
              </Label>
              <Textarea
                id="vb-ing"
                value={vbIngredienten}
                onChange={(e) => setVbIngredienten(e.target.value)}
                rows={6}
                className="mt-2 text-base"
              />
            </div>
            <div>
              <Label htmlFor="vb-stap" className="text-base">
                Bereiding
              </Label>
              <Textarea
                id="vb-stap"
                value={vbStappen}
                onChange={(e) => setVbStappen(e.target.value)}
                rows={8}
                className="mt-2 text-base"
              />
            </div>
            {voorbeeld?.source_url ? (
              <p className="break-words text-sm text-muted-foreground">
                Bron: {voorbeeld.source_url}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {voorbeeld && !vbBezig ? (
              <>
                <Button variant="outline" onClick={bevestigVoorbeeld} className="h-14 text-base">
                  Eerst aanpassen
                </Button>
                <Button
                  onClick={() => void bewaarVoorbeeld()}
                  disabled={saving}
                  className="h-14 text-base"
                >
                  {saving ? "Bezig met bewaren…" : "Bewaar bij mijn recepten"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={sluitVenster} className="h-14 text-base">
                Annuleren
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
