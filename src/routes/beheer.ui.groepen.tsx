import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { Cel, Kruimels, Rij, SubNav, Tabel, euro, geleden } from "@/components/UserIntelligence";
import { uiGroepen } from "@/lib/user-intelligence.functions";

export const Route = createFileRoute("/beheer/ui/groepen")({ component: Groepen });

function Groepen() {
  const navigate = useNavigate();
  const fn = useServerFn(uiGroepen);
  const q = useQuery({ queryKey: ["ui-groepen"], queryFn: () => fn({}) });

  return (
    <AdminShell titel="Gezinnen" omschrijving="Hoe gezinnen samen koken, plannen en AI gebruiken.">
      <SubNav />
      <Kruimels
        items={[
          { label: "Control Center", to: "/beheer" },
          { label: "User Intelligence", to: "/beheer/ui" },
          { label: "Gezinnen" },
        ]}
      />
      {q.isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : (
        <Tabel
          kolommen={[
            { label: "Gezin" },
            { label: "Leden" },
            { label: "Actieve leden" },
            { label: "Acties" },
            { label: "Laatst actief" },
            { label: "AI" },
            { label: "Credits" },
            { label: "Kost (schatting)" },
          ]}
        >
          {((q.data ?? []) as any[]).map((g) => (
            <Rij key={g.id} onClick={() => navigate({ to: "/beheer/ui/groep/$id", params: { id: g.id } } as any)}>
              <Cel>{g.naam}</Cel>
              <Cel>{g.leden}</Cel>
              <Cel>{g.actieveLeden}</Cel>
              <Cel>{g.events}</Cel>
              <Cel>{geleden(g.laatsteActiviteit)}</Cel>
              <Cel>{g.ai}</Cel>
              <Cel>{g.credits}</Cel>
              <Cel>{euro(g.kost)}</Cel>
            </Rij>
          ))}
        </Tabel>
      )}
    </AdminShell>
  );
}
