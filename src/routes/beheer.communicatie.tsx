import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminBerichtVersturen,
  adminBerichten,
  adminOntvangersTellen,
} from "@/lib/monitoring.functions";
import { adminPersonenLijst } from "@/lib/admin.functions";
import { SEGMENT_LABEL, SEGMENTEN } from "@/lib/segmenten";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/beheer/communicatie")({
  validateSearch: (s: Record<string, unknown>) => ({ gebruiker: typeof s["gebruiker"] === "string" ? s["gebruiker"] : "" }),
  component: Communicatie,
});

type Doelgroep = "gebruiker" | "groep" | "segment" | "iedereen";

function Communicatie() {
  const zoekParam = useSearch({ from: "/beheer/communicatie" });
  const qc = useQueryClient();
  const [doelgroep, setDoelgroep] = useState<Doelgroep>(zoekParam.gebruiker ? "gebruiker" : "iedereen");
  const [doelId, setDoelId] = useState(zoekParam.gebruiker);
  const [segment, setSegment] = useState("inactief");
  const [onderwerp, setOnderwerp] = useState("");
  const [bericht, setBericht] = useState("");
  const [kanaal, setKanaal] = useState<"in_app" | "email">("in_app");

  const [persoonZoek, setPersoonZoek] = useState("");

  const telFn = useServerFn(adminOntvangersTellen);
  const stuurFn = useServerFn(adminBerichtVersturen);
  const lijstFn = useServerFn(adminBerichten);
  const personenFn = useServerFn(adminPersonenLijst);

  const ontvangers = useQuery({
    queryKey: ["admin-ontvangers", doelgroep, doelId, segment],
    queryFn: () => telFn({ data: { doelgroep, doelId, segment } }),
  });
  const geschiedenis = useQuery({ queryKey: ["admin-berichten"], queryFn: () => lijstFn() });
  const personen = useQuery({ queryKey: ["admin-personen-lijst"], queryFn: () => personenFn() });

  const gekozenPersoon = (personen.data ?? []).find((p) => p.id === doelId);
  const gefilterdePersonen = (personen.data ?? []).filter((p) =>
    p.naam.toLowerCase().includes(persoonZoek.trim().toLowerCase()),
  );
  const voorbeeldNaam = gekozenPersoon?.naam ?? "Sam Voorbeeld";
  const persoonlijk = (tekst: string) =>
    tekst
      .replace(/\{voornaam\}/gi, voorbeeldNaam.trim().split(/\s+/)[0] ?? "")
      .replace(/\{naam\}/gi, voorbeeldNaam);

  const versturen = useMutation({
    mutationFn: () => stuurFn({ data: { doelgroep, doelId, segment, onderwerp, bericht, kanaal, test: false } }),
    onSuccess: (r) => {
      toast.success(`Verstuurd naar ${r.verzonden} van ${r.ontvangers} mensen`);
      setOnderwerp("");
      setBericht("");
      qc.invalidateQueries({ queryKey: ["admin-berichten"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mailKlaar = geschiedenis.data?.mailAanbieder && geschiedenis.data.mailAanbieder !== "geen";

  return (
    <AdminShell titel="Communicatie" omschrijving="Bericht één persoon, een gezin of een hele groep gebruikers">
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Kaart>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Naar wie?</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["gebruiker", "Eén gebruiker"],
                    ["groep", "Een gezin"],
                    ["segment", "Een groep gebruikers"],
                    ["iedereen", "Iedereen"],
                  ] as [Doelgroep, string][]
                ).map(([w, l]) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setDoelgroep(w)}
                    aria-pressed={doelgroep === w}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      doelgroep === w ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {doelgroep === "gebruiker" ? (
              <div className="space-y-2">
                <Input
                  value={persoonZoek}
                  onChange={(e) => setPersoonZoek(e.target.value)}
                  placeholder="Zoek een persoon…"
                />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
                  {gefilterdePersonen.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDoelId(p.id)}
                      aria-pressed={doelId === p.id}
                      className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                        doelId === p.id ? "bg-emerald-500/20 text-emerald-300" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {p.naam}
                    </button>
                  ))}
                  {!gefilterdePersonen.length ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Niemand gevonden.</p>
                  ) : null}
                </div>
                {gekozenPersoon ? (
                  <p className="text-sm text-emerald-300">Gekozen: {gekozenPersoon.naam}</p>
                ) : null}
              </div>
            ) : null}
            {doelgroep === "groep" ? (
              <Input
                value={doelId}
                onChange={(e) => setDoelId(e.target.value)}
                placeholder="Gezins-id"
              />
            ) : null}
            {doelgroep === "segment" ? (
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              >
                {SEGMENTEN.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-medium">Hoe bezorgen?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setKanaal("in_app")}
                  aria-pressed={kanaal === "in_app"}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    kanaal === "in_app" ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-300"
                  }`}
                >
                  In de app (+ pushmelding)
                </button>
                <button
                  type="button"
                  onClick={() => setKanaal("email")}
                  aria-pressed={kanaal === "email"}
                  disabled={!mailKlaar}
                  className={`rounded-full px-3 py-1.5 text-sm disabled:opacity-40 ${
                    kanaal === "email" ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-300"
                  }`}
                >
                  E-mail
                </button>
              </div>
              {!mailKlaar ? (
                <p className="mt-1 text-xs text-slate-400">
                  Er is nog geen e-maildienst gekoppeld; berichten komen in de app terecht.
                </p>
              ) : null}
            </div>

            <Input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="Onderwerp" />
            <Textarea
              value={bericht}
              onChange={(e) => setBericht(e.target.value)}
              placeholder="Je bericht…"
              rows={7}
            />
            <p className="text-xs text-slate-400">
              Slimme tekens: <code>{"{voornaam}"}</code> en <code>{"{naam}"}</code> worden per persoon automatisch
              ingevuld, bv. "Dag {"{voornaam}"}, …"
            </p>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium">Voorbeeld{voorbeeldNaam ? ` voor ${voorbeeldNaam}` : ""}</p>
              <p className="mt-1 text-slate-300">{persoonlijk(onderwerp) || "(onderwerp)"}</p>
              <p className="whitespace-pre-wrap text-slate-400">{persoonlijk(bericht) || "(bericht)"}</p>
              <p className="mt-2 text-xs text-slate-400">
                Ontvangers: {ontvangers.data?.aantal ?? "…"}
                {ontvangers.data?.voorbeeld?.length ? ` · ${ontvangers.data.voorbeeld.join(", ")}…` : ""}
              </p>
            </div>

            <Button
              onClick={() => versturen.mutate()}
              disabled={versturen.isPending || onderwerp.length < 2 || bericht.length < 2}
            >
              {versturen.isPending ? "Versturen…" : "Versturen"}
            </Button>
          </div>
        </Kaart>

        <Kaart>
          <p className="mb-3 text-sm font-medium">Verzonden</p>
          <div className="space-y-2 text-sm">
            {(geschiedenis.data?.rijen ?? []).map((r: any) => (
              <div key={r.id} className="rounded-lg border border-white/10 p-3">
                <p className="font-medium">{r.onderwerp}</p>
                <p className="text-xs text-slate-400">
                  {new Date(r.created_at).toLocaleString("nl-BE")} · {r.doelgroep} · {r.kanaal}
                </p>
                <p className="text-xs text-slate-400">
                  {r.verzonden} verzonden · {r.mislukt} mislukt van {r.ontvangers}
                </p>
              </div>
            ))}
            {!(geschiedenis.data?.rijen ?? []).length ? (
              <p className="text-slate-400">Nog niets verstuurd.</p>
            ) : null}
          </div>
        </Kaart>
      </div>
    </AdminShell>
  );
}
