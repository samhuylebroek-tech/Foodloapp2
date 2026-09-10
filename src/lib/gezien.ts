const SLEUTEL = "samenkoken-gezien";

export function gezienIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SLEUTEL);
    const lijst = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(lijst) ? lijst.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markeerGezien(id: string) {
  if (typeof window === "undefined") return;
  try {
    const lijst = gezienIds().filter((x) => x !== id);
    lijst.push(id);
    window.localStorage.setItem(SLEUTEL, JSON.stringify(lijst.slice(-500)));
  } catch {
    // opslag niet beschikbaar — geen probleem
  }
}
