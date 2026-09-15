import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "recipe-photos";

export function isAfbeelding(file: File) {
  return file.type.startsWith("image/");
}

/**
 * Foto's van een telefoon zijn snel enkele megabytes. We verkleinen ze naar
 * maximaal 1600 pixels en bewaren als JPEG. Lukt dat niet, dan gebruiken we
 * gewoon het origineel.
 */
export async function verkleinFoto(file: File, maxZijde = 1600): Promise<File> {
  try {
    if (typeof document === "undefined" || file.type === "image/gif") return file;
    const bron = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    const schaal = Math.min(1, maxZijde / Math.max(bron.width, bron.height));
    if (schaal >= 1 && file.size < 1_500_000) {
      URL.revokeObjectURL(bron.src);
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bron.width * schaal);
    canvas.height = Math.round(bron.height * schaal);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bron, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bron.src);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadRecipePhoto(file: File, userId: string) {
  if (!isAfbeelding(file)) throw new Error("GEEN_AFBEELDING");
  const klein = await verkleinFoto(file);
  const ext = klein.type === "image/jpeg" ? "jpg" : klein.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, klein, {
    cacheControl: "3600",
    upsert: false,
    contentType: klein.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadDataUrl(dataUrl: string, userId: string) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const file = new File([blob], `voorstel.${ext}`, { type: blob.type || "image/jpeg" });
  return uploadRecipePhoto(file, userId);
}
