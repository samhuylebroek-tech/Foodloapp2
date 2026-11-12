/**
 * Foodloapp Intelligence — Context Engine (I-1). Wat is er nú aan de hand?
 * Pure functies: de klok en het weer komen van buiten. Geen netwerk, geen persoonsgegevens.
 * Weer is optioneel (I-3, na de beslissing over de weerdienst); zonder weer telt die factor niet.
 */
import { seizoen } from "@/lib/themas";
import { lokaleDatum } from "@/lib/tijd";

export type Weer = { temp: number; regen: boolean };

export type Feestdag = {
  id: string;
  naam: string;
  datum: string;
  /** Dagen tot de feestdag (0 = vandaag). */
  over: number;
  woorden: string[];
};

export type Context = {
  datum: string;
  /** 0 = maandag … 6 = zondag (zoals de weekmenu-instelling). */
  weekdag: number;
  uur: number;
  seizoen: ReturnType<typeof seizoen>;
  feest: Feestdag | null;
  weer: Weer | null;
};

/** Paaszondag (Gregoriaanse kalender, algoritme van Meeus/Jones/Butcher). */
export function paaszondag(jaar: number): Date {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jaar, maand - 1, dag);
}

type Vast = { id: string; naam: string; datum: (jaar: number) => Date; woorden: string[] };

/** Statische kalender België/Nederland. Alleen dagen waarop mensen anders koken. */
const FEESTDAGEN: Vast[] = [
  {
    id: "valentijn",
    naam: "Valentijn",
    datum: (j) => new Date(j, 1, 14),
    woorden: ["valentijn", "romantisch", "fondant", "mousse"],
  },
  {
    id: "pasen",
    naam: "Pasen",
    datum: paaszondag,
    woorden: ["pasen", "paas", "lams", "lamsbout", "brunch", "asperge"],
  },
  {
    id: "sinterklaas",
    naam: "Sinterklaas",
    datum: (j) => new Date(j, 11, 6),
    woorden: ["sinterklaas", "speculaas", "speculoos", "pepernoot", "chocolademelk", "klaasje"],
  },
  {
    id: "kerstmis",
    naam: "Kerstmis",
    datum: (j) => new Date(j, 11, 25),
    woorden: ["kerst", "kalkoen", "wild", "hertenkalf", "everzwijn", "gourmet", "fondue", "buche"],
  },
  {
    id: "oudejaar",
    naam: "Oudejaarsavond",
    datum: (j) => new Date(j, 11, 31),
    woorden: ["oudejaar", "oliebol", "hapjes", "fondue", "gourmet", "tapas"],
  },
];

/** Hoeveel dagen vooraf een feestdag meetelt (usecase 17: "10 dagen vooraf"). */
export const FEEST_VOORAF = 10;

const DAG = 86400000;
const middag = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();

/** De eerstvolgende feestdag binnen FEEST_VOORAF dagen (vandaag inbegrepen), of null. */
export function komendeFeestdag(nu: Date): Feestdag | null {
  let beste: Feestdag | null = null;
  for (const f of FEESTDAGEN) {
    for (const jaar of [nu.getFullYear(), nu.getFullYear() + 1]) {
      const d = f.datum(jaar);
      const over = Math.round((middag(d) - middag(nu)) / DAG);
      if (over < 0 || over > FEEST_VOORAF) continue;
      if (!beste || over < beste.over)
        beste = { id: f.id, naam: f.naam, datum: lokaleDatum(d), over, woorden: f.woorden };
    }
  }
  return beste;
}

export function bepaalContext(nu: Date, weer: Weer | null = null): Context {
  return {
    datum: lokaleDatum(nu),
    weekdag: (nu.getDay() + 6) % 7,
    uur: nu.getHours(),
    seizoen: seizoen(nu.getMonth()),
    feest: komendeFeestdag(nu),
    weer,
  };
}
