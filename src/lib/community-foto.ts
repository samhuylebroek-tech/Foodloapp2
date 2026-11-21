/**
 * Fase 4 — foto bij "Ik heb het gemaakt". Verkleind op het toestel (hoogstens 1200 px, JPEG) en
 * bewaard in een eigen, privé opslagmap `community-fotos/<gebruiker>/…` (voorstel 0021: bucket
 * en regels). Getoond via een getekende link die na een uur vervalt. Zolang de communitytabel
 * niet bestaat (productie vóór 0008/0021), is de knop er niet en wordt er niets geüpload.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAfbeelding, verkleinFoto } from "@/lib/photos";

export const COMMUNITY_BUCKET = "community-fotos";
const MAX_BYTES = 5 * 1024 * 1024;

/** Alleen een pad in je eigen map; nooit een externe link of een ander bucketpad. */
export function isCommunityFotoPad(pad: unknown, userId?: string): pad is string {
  if (typeof pad !== "string") return false;
  const m = pad.match(/^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i);
  return !!m && (!userId || m[1] === userId);
}

export async function uploadCommunityFoto(file: File, userId: string): Promise<string> {
  if (!isAfbeelding(file)) throw new Error("GEEN_AFBEELDING");
  const klein = await verkleinFoto(file, 1200);
  if (klein.size > MAX_BYTES) throw new Error("TE_GROOT");
  const pad = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(pad, klein, {
    cacheControl: "3600",
    upsert: false,
    contentType: klein.type || "image/jpeg",
  });
  if (error) throw error;
  return pad;
}

export async function verwijderCommunityFoto(pad: string) {
  await supabase.storage.from(COMMUNITY_BUCKET).remove([pad]);
}

export function useCommunityFotoUrl(pad: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let actief = true;
    if (!isCommunityFotoPad(pad)) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from(COMMUNITY_BUCKET)
      .createSignedUrl(pad, 60 * 60)
      .then(({ data }) => {
        if (actief) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      actief = false;
    };
  }, [pad]);
  return url;
}
