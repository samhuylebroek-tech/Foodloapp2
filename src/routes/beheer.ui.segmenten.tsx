import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { Kruimels, SubNav, geleden } from "@/components/UserIntelligence";
import { uiAandacht } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/segmenten")({ component: Segmenten });

const UITLEG: { sleutel: string; label: string; regel: string }[] = [
  { sleutel: "nieuw", label: "Nieuw", regel: "aangemeld in de laatste 7 dagen" },
  { sleutel: "actief", label: "Actief", regel: "activiteit in de laatste 7 dagen" },
  { sleutel: "terugkerend", label: "Terugkerend", regel: "meer dan één sessie" },
  { sleutel: "weinig", label: "Weinig actief", regel: "laatste activiteit 8 tot 30 dagen geleden" },
  { sleutel: "inactief", label: "Inactief", regel: "meer dan 30 dagen geen activiteit" },
  { sleutel: "nooit", label: "Nooit actief", regel: "nog geen enkele actie na aanmelden" },
];

function Segmenten() {
  const fn = useServerFn(uiAandacht);
  const q = useQuery({ queryKey: ["ui-aandacht"], queryFn: () => fn({}) });

  return (
    <AdminShell titel="Segmenten" omschrijving="Transparante drempels en gebruikers die opvolging kunnen gebruiken.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Segmenten" },
        ]}
      />

      <Kaart className="mb-4">
        <h2 className="mb-2 text-sm font-semibold">Statussen en drempels</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {UITLEG.map((u) => (
            <li key={u.sleutel}>
              <Link
                to="/beheer/ui/gebruikers"
                search={{ bereik: "dertig", status: u.sleutel, pagina: 1 } as any}
                className="block rounded-lg border border-white/10 p-3 hover:bg-white/5"
              >
                <span className="font-medium text-slate-100">{u.label}</span>
                <span className="block text-xs text-slate-400">{u.regel}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Kaart>

      <Kaart>
        <h2 className="mb-2 text-sm font-semibold">Gebruikers die aandacht kunnen gebruiken</h2>
        {q.isLoading ? (
          <p className="text-slate-400">Laden…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Niemand voldoet aan een signaal.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {((q.data ?? []) as any[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link to="/beheer/ui/gebruiker/$id" params={{ id: r.id }} className="font-medium text-emerald-300 hover:underline">
                  {r.naam}
                </Link>
                <span className="text-xs text-slate-500">laatst actief {geleden(r.laatste)}</span>
                <span className="flex flex-wrap gap-1">
                  {r.signalen.map((s: string) => (
                    <span key={s} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                      {s}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kaart>
    </AdminShell>
  );
}
