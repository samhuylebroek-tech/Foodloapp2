import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFoutTekst } from "@/lib/auth-fouten";
import { controleerNieuwWachtwoord } from "@/lib/wachtwoord";

export const Route = createFileRoute("/wachtwoord-herstellen")({
  head: () => ({
    meta: [{ title: "Nieuw wachtwoord – Foodlo" }, { name: "robots", content: "noindex" }],
  }),
  component: WachtwoordHerstellenPage,
});

type Stap = "laden" | "kiezen" | "verlopen";

/** Hoe lang we wachten tot de link uit de mail een sessie oplevert. */
const WACHTTIJD_MS = 4000;

function WachtwoordHerstellenPage() {
  const navigate = useNavigate();
  const [stap, setStap] = useState<Stap>("laden");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [toon, setToon] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let klaar = false;
    const zet = (s: Stap) => {
      if (!klaar) setStap(s);
    };
    // De link uit de mail meldt de gebruiker tijdelijk aan (PASSWORD_RECOVERY).
    const { data: sub } = supabase.auth.onAuthStateChange((event, sessie) => {
      if (event === "PASSWORD_RECOVERY" || (sessie && event === "SIGNED_IN")) zet("kiezen");
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) zet("kiezen");
    });
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => zet(data.session ? "kiezen" : "verlopen"));
    }, WACHTTIJD_MS);
    return () => {
      klaar = true;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function bewaar(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    const probleem = controleerNieuwWachtwoord(wachtwoord, herhaal);
    if (probleem) {
      setFout(probleem);
      return;
    }
    setBezig(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: wachtwoord });
      if (error) throw error;
      toast.success("Je nieuwe wachtwoord is bewaard.");
      navigate({ to: "/" });
    } catch (err) {
      setFout(authFoutTekst(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-muted/50 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nieuw wachtwoord</h1>

        {stap === "laden" ? (
          <p role="status" className="mt-6 flex items-center gap-3 text-lg text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            Even je link controleren…
          </p>
        ) : null}

        {stap === "verlopen" ? (
          <div className="mt-6 space-y-5">
            <p role="alert" className="text-lg text-foreground">
              Deze link werkt niet meer. Hij is verlopen of al gebruikt. Vraag gerust een nieuwe
              aan.
            </p>
            <Link
              to="/aanmelden"
              className="flex h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground"
            >
              Naar aanmelden
            </Link>
          </div>
        ) : null}

        {stap === "kiezen" ? (
          <form onSubmit={bewaar} className="mt-6 space-y-5">
            <p className="text-lg text-muted-foreground">
              Kies een wachtwoord dat je makkelijk onthoudt. Een korte zin werkt goed.
            </p>
            <div>
              <Label htmlFor="nieuw" className="text-base font-semibold text-foreground">
                Nieuw wachtwoord
              </Label>
              <div className="relative mt-2">
                <Input
                  id="nieuw"
                  type={toon ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={wachtwoord}
                  onChange={(e) => setWachtwoord(e.target.value)}
                  aria-invalid={fout ? true : undefined}
                  aria-describedby={fout ? "herstel-fout" : undefined}
                  className="h-14 rounded-2xl bg-muted py-0 pl-5 pr-16 text-base"
                />
                <button
                  type="button"
                  onClick={() => setToon((v) => !v)}
                  aria-pressed={toon}
                  aria-label={toon ? "Verberg wachtwoord" : "Toon wachtwoord"}
                  className="absolute inset-y-0 right-1 my-auto flex size-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {toon ? (
                    <EyeOff className="size-6" aria-hidden />
                  ) : (
                    <Eye className="size-6" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="herhaal" className="text-base font-semibold text-foreground">
                Nog eens hetzelfde wachtwoord
              </Label>
              <Input
                id="herhaal"
                type={toon ? "text" : "password"}
                autoComplete="new-password"
                required
                value={herhaal}
                onChange={(e) => setHerhaal(e.target.value)}
                aria-invalid={fout ? true : undefined}
                aria-describedby={fout ? "herstel-fout" : undefined}
                className="mt-2 h-14 rounded-2xl bg-muted px-5 text-base"
              />
            </div>
            {fout ? (
              <p
                id="herstel-fout"
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-base font-medium text-foreground"
              >
                {fout}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={bezig}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
            >
              {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              Bewaar nieuw wachtwoord
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
