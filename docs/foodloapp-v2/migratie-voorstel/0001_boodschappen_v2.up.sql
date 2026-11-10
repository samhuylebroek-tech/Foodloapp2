-- VOORSTEL — NIET UITGEVOERD. Niet in supabase/migrations zetten vóór akkoord van de eigenaar
-- en een geslaagde test op staging (zie ../MIGRATIE-VOORSTEL-BOODSCHAPPEN.md).
-- Alles is additief: nieuwe tabellen en alleen nullable kolommen. V1 blijft werken.

BEGIN;

-- 1. Eigen winkels (per persoon of per huishouden), met eigen afdelingsvolgorde.
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(btrim(naam)) BETWEEN 1 AND 60),
  loyalty_store_slug text REFERENCES public.loyalty_stores(slug) ON DELETE SET NULL,
  kleur text CHECK (kleur IS NULL OR kleur ~ '^#[0-9a-fA-F]{6}$'),
  categorie_volgorde text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(categorie_volgorde) <= 30),
  positie integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_user_idx ON public.stores (user_id);
CREATE INDEX stores_group_idx ON public.stores (group_id) WHERE group_id IS NOT NULL;

-- 2. Boodschappen-sjablonen ("Weekend", "Barbecue", "Basis") met regels.
CREATE TABLE public.shopping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(btrim(naam)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopping_templates_user_idx ON public.shopping_templates (user_id);
CREATE INDEX shopping_templates_group_idx ON public.shopping_templates (group_id)
  WHERE group_id IS NOT NULL;

CREATE TABLE public.shopping_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.shopping_templates(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  quantity numeric CHECK (quantity IS NULL OR (quantity > 0 AND quantity < 100000)),
  unit text NOT NULL DEFAULT '' CHECK (char_length(unit) <= 20),
  merk text CHECK (merk IS NULL OR char_length(merk) <= 80),
  variant text CHECK (variant IS NULL OR char_length(variant) <= 80),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  positie integer NOT NULL DEFAULT 0
);
CREATE INDEX shopping_template_items_template_idx ON public.shopping_template_items (template_id);

-- 3. Extra velden op een boodschap (alle nullable: bestaande rijen blijven ongewijzigd).
ALTER TABLE public.shopping_items
  ADD COLUMN merk text CHECK (merk IS NULL OR char_length(merk) <= 80),
  ADD COLUMN variant text CHECK (variant IS NULL OR char_length(variant) <= 80),
  ADD COLUMN photo_path text CHECK (photo_path IS NULL OR char_length(photo_path) <= 300),
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN checked_at timestamptz;
CREATE INDEX shopping_items_store_idx ON public.shopping_items (store_id) WHERE store_id IS NOT NULL;

ALTER TABLE public.shopping_history
  ADD COLUMN merk text CHECK (merk IS NULL OR char_length(merk) <= 80),
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- 4. Onthouden voorkeur per product ("onze melk = halfvolle van merk X, bij winkel Y").
CREATE TABLE public.product_voorkeuren (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_sleutel text NOT NULL CHECK (char_length(product_sleutel) BETWEEN 1 AND 120),
  merk text CHECK (merk IS NULL OR char_length(merk) <= 80),
  variant text CHECK (variant IS NULL OR char_length(variant) <= 80),
  photo_path text CHECK (photo_path IS NULL OR char_length(photo_path) <= 300),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_sleutel)
);

-- 5. Rechten: zelfde model als shopping_lists (eigenaar, of lid van het huishouden).
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_voorkeuren ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stores, public.shopping_templates, public.shopping_template_items,
  public.product_voorkeuren FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores, public.shopping_templates,
  public.shopping_template_items, public.product_voorkeuren TO authenticated;
GRANT ALL ON public.stores, public.shopping_templates, public.shopping_template_items,
  public.product_voorkeuren TO service_role;

CREATE POLICY stores_eigen ON public.stores FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid())
    AND (group_id IS NULL OR public.in_groep((SELECT auth.uid()), group_id)));
CREATE POLICY stores_gezin ON public.stores FOR ALL TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep((SELECT auth.uid()), group_id))
  WITH CHECK (group_id IS NOT NULL AND public.in_groep((SELECT auth.uid()), group_id));

CREATE POLICY templates_eigen ON public.shopping_templates FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid())
    AND (group_id IS NULL OR public.in_groep((SELECT auth.uid()), group_id)));
CREATE POLICY templates_gezin ON public.shopping_templates FOR ALL TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep((SELECT auth.uid()), group_id))
  WITH CHECK (group_id IS NOT NULL AND public.in_groep((SELECT auth.uid()), group_id));

CREATE POLICY template_items_via_sjabloon ON public.shopping_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_templates t WHERE t.id = template_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shopping_templates t WHERE t.id = template_id));
  -- De subquery op shopping_templates valt zelf onder RLS: je ziet alleen regels van
  -- sjablonen die je mag zien.

CREATE POLICY voorkeuren_eigen ON public.product_voorkeuren FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- updated_at bijhouden (functie bestaat al voor shopping_lists).
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER shopping_templates_updated_at BEFORE UPDATE ON public.shopping_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Privé-bucket voor productfoto's: max 2 MB, alleen JPEG/WebP, map = eigenaar-id.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-fotos', 'product-fotos', false, 2097152, ARRAY['image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY product_fotos_lezen ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-fotos' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    -- Actieve huisgenoten mogen lezen. Bewust geen ::uuid-cast op de mapnaam (een
    -- ongeldige naam zou de hele query laten falen) en geen samen_in_groep (die negeert
    -- de status, waardoor ook openstaande uitnodigingen zouden kunnen lezen).
    OR EXISTS (
      SELECT 1 FROM public.group_members ik
      JOIN public.group_members ander ON ander.group_id = ik.group_id
      WHERE ik.user_id = (SELECT auth.uid()) AND ik.status = 'actief'
        AND ander.status = 'actief'
        AND ander.user_id::text = (storage.foldername(name))[1])));
CREATE POLICY product_fotos_schrijven ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-fotos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY product_fotos_wissen ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-fotos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

COMMIT;
