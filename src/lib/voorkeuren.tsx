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
import { supabase } from "@/integrations/supabase/client";

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

export const ALLE_MOMENTEN = ["ontbijt", "middageten", "avondeten"] as const;
export const EEN_BLOK = ["maaltijd"] as const;

type Ctx = {
  taal: string;
  zetTaal: (t: string) => void;
  thema: ThemaId;
  zetThema: (t: ThemaId) => void;
  momenten: string[];
  zetMomenten: (m: string[]) => void;
  t: (tekst: string) => string;
};

const VoorkeurenCtx = createContext<Ctx>({
  taal: "nl",
  zetTaal: () => {},
  thema: "sage",
  zetThema: () => {},
  momenten: [...ALLE_MOMENTEN],
  zetMomenten: () => {},
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

/** Voorkeuren mee bewaren bij het account; mislukt dit, dan blijft de app gewoon werken. */
async function bewaarOpAccount(velden: {
  taal?: string;
  thema?: string;
  momenten?: string[];
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) return;
    await supabase.from("profiles").update(velden).eq("id", id);
  } catch {
    // lokaal is al bewaard
  }
}

export function VoorkeurenProvider({ children }: { children: ReactNode }) {
  const [taal, setTaal] = useState("nl");
  const [thema, setThema] = useState<ThemaId>("sage");
  const [momenten, setMomenten] = useState<string[]>([...ALLE_MOMENTEN]);
  const [cache, setCache] = useState<Record<string, string>>({});

  const wachtrij = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bezig = useRef(false);

  useEffect(() => {
    const bewaardeTaal = window.localStorage.getItem("taal");
    const bewaardThema = window.localStorage.getItem("thema") as ThemaId | null;
    if (bewaardeTaal) setTaal(bewaardeTaal);
    if (bewaardThema) setThema(bewaardThema);
    const bewaardeMomenten = window.localStorage.getItem("momenten");
    if (bewaardeMomenten) {
      try {
        const m = JSON.parse(bewaardeMomenten) as string[];
        if (Array.isArray(m) && m.length) setMomenten(m);
      } catch {
        // negeren
      }
    }
  }, []);

  // Voorkeuren van het account halen: zo staan ze ook goed op een ander toestel.
  useEffect(() => {
    let actief = true;
    async function haal(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("taal, thema, momenten")
        .eq("id", userId)
        .maybeSingle();
      if (!actief || !data) return;
      if (data.taal) {
        setTaal(data.taal);
        window.localStorage.setItem("taal", data.taal);
      }
      if (data.thema) {
        setThema(data.thema as ThemaId);
        window.localStorage.setItem("thema", data.thema);
      }
      if (Array.isArray(data.momenten) && data.momenten.length) {
        setMomenten(data.momenten);
        window.localStorage.setItem("momenten", JSON.stringify(data.momenten));
      }
    }
    void supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (id) void haal(id);
    });
    return () => {
      actief = false;
    };
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
    el.classList.remove("dark", "thema-warm", "thema-fris", "thema-contrast");
    if (thema === "donker") el.classList.add("dark");
    if (thema === "warm") el.classList.add("thema-warm");
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
    void bewaarOpAccount({ taal: nieuw });
  }, []);

  const zetThema = useCallback((nieuw: ThemaId) => {
    setThema(nieuw);
    window.localStorage.setItem("thema", nieuw);
    void bewaarOpAccount({ thema: nieuw });
  }, []);

  const zetMomenten = useCallback((nieuw: string[]) => {
    const lijst = nieuw.length ? nieuw : [...ALLE_MOMENTEN];
    setMomenten(lijst);
    window.localStorage.setItem("momenten", JSON.stringify(lijst));
    void bewaarOpAccount({ momenten: lijst });
  }, []);

  return (
    <VoorkeurenCtx.Provider value={{ taal, zetTaal, thema, zetThema, momenten, zetMomenten, t }}>
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
