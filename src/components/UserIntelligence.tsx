import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, Download, Save, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kaart } from "@/components/AdminShell";
import { GEBEURTENISSEN, GEBEURTENIS_LABEL, FEATURES } from "@/lib/meten";
import { uiExport, uiWeergaveBewaren, uiWeergaven, uiWeergaveVerwijderen } from "@/lib/user-intelligence.functions";
import { bewaarCsv } from "@/lib/csv-download";

// ---------------- zoekparameters ----------------

export const zoekSchema = z.object({
  bereik: z.enum(["vandaag", "gisteren", "zeven", "dertig", "negentig", "eigen"]).catch("dertig"),
  van: z.string().optional(),
  tot: z.string().optional(),
  zoek: z.string().catch(""),
  user: z.string().optional(),
  groep: z.string().optional(),
  status: z.enum(["alles", "nieuw", "actief", "terugkerend", "weinig", "inactief", "nooit"]).catch("alles"),
  device: z.string().catch(""),
  platform: z.string().catch(""),
  browser: z.string().catch(""),
  versie: z.string().catch(""),
  feature: z.string().catch(""),
  event: z.string().catch(""),
  sessie: z.string().optional(),
  provider: z.string().catch(""),
  model: z.string().catch(""),
  resultaat: z.enum(["alles", "gelukt", "mislukt"]).catch("alles"),
  sorteer: z.string().catch(""),
  richting: z.enum(["op", "af"]).catch("af"),
  pagina: z.number().catch(1),
});

export type Zoek = z.infer<typeof zoekSchema>;

export function naarFilters(s: Partial<Zoek>) {
  const f: Record<string, unknown> = {
    bereik: s.bereik ?? "dertig",
    zoek: s.zoek ?? "",
    userIds: s.user ? [s.user] : [],
    status: s.status ?? "alles",
    device: s.device ?? "",
    platform: s.platform ?? "",
    browser: s.browser ?? "",
    appVersion: s.versie ?? "",
    feature: s.feature ?? "",
    event: s.event ?? "",
    provider: s.provider ?? "",
    model: s.model ?? "",
    resultaat: s.resultaat ?? "alles",
    sorteer: s.sorteer ?? "",
    richting: s.richting ?? "af",
    pagina: s.pagina ?? 1,
    perPagina: 50,
  };
  if (s.van) f["van"] = s.van;
  if (s.tot) f["tot"] = s.tot;
  if (s.groep) f["groupId"] = s.groep;
  if (s.sessie) f["sessionId"] = s.sessie;
  return f as any;
}

const BEREIK_LABEL: Record<string, string> = {
  vandaag: "Vandaag",
  gisteren: "Gisteren",
  zeven: "7 dagen",
  dertig: "30 dagen",
  negentig: "90 dagen",
  eigen: "Eigen periode",
};

// ---------------- navigatie ----------------

const SUB = [
  { pad: "/beheer/ui", label: "Overzicht" },
  { pad: "/beheer/ui/gebruikers", label: "Gebruikers" },
  { pad: "/beheer/ui/activiteit", label: "Activiteit" },
  { pad: "/beheer/ui/sessies", label: "Sessies" },
  { pad: "/beheer/ui/gebeurtenissen", label: "Gebeurtenissen" },
  { pad: "/beheer/ui/ai", label: "AI & kosten" },
  { pad: "/beheer/ui/credits", label: "Credits" },
  { pad: "/beheer/ui/groepen", label: "Gezinnen" },
  { pad: "/beheer/ui/fouten", label: "Fouten" },
  { pad: "/beheer/ui/segmenten", label: "Segmenten" },
  { pad: "/beheer/ui/zoek", label: "Zoeken" },
];

export function SubNav() {
  const pad = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-white/10 pb-3">
      {SUB.map((s) => {
        const actief = s.pad === "/beheer/ui" ? pad === "/beheer/ui" : pad.startsWith(s.pad);
        return (
          <Link
            key={s.pad}
            to={s.pad}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              actief ? "bg-emerald-500/15 text-emerald-300" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Kruimels({ items }: { items: { label: string; to?: string; params?: any; search?: any }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-400">
      {items.map((i, n) => (
        <span key={n} className="flex items-center gap-1 whitespace-nowrap">
          {n > 0 ? <ChevronRight className="size-3" /> : null}
          {i.to ? (
            <Link to={i.to} params={i.params} search={i.search} className="hover:text-emerald-300 hover:underline">
              {i.label}
            </Link>
          ) : (
            <span className="text-slate-200">{i.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ---------------- filterbalk ----------------

export function FilterBalk({
  zoek,
  scherm,
  velden = [],
  exportSoort,
}: {
  zoek: Zoek;
  scherm: string;
  velden?: ("status" | "feature" | "event" | "device" | "resultaat" | "zoek")[];
  exportSoort?: "gebruikers" | "sessies" | "gebeurtenissen" | "ai" | "credits" | "fouten";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [naam, setNaam] = useState("");
  const [bewaarOpen, setBewaarOpen] = useState(false);
  const weergavenFn = useServerFn(uiWeergaven);
  const bewaarFn = useServerFn(uiWeergaveBewaren);
  const wisFn = useServerFn(uiWeergaveVerwijderen);
  const exportFn = useServerFn(uiExport);

  const weergaven = useQuery({ queryKey: ["ui-weergaven"], queryFn: () => weergavenFn({}) });

  const zet = (patch: Partial<Zoek>) =>
    navigate({ to: ".", search: (oud: any) => ({ ...oud, ...patch, pagina: 1 }) } as any);

  const bewaren = useMutation({
    mutationFn: () => bewaarFn({ data: { naam, scherm, filters: zoek as any } }),
    onSuccess: () => {
      toast.success("Weergave bewaard");
      setNaam("");
      setBewaarOpen(false);
      void qc.invalidateQueries({ queryKey: ["ui-weergaven"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bewaren lukte niet"),
  });

  const exporteren = useMutation({
    mutationFn: () => exportFn({ data: { soort: exportSoort ?? "gebruikers", filters: naarFilters(zoek) } }),
    onSuccess: (r: any) => {
      if (!r?.inhoud) {
        toast.error("Niets te exporteren");
        return;
      }
      bewaarCsv(r.bestand, r.inhoud);
    },
    onError: (e: any) => toast.error(e?.message ?? "Export lukte niet"),
  });

  const chips: { label: string; wis: Partial<Zoek> }[] = [];
  if (zoek.zoek) chips.push({ label: `zoek: ${zoek.zoek}`, wis: { zoek: "" } });
  if (zoek.user) chips.push({ label: `gebruiker: ${zoek.user.slice(0, 8)}…`, wis: { user: undefined } });
  if (zoek.groep) chips.push({ label: `gezin: ${zoek.groep.slice(0, 8)}…`, wis: { groep: undefined } });
  if (zoek.sessie) chips.push({ label: `sessie: ${zoek.sessie.slice(0, 8)}…`, wis: { sessie: undefined } });
  if (zoek.status !== "alles") chips.push({ label: `status: ${zoek.status}`, wis: { status: "alles" } });
  if (zoek.feature) chips.push({ label: `onderdeel: ${zoek.feature}`, wis: { feature: "" } });
  if (zoek.event) chips.push({ label: `gebeurtenis: ${zoek.event}`, wis: { event: "" } });
  if (zoek.device) chips.push({ label: `toestel: ${zoek.device}`, wis: { device: "" } });
  if (zoek.versie) chips.push({ label: `versie: ${zoek.versie}`, wis: { versie: "" } });
  if (zoek.provider) chips.push({ label: `aanbieder: ${zoek.provider}`, wis: { provider: "" } });
  if (zoek.model) chips.push({ label: `model: ${zoek.model}`, wis: { model: "" } });
  if (zoek.resultaat !== "alles") chips.push({ label: `resultaat: ${zoek.resultaat}`, wis: { resultaat: "alles" } });

  const sel =
    "rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="sticky top-[76px] z-10 mb-4 rounded-xl border border-white/10 bg-slate-900/90 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Periode" className={sel} value={zoek.bereik} onChange={(e) => zet({ bereik: e.target.value as any })}>
          {Object.entries(BEREIK_LABEL).map(([w, l]) => (
            <option key={w} value={w}>
              {l}
            </option>
          ))}
        </select>
        {zoek.bereik === "eigen" ? (
          <>
            <input
              type="date"
              className={sel}
              value={zoek.van ?? ""}
              onChange={(e) => zet({ van: e.target.value })}
              aria-label="Van"
            />
            <input
              type="date"
              className={sel}
              value={zoek.tot ?? ""}
              onChange={(e) => zet({ tot: e.target.value })}
              aria-label="Tot"
            />
          </>
        ) : null}

        {velden.includes("zoek") ? (
          <Input
            placeholder="Zoeken…"
            defaultValue={zoek.zoek}
            onKeyDown={(e) => {
              if (e.key === "Enter") zet({ zoek: (e.target as HTMLInputElement).value });
            }}
            className="h-9 w-48 border-white/10 bg-slate-900 text-slate-100"
          />
        ) : null}

        {velden.includes("status") ? (
          <select aria-label="Status" className={sel} value={zoek.status} onChange={(e) => zet({ status: e.target.value as any })}>
            {["alles", "nieuw", "actief", "terugkerend", "weinig", "inactief", "nooit"].map((s) => (
              <option key={s} value={s}>
                {s === "alles" ? "Alle statussen" : s}
              </option>
            ))}
          </select>
        ) : null}

        {velden.includes("feature") ? (
          <select aria-label="Functie" className={sel} value={zoek.feature} onChange={(e) => zet({ feature: e.target.value })}>
            <option value="">Alle onderdelen</option>
            {[...new Set(Object.values(FEATURES))].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : null}

        {velden.includes("event") ? (
          <select aria-label="Gebeurtenis" className={sel} value={zoek.event} onChange={(e) => zet({ event: e.target.value })}>
            <option value="">Alle gebeurtenissen</option>
            {GEBEURTENISSEN.map((e) => (
              <option key={e} value={e}>
                {GEBEURTENIS_LABEL[e] ?? e}
              </option>
            ))}
          </select>
        ) : null}

        {velden.includes("device") ? (
          <select aria-label="Toestel" className={sel} value={zoek.device} onChange={(e) => zet({ device: e.target.value })}>
            <option value="">Alle toestellen</option>
            {["Telefoon", "Tablet", "Computer"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : null}

        {velden.includes("resultaat") ? (
          <select aria-label="Resultaat" className={sel} value={zoek.resultaat} onChange={(e) => zet({ resultaat: e.target.value as any })}>
            <option value="alles">Alle resultaten</option>
            <option value="gelukt">Gelukt</option>
            <option value="mislukt">Mislukt</option>
          </select>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setBewaarOpen((v) => !v)}>
            <Save className="size-4" /> Bewaar weergave
          </Button>
          {exportSoort ? (
            <Button size="sm" variant="secondary" onClick={() => exporteren.mutate()} disabled={exporteren.isPending}>
              <Download className="size-4" /> Export
            </Button>
          ) : null}
        </div>
      </div>

      {bewaarOpen ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam van de weergave"
            className="h-9 w-64 border-white/10 bg-slate-900 text-slate-100"
          />
          <Button size="sm" disabled={!naam || bewaren.isPending} onClick={() => bewaren.mutate()}>
            Bewaren
          </Button>
        </div>
      ) : null}

      {(chips.length > 0 || (weergaven.data ?? []).length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {chips.map((c, n) => (
            <button
              key={n}
              onClick={() => zet(c.wis)}
              className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/25"
            >
              {c.label} <X className="size-3" />
            </button>
          ))}
          {chips.length ? (
            <button
              onClick={() =>
                navigate({
                  to: ".",
                  search: { bereik: zoek.bereik, pagina: 1 } as any,
                } as any)
              }
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
            >
              Alles wissen
            </button>
          ) : null}
          {((weergaven.data ?? []) as any[])
            .filter((w) => w.scherm === scherm)
            .map((w) => (
              <span key={w.id} className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs">
                <button
                  className="text-slate-200 hover:text-emerald-300"
                  onClick={() => navigate({ to: ".", search: w.filters } as any)}
                >
                  {w.naam}
                </button>
                <button
                  aria-label="Weergave verwijderen"
                  onClick={async () => {
                    await wisFn({ data: { id: w.id } });
                    void qc.invalidateQueries({ queryKey: ["ui-weergaven"] });
                  }}
                  className="text-slate-500 hover:text-red-300"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------- tabel ----------------

export function Tabel({
  kolommen,
  children,
  sorteerbaar,
  zoek,
}: {
  kolommen: { sleutel?: string; label: string }[];
  children: ReactNode;
  sorteerbaar?: boolean;
  zoek?: Zoek;
}) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {kolommen.map((k) => (
              <th key={k.label} className="whitespace-nowrap px-3 py-2 font-medium">
                {sorteerbaar && k.sleutel ? (
                  <button
                    className="min-w-11 text-left hover:text-emerald-300"
                    onClick={() =>
                      navigate({
                        to: ".",
                        search: (o: any) => ({
                          ...o,
                          sorteer: k.sleutel,
                          richting: zoek?.sorteer === k.sleutel && zoek?.richting === "af" ? "op" : "af",
                        }),
                      } as any)
                    }
                  >
                    {k.label}
                    {zoek?.sorteer === k.sleutel ? (zoek.richting === "af" ? " ↓" : " ↑") : ""}
                  </button>
                ) : (
                  k.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function Rij({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? "cursor-pointer hover:bg-white/5" : ""} align-middle`}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </tr>
  );
}

export function Cel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2 text-slate-200 ${className}`}>{children}</td>;
}

export function Paginering({ totaal, pagina, perPagina }: { totaal: number; pagina: number; perPagina: number }) {
  const navigate = useNavigate();
  const laatste = Math.max(1, Math.ceil(totaal / perPagina));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
      <span>
        {totaal === 0 ? "Geen resultaten" : `${(pagina - 1) * perPagina + 1}–${Math.min(pagina * perPagina, totaal)} van ${totaal}`}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={pagina <= 1}
          onClick={() => navigate({ to: ".", search: (o: any) => ({ ...o, pagina: pagina - 1 }) } as any)}
        >
          Vorige
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pagina >= laatste}
          onClick={() => navigate({ to: ".", search: (o: any) => ({ ...o, pagina: pagina + 1 }) } as any)}
        >
          Volgende
        </Button>
      </div>
    </div>
  );
}

// ---------------- kleine bouwstenen ----------------

export function KlikKpi({
  label,
  waarde,
  extra,
  to,
  search,
}: {
  label: string;
  waarde: ReactNode;
  extra?: string | null;
  to: string;
  search?: any;
}) {
  return (
    <Link to={to} search={search} className="block transition hover:brightness-125">
      <Kaart className="h-full">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{waarde}</p>
        {extra ? <p className="text-xs text-slate-500">{extra}</p> : null}
      </Kaart>
    </Link>
  );
}

export function LeegOfNiet({ waarde }: { waarde: unknown }) {
  if (waarde === null || waarde === undefined || waarde === "") {
    return <span className="text-slate-500">niet beschikbaar</span>;
  }
  return <>{String(waarde)}</>;
}

export const stip = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("nl-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const klok = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export const geleden = (iso?: string | null) => {
  if (!iso) return "nooit";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "net nu";
  if (m < 60) return `${m} min geleden`;
  const u = Math.floor(m / 60);
  if (u < 24) return `${u} u geleden`;
  return `${Math.floor(u / 24)} d geleden`;
};

export const duurTekst = (sec?: number | null) =>
  sec === null || sec === undefined ? "niet beschikbaar" : sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`;

export const euro = (n: number | null | undefined) => `€ ${Number(n ?? 0).toFixed(4)}`;

export function labelVan(event: string) {
  return GEBEURTENIS_LABEL[event] ?? event;
}
