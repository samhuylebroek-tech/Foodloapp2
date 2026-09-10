import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/beheer")({
  head: () => ({
    meta: [
      { title: "Control Center – MaJeBa" },
      { name: "description", content: "Beveiligde beheeromgeving van MaJeBa: gebruikers, recepten, AI, support en systeem." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Control Center – MaJeBa" },
      { property: "og:description", content: "Beveiligde beheeromgeving van MaJeBa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeheerLayout,
});

function BeheerLayout() {
  const { profiel, laden, ingelogd } = useAdmin();
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);

  if (laden) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Laden…</div>;
  }

  if (!ingelogd) {
    return (
      <Scherm titel="Aanmelden vereist" tekst="Meld je eerst aan met je account.">
        <Link to="/aanmelden">
          <Button>Naar aanmelden</Button>
        </Link>
      </Scherm>
    );
  }

  if (!profiel) {
    return (
      <Scherm
        titel="Geen toegang"
        tekst="Dit account heeft geen beheerdersrol. Als jij de eigenaar bent en er bestaat nog geen beheerder, kun je jezelf eenmalig als hoofdbeheerder instellen."
      >
        <Button
          disabled={bezig}
          onClick={async () => {
            setBezig(true);
            const { data, error } = await supabase.rpc("claim_first_admin");
            setBezig(false);
            if (error) {
              toast.error(error.message);
              return;
            }
            if (!data) {
              toast.error("Er bestaat al een beheerder. Vraag die om je toe te voegen.");
              return;
            }
            await qc.invalidateQueries({ queryKey: ["admin-profiel"] });
            toast.success("Je bent nu hoofdbeheerder.");
          }}
        >
          Mij hoofdbeheerder maken
        </Button>
        <Link to="/" className="text-sm text-emerald-400 hover:underline">
          Terug naar de app
        </Link>
      </Scherm>
    );
  }

  return <Outlet />;
}

function Scherm({ titel, tekst, children }: { titel: string; tekst: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">{titel}</h1>
        <p className="mt-2 text-sm text-slate-400">{tekst}</p>
        <div className="mt-5 flex flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
