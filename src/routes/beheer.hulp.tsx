import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { adminTickets } from "@/lib/admin.functions";
import { FUNCTIES, MODULES } from "@/lib/functies";
import { ARTIKELS } from "@/lib/hulp/artikels";
import { controleerInhoud, groepeerVragen } from "@/lib/hulp/controle";
import { maakTutorial } from "@/lib/hulp/tutorials";
import { zoekHulp } from "@/lib/hulp/zoeken";

export const Route = createFileRoute("/beheer/hulp")({ component: HulpInhoud });

/**
 * AI Content Manager (Control Center): stand van de hulpinhoud. Publiceren gebeurt alleen door
 * een mens; AI-inhoud blijft concept. De controle op knopteksten tegen de broncode draait in
 * elke testrun (src/lib/hulp/controle.test.ts), niet in de browser.
 */
function HulpInhoud() {
  const { mag } = useAdmin();
  const ticketsFn = useServerFn(adminTickets);
  const tickets = useQuery({
    queryKey: ["admin-tickets", "alles"],
    enabled: mag("support.view"),
    queryFn: () => ticketsFn({ data: { status: "alles" } }),
  });

  // In de browser kennen we de broncode niet: alleen register en verwijzingen controleren.
  const rapport = controleerInhoud({
    artikels: ARTIKELS,
    functies: FUNCTIES,
    inCode: () => true,
    bestandBestaat: () => true,
  });
  const concepten = ARTIKELS.filter((a) => a.status === "concept").length;
  const tutorials = ARTIKELS.map(maakTutorial).filter(Boolean).length;
  const groepen = groepeerVragen(
    (tickets.data ?? []).map((t: { message?: string | null }) => t.message ?? "").filter(Boolean),
    ARTIKELS,
    zoekHulp,
  );

  return (
    <AdminShell titel="Hulpinhoud" omschrijving="Help Center, tutorials en AI-concepten">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kaart>
            <p className="text-sm text-slate-400">Artikels</p>
            <p className="text-2xl font-semibold">{ARTIKELS.length}</p>
          </Kaart>
          <Kaart>
            <p className="text-sm text-slate-400">Concept (niet nagelezen)</p>
            <p className="text-2xl font-semibold">{concepten}</p>
          </Kaart>
          <Kaart>
            <p className="text-sm text-slate-400">Functies zonder uitleg</p>
            <p className="text-2xl font-semibold">{rapport.functiesZonderUitleg.length}</p>
          </Kaart>
          <Kaart>
            <p className="text-sm text-slate-400">Tutorials (script + ondertitels)</p>
            <p className="text-2xl font-semibold">{tutorials}</p>
          </Kaart>
        </div>

        <Kaart>
          <h2 className="text-lg font-semibold">Publiceren</h2>
          <p className="mt-1 text-sm text-slate-300">
            AI-concepten zijn in de echte app <strong>verborgen</strong> tot een bevoegd persoon ze
            naleest en goedkeurt. Goedkeuren gebeurt nu in de code (status en nalezer per artikel);
            een knop hier volgt met de tabel uit voorstel 0005. Elke testrun controleert dat elke
            knop die een artikel noemt echt in de app bestaat.
          </p>
        </Kaart>

        <Kaart>
          <h2 className="text-lg font-semibold">Artikels</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2">Titel</th>
                  <th>Module</th>
                  <th>Soort</th>
                  <th>Bron</th>
                  <th>Status</th>
                  <th>Signalen</th>
                </tr>
              </thead>
              <tbody>
                {rapport.artikels.map((a) => {
                  const art = ARTIKELS.find((x) => x.slug === a.slug)!;
                  return (
                    <tr key={a.slug} className="border-t border-white/5">
                      <td className="py-2">
                        <Link
                          to="/hulp/$slug"
                          params={{ slug: a.slug }}
                          className="underline-offset-2 hover:underline"
                        >
                          {a.titel}
                        </Link>
                      </td>
                      <td>{MODULES.find((m) => m.id === art.module)?.titel}</td>
                      <td>{art.soort}</td>
                      <td>{a.bron === "ai" ? "AI" : "mens"}</td>
                      <td>{a.status === "concept" ? "Concept" : "Goedgekeurd"}</td>
                      <td>{a.verouderd.length ? a.verouderd.join("; ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Kaart>

        <Kaart>
          <h2 className="text-lg font-semibold">Vragen van gebruikers, gegroepeerd</h2>
          {!mag("support.view") ? (
            <p className="mt-1 text-sm text-slate-300">
              Je rol heeft geen toegang tot supportvragen.
            </p>
          ) : tickets.isLoading ? (
            <p className="mt-1 text-sm text-slate-300">Laden…</p>
          ) : groepen.length === 0 ? (
            <p className="mt-1 text-sm text-slate-300">Nog geen vragen of meldingen.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {groepen.map((g) => (
                <li key={g.slug ?? "geen"} data-groep={g.slug ?? "zonder-artikel"}>
                  <p className="font-semibold">
                    {g.slug ? g.titel : "Zonder artikel (signaal: nieuwe uitleg nodig?)"} ·{" "}
                    {g.vragen.length}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-300">
                    {g.vragen.slice(0, 5).map((v, i) => (
                      <li key={i}>{v.slice(0, 160)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Kaart>
      </div>
    </AdminShell>
  );
}
