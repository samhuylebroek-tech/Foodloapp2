export type Weer = {
  temperatuur: number;
  code: number;
  plaats: string;
};

export type WeerSfeer = {
  titel: string;
  uitleg: string;
  emoji: string;
  /** Categorieën die goed passen bij dit weer. */
  categorieen: string[];
  /** Trefwoorden in titel/tags die extra goed passen. */
  woorden: string[];
};

const STANDAARD = { lat: 50.85, lon: 4.35 };
const LOC_SLEUTEL = "foodlo_locatie";
const LOC_VRAAG_SLEUTEL = "foodlo_locatie_gevraagd";
const LOC_GELDIG = 7 * 24 * 60 * 60 * 1000; // een week

function opgeslagenLocatie(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(LOC_SLEUTEL);
    if (!raw) return null;
    const data = JSON.parse(raw) as { lat?: number; lon?: number; tijd?: number };
    if (
      typeof data.lat !== "number" ||
      typeof data.lon !== "number" ||
      typeof data.tijd !== "number" ||
      Date.now() - data.tijd > LOC_GELDIG
    ) {
      return null;
    }
    return { lat: data.lat, lon: data.lon };
  } catch {
    return null;
  }
}

function vraagLocatie(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    const fallback = setTimeout(() => resolve(STANDAARD), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallback);
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        try {
          localStorage.setItem(LOC_SLEUTEL, JSON.stringify({ ...loc, tijd: Date.now() }));
        } catch {
          /* negeren */
        }
        resolve(loc);
      },
      () => {
        clearTimeout(fallback);
        resolve(STANDAARD);
      },
      { timeout: 4000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function coords(): Promise<{ lat: number; lon: number }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return STANDAARD;

  // Eerder verleende locatie hergebruiken zonder opnieuw te vragen.
  const bewaard = opgeslagenLocatie();
  if (bewaard) return bewaard;

  // Al eens geweigerd of al eens gevraagd? Niet opnieuw storen.
  try {
    if (localStorage.getItem(LOC_VRAAG_SLEUTEL) === "ja") {
      const toestemming = await navigator.permissions?.query?.({
        name: "geolocation" as PermissionName,
      });
      if (!toestemming || toestemming.state !== "granted") return STANDAARD;
      // Toestemming staat (buiten de app om) goed: stil ophalen.
      return await vraagLocatie();
    }
  } catch {
    return STANDAARD;
  }

  // Allereerste keer: eenmalig vragen en dat onthouden.
  try {
    localStorage.setItem(LOC_VRAAG_SLEUTEL, "ja");
  } catch {
    /* negeren */
  }
  return vraagLocatie();
}

export async function haalWeer(): Promise<Weer | null> {
  try {
    const { lat, lon } = await coords();
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    if (!json.current || typeof json.current.temperature_2m !== "number") return null;
    return {
      temperatuur: Math.round(json.current.temperature_2m),
      code: json.current.weather_code ?? 0,
      plaats: "",
    };
  } catch {
    return null;
  }
}

export function sfeerVoorWeer(weer: Weer): WeerSfeer {
  const regen = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weer.code);
  const sneeuw = [71, 73, 75, 77, 85, 86].includes(weer.code);
  const zon = [0, 1].includes(weer.code);

  if (sneeuw || weer.temperatuur <= 4) {
    return {
      emoji: "❄️",
      titel: "Koud buiten",
      uitleg: "Iets warms uit de oven of een stevige stoofpot doet nu deugd.",
      categorieen: ["soep", "hoofdgerecht"],
      woorden: ["stoof", "ovenschotel", "gratin", "curry", "chili", "soep", "pasta"],
    };
  }
  if (regen) {
    return {
      emoji: "🌧️",
      titel: "Regenweer",
      uitleg: "Comfortfood-weer: iets dat lekker geurt in huis.",
      categorieen: ["soep", "hoofdgerecht"],
      woorden: ["soep", "pasta", "risotto", "ovenschotel", "stoof", "puree"],
    };
  }
  if (weer.temperatuur >= 24) {
    return {
      emoji: "☀️",
      titel: "Warm weer",
      uitleg: "Houd het fris en licht: salades, de barbecue of iets koud.",
      categorieen: ["salade", "voorgerecht", "snack"],
      woorden: ["salade", "bbq", "gegrild", "koud", "wrap", "meloen", "ijs"],
    };
  }
  if (zon) {
    return {
      emoji: "🌤️",
      titel: "Mooi weer",
      uitleg: "Perfect voor iets snels, zodat je nog buiten kan zitten.",
      categorieen: ["hoofdgerecht", "salade"],
      woorden: ["snel", "salade", "gegrild", "pasta"],
    };
  }
  return {
    emoji: "⛅",
    titel: "Zacht weer",
    uitleg: "Alles kan vandaag. Hier zijn een paar ideeën.",
    categorieen: ["hoofdgerecht"],
    woorden: [],
  };
}
