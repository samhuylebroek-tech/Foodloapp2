import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translateTexts } from "@/lib/vertaal.functions";

export const TALEN = [
  { code: "nl", label: "Nederlands" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "pl", label: "Polski" },
  { code: "tr", label: "Türkçe" },
  { code: "ar", label: "العربية" },
] as const;

export const THEMAS = [
  { id: "sage", label: "Sage & slate" },
  { id: "warm", label: "Warme keuken" },
  { id: "fris", label: "Fris groen" },
  { id: "donker", label: "Donker" },
  { id: "contrast", label: "Extra duidelijk" },
] as const;

export type ThemaId = (typeof THEMAS)[number]["id"];

type Ctx = {
  taal: string;
  zetTaal: (t: string) => void;
  thema: ThemaId;
  zetThema: (t: ThemaId) => void;
  t: (tekst: string) => string;
};

const VoorkeurenCtx = createContext<Ctx>({
  taal: "nl",
  zetTaal: () => {},
  thema: "sage",
  zetThema: () => {},
  t: (tekst) => tekst,
});

function cacheKey(taal: string) {
  return `vertaling:${taal}`;
}

function leesCache(taal: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(cacheKey(taal)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function VoorkeurenProvider({ children }: { children: ReactNode }) {
  const [taal, setTaal] = useState("nl");
  const [thema, setThema] = useState<ThemaId>("warm");
  const [cache, setCache] = useState<Record<string, string>>({});

  const wachtrij = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bezig = useRef(false);

  useEffect(() => {
    const bewaardeTaal = window.localStorage.getItem("taal");
    const bewaardThema = window.localStorage.getItem("thema") as ThemaId | null;
    if (bewaardeTaal) setTaal(bewaardeTaal);
    if (bewaardThema) setThema(bewaardThema);
  }, []);

  useEffect(() => {
    setCache(leesCache(taal));
    wachtrij.current.clear();
    const el = document.documentElement;
    el.setAttribute("lang", taal);
    el.setAttribute("dir", taal === "ar" ? "rtl" : "ltr");
  }, [taal]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("dark", "thema-fris", "thema-contrast");
    if (thema === "donker") el.classList.add("dark");
    if (thema === "fris") el.classList.add("thema-fris");
    if (thema === "contrast") el.classList.add("thema-contrast");
  }, [thema]);

  const flush = useCallback(async () => {
    if (bezig.current) return;
    const items = [...wachtrij.current].slice(0, 60);
    if (!items.length) return;
    bezig.current = true;
    const huidigeTaal = taal;
    try {
      const vertaald = await translateTexts({ data: { texts: items, lang: huidigeTaal } });
      const nieuw: Record<string, string> = {};
      items.forEach((tekst, i) => {
        nieuw[tekst] = vertaald[i] ?? tekst;
        wachtrij.current.delete(tekst);
      });
      setCache((prev) => {
        const samen = { ...prev, ...nieuw };
        try {
          window.localStorage.setItem(cacheKey(huidigeTaal), JSON.stringify(samen));
        } catch {
          // cache mag mislukken
        }
        return samen;
      });
    } catch {
      items.forEach((tekst) => wachtrij.current.delete(tekst));
    } finally {
      bezig.current = false;
      if (wachtrij.current.size) {
        timer.current = setTimeout(() => void flush(), 300);
      }
    }
  }, [taal]);

  const t = useCallback(
    (tekst: string) => {
      if (taal === "nl" || !tekst || !tekst.trim()) return tekst;
      const gevonden = cache[tekst];
      if (gevonden) return gevonden;
      if (!wachtrij.current.has(tekst)) {
        wachtrij.current.add(tekst);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 250);
      }
      return tekst;
    },
    [taal, cache, flush],
  );

  const zetTaal = useCallback((nieuw: string) => {
    setTaal(nieuw);
    window.localStorage.setItem("taal", nieuw);
  }, []);

  const zetThema = useCallback((nieuw: ThemaId) => {
    setThema(nieuw);
    window.localStorage.setItem("thema", nieuw);
  }, []);

  return (
    <VoorkeurenCtx.Provider value={{ taal, zetTaal, thema, zetThema, t }}>
      {children}
    </VoorkeurenCtx.Provider>
  );
}

export function useVoorkeuren() {
  return useContext(VoorkeurenCtx);
}

/** Korte hulp: const t = useT(); <p>{t("Recepten")}</p> */
export function useT() {
  return useContext(VoorkeurenCtx).t;
}
