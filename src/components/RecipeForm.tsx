import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Link2, Loader2, Plus, Trash2, Sparkles, ClipboardType } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadRecipePhoto, fileToDataUrl } from "@/lib/photos";
import {
  importRecipeFromUrl,
  importRecipeFromText,
  recognizeIngredients,
  type ImportedRecipe,
} from "@/lib/ai.functions";
import { CATEGORIES, DIFFICULTIES, UNITS, type Ingredient, type Recipe } from "@/lib/types";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type IngredientRow = { name: string; quantity: string; unit: string };

export function RecipeForm({
  recipe,
  ingredients,
  gedeeld,
}: {
  recipe?: Recipe;
  ingredients?: Ingredient[];
  gedeeld?: { title?: string; text?: string; url?: string };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const gedeeldeTekst = [gedeeld?.title, gedeeld?.text].filter(Boolean).join("\n\n");
  const gedeeldeLink =
    gedeeld?.url ?? [gedeeld?.text, gedeeld?.title].join(" ").match(/https?:\/\/\S+/)?.[0] ?? "";

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [prep, setPrep] = useState(String(recipe?.prep_minutes ?? 15));
  const [cook, setCook] = useState(String(recipe?.cook_minutes ?? 20));
  const [category, setCategory] = useState(recipe?.category ?? "hoofdgerecht");
  const [difficulty, setDifficulty] = useState(recipe?.difficulty ?? "makkelijk");
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", "));
  const [photoPath, setPhotoPath] = useState<string | null>(recipe?.image_url ?? null);
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? gedeeldeLink);
  const [rows, setRows] = useState<IngredientRow[]>(
    ingredients?.length
      ? ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity === null ? "" : String(i.quantity),
          unit: i.unit,
        }))
      : [{ name: "", quantity: "", unit: "" }],
  );
  const [steps, setSteps] = useState<string[]>(
    recipe?.instructions?.length ? recipe.instructions : [""],
  );

  const [importUrl, setImportUrl] = useState(gedeeldeLink);
  const [vrijeTekst, setVrijeTekst] = useState(gedeeldeTekst);
  const [importing, setImporting] = useState(false);
  const [lezenTekst, setLezenTekst] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function vulIn(data: ImportedRecipe) {
    setTitle(data.title);
    setDescription(data.description);
    setServings(String(data.servings));
    setPrep(String(data.prep_minutes));
    setCook(String(data.cook_minutes));
    setCategory(CATEGORIES.includes(data.category as never) ? data.category : "hoofdgerecht");
    setDifficulty(DIFFICULTIES.includes(data.difficulty as never) ? data.difficulty : "makkelijk");
    setTags(data.tags.join(", "));
    if (data.ingredients.length)
      setRows(
        data.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity === null ? "" : String(i.quantity),
          unit: i.unit ?? "",
        })),
      );
    if (data.instructions.length) setSteps(data.instructions);
  }

  async function handleTekst() {
    if (vrijeTekst.trim().length < 5) {
      toast.error("Plak eerst wat tekst");
      return;
    }
    setLezenTekst(true);
    try {
      const data = await importRecipeFromText({ data: { text: vrijeTekst.trim() } });
      vulIn(data);
      toast.success("We hebben alles ingevuld. Controleer het even en sla op.");
    } catch {
      toast.error("Hier konden we geen recept uit halen");
    } finally {
      setLezenTekst(false);
    }
  }


  async function handlePhoto(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const path = await uploadRecipePhoto(file, user.id);
      setPhotoPath(path);
      toast.success("Foto toegevoegd");
    } catch {
      toast.error("De foto kon niet worden opgeslagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleIngredientPhoto(file: File) {
    setRecognizing(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const found = await recognizeIngredients({ data: { imageDataUrl } });
      if (!found.length) {
        toast.error("Geen ingrediënten herkend");
        return;
      }
      setRows((prev) => {
        const kept = prev.filter((r) => r.name.trim());
        return [...kept, ...found.map((name) => ({ name, quantity: "", unit: "" }))];
      });
      toast.success(`${found.length} ingrediënten herkend`);
    } catch {
      toast.error("Herkennen is niet gelukt");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const data = await importRecipeFromUrl({ data: { url: importUrl.trim() } });
      vulIn(data);
      setSourceUrl(importUrl.trim());
      toast.success("Recept ingelezen. Controleer het even en sla op.");
    } catch {
      toast.error("Dit recept kon niet worden ingelezen");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Geef het gerecht een naam");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        image_url: photoPath,
        servings: Number(servings) || 1,
        prep_minutes: Number(prep) || 0,
        cook_minutes: Number(cook) || 0,
        difficulty,
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        instructions: steps.map((s) => s.trim()).filter(Boolean),
        source_url: sourceUrl.trim() || null,
      };

      let recipeId = recipe?.id;
      if (recipeId) {
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

      const cleanRows = rows
        .filter((r) => r.name.trim())
        .map((r, index) => ({
          recipe_id: recipeId!,
          name: r.name.trim(),
          quantity: r.quantity === "" ? null : Number(r.quantity.replace(",", ".")),
          unit: r.unit,
          position: index,
        }));
      if (cleanRows.length) {
        const { error } = await supabase.from("recipe_ingredients").insert(cleanRows);
        if (error) throw error;
      }

      toast.success("Recept opgeslagen");
      navigate({ to: "/recepten/$id", params: { id: recipeId! } });
    } catch {
      toast.error("Opslaan is niet gelukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {!recipe && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-lg">
            <Link2 className="size-5 text-primary" aria-hidden /> Recept van een website halen
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Plak de link van een recept. We vullen alles alvast voor je in.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="h-14 text-base"
            />
            <Button onClick={handleImport} disabled={importing} className="h-14 px-6 text-base">
              {importing ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              Inlezen
            </Button>
          </div>
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

        <div>
          <Label className="text-base">Foto van het gerecht</Label>
          <div className="mt-2 flex items-center gap-4">
            <RecipePhoto
              path={photoPath}
              alt={title || "Gerecht"}
              className="size-24 shrink-0 rounded-2xl"
            />
            <label className="inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border border-border bg-secondary px-5 text-base font-semibold">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
              Foto kiezen
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhoto(f);
                }}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="servings" className="text-base">
              Personen
            </Label>
            <Input
              id="servings"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              inputMode="numeric"
              className="mt-2 h-14 text-base"
            />
          </div>
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
          <div>
            <Label htmlFor="category" className="text-base">
              Soort gerecht
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 h-14 w-full rounded-xl border border-input bg-card px-3 text-base"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Ingrediënten</h2>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold">
            {recognizing ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
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

        <ul className="mt-3 space-y-3">
          {rows.map((row, i) => (
            <li key={i} className="flex gap-2">
              <Input
                value={row.quantity}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (i === j ? { ...r, quantity: e.target.value } : r)))
                }
                placeholder="500"
                inputMode="decimal"
                className="h-14 w-20 text-base"
                aria-label="Hoeveelheid"
              />
              <select
                value={row.unit}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (i === j ? { ...r, unit: e.target.value } : r)))
                }
                aria-label="Eenheid"
                className="h-14 w-28 rounded-xl border border-input bg-card px-2 text-base"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u || "—"}
                  </option>
                ))}
              </select>
              <Input
                value={row.name}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (i === j ? { ...r, name: e.target.value } : r)))
                }
                placeholder="Ingrediënt"
                className="h-14 flex-1 text-base"
                aria-label="Ingrediënt"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                aria-label="Verwijder ingrediënt"
                className="h-14 w-12"
              >
                <Trash2 className="size-5" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRows([...rows, { name: "", quantity: "", unit: "" }])}
          className="mt-3 h-14 w-full text-base"
        >
          <Plus className="size-5" /> Ingrediënt toevoegen
        </Button>
      </section>

      <section>
        <h2 className="text-lg">Bereiding</h2>
        <ol className="mt-3 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-4 w-7 shrink-0 text-center text-base font-bold text-primary">
                {i + 1}
              </span>
              <Textarea
                value={step}
                onChange={(e) => setSteps(steps.map((s, j) => (i === j ? e.target.value : s)))}
                rows={2}
                placeholder="Beschrijf deze stap"
                className="text-base"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                aria-label="Verwijder stap"
                className="h-14 w-12"
              >
                <Trash2 className="size-5" />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setSteps([...steps, ""])}
          className="mt-3 h-14 w-full text-base"
        >
          <Plus className="size-5" /> Stap toevoegen
        </Button>
      </section>

      <Button onClick={handleSave} disabled={saving} className="h-16 w-full text-lg">
        {saving ? <Loader2 className="size-5 animate-spin" /> : null}
        Recept opslaan
      </Button>
    </div>
  );
}
