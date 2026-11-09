import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { appOrigin } from "@/lib/app-url";
import { authFoutTekst } from "@/lib/auth-fouten";

export const Route = createFileRoute("/aanmelden")({
  head: () => ({
    meta: [
      { title: "Aanmelden – Foodlo" },
      {
        name: "description",
        content:
          "Meld je aan bij Foodlo en verzamel samen recepten, plan je week en maak je boodschappenlijst.",
      },
      { property: "og:title", content: "Aanmelden – Foodlo" },
      {
        property: "og:description",
        content: "Meld je aan en verzamel samen recepten in één duidelijke app.",
      },
    ],
  }),
  component: AanmeldenPage,
});

function AanmeldenPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [busy, setBusy] = useState(false);
  // Fout blijft zichtbaar in het formulier (een melding bovenaan verdwijnt te snel).
  const [fout, setFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  // Tot de pagina interactief is, zou een tik het formulier herladen en de
  // getypte tekst wissen (trage telefoons). Daarom pas daarna inschakelen.
  const [klaar, setKlaar] = useState(false);
  useEffect(() => setKlaar(true), []);

  useEffect(() => {
    if (loading || !session) return;
    const code = sessionStorage.getItem("uitnodiging");
    const groep = sessionStorage.getItem("gezinsuitnodiging");
    if (code || groep) {
      navigate({ to: "/uitnodiging", search: { code: code ?? "", groep: groep ?? "" } });
      return;
    }
    navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setMelding(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const volledigeNaam = `${voornaam.trim()} ${achternaam.trim()}`.trim();
        if (!voornaam.trim() || !achternaam.trim()) {
          setFout("Vul je voornaam en achternaam in.");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: appOrigin(),
            data: {
              display_name: volledigeNaam,
              full_name: volledigeNaam,
              voornaam: voornaam.trim(),
              achternaam: achternaam.trim(),
            },
          },
        });
        if (error) throw error;
        toast.success("Account aangemaakt. Je kunt meteen beginnen.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      const tekst = authFoutTekst(err);
      setFout(tekst);
      toast.error(tekst);
    } finally {
      setBusy(false);
    }
  }

  async function stuurHerstelLink() {
    setFout(null);
    setMelding(null);
    const adres = email.trim();
    if (!adres) {
      setFout(
        "Vul eerst je e-mailadres in. Dan sturen we je een link om een nieuw wachtwoord te kiezen.",
      );
      document.getElementById("email")?.focus();
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(adres, {
        redirectTo: `${appOrigin()}/wachtwoord-herstellen`,
      });
      // Alleen verbindings- of limietfouten tonen; nooit verraden of een adres bestaat.
      if (error && (error.status === 429 || /rate|fetch|network/i.test(error.message))) throw error;
      setMelding(
        `Als er een account bestaat voor ${adres}, krijg je binnen enkele minuten een mail met een link. Kijk ook in je spam.`,
      );
    } catch (err) {
      setFout(authFoutTekst(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSso(provider: "google" | "apple" | "microsoft", naam: string) {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(`Aanmelden met ${naam} lukte niet`);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full sm:max-w-md">
        {/* Telefoon: volledig scherm met merkband; groter scherm: rustige kaart. */}
        <div className="px-5 pb-10 sm:paneel sm:p-10">
          <div className="-mx-5 mb-8 rounded-b-[2rem] bg-inkt px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-inkt-foreground sm:mx-0 sm:rounded-none sm:bg-transparent sm:p-0 sm:text-center sm:text-foreground">
            <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-white/90 sm:mx-auto sm:bg-secondary">
              <img src={logo} alt="Foodlo logo" width={40} height={40} className="size-10" />
            </div>
            <h1 className="text-heldentitel">Foodlo</h1>
            <p className="mt-2 text-lg text-inkt-zacht sm:text-base sm:text-muted-foreground">
              Ontdek je volgende favoriete recept
            </p>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSso("google", "Google")}
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Doorgaan met Google
            </button>

            <button
              type="button"
              onClick={() => handleSso("apple", "Apple")}
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.36 12.79c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.045 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.55zM14.2 5.87c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z" />
              </svg>
              Doorgaan met Apple
            </button>

            <button
              type="button"
              onClick={() => handleSso("microsoft", "Microsoft")}
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 2h9.5v9.5H2z" fill="#F25022" />
                <path d="M12.5 2H22v9.5h-9.5z" fill="#7FBA00" />
                <path d="M2 12.5h9.5V22H2z" fill="#00A4EF" />
                <path d="M12.5 12.5H22V22h-9.5z" fill="#FFB900" />
              </svg>
              Doorgaan met Microsoft
            </button>
          </div>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-4 text-base sm:bg-card font-semibold uppercase tracking-wider text-muted-foreground">
              Of met e-mail
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="voornaam" className="text-base font-semibold text-foreground">
                    Voornaam
                  </Label>
                  <Input
                    id="voornaam"
                    required
                    value={voornaam}
                    onChange={(e) => setVoornaam(e.target.value)}
                    placeholder="Marie"
                    className="mt-2 h-14 rounded-2xl bg-card px-5 text-base placeholder:text-muted-foreground"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label htmlFor="achternaam" className="text-base font-semibold text-foreground">
                    Achternaam
                  </Label>
                  <Input
                    id="achternaam"
                    required
                    value={achternaam}
                    onChange={(e) => setAchternaam(e.target.value)}
                    placeholder="Janssens"
                    className="mt-2 h-14 rounded-2xl bg-card px-5 text-base placeholder:text-muted-foreground"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-base font-semibold text-foreground">
                E-mailadres
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.be"
                aria-invalid={fout ? true : undefined}
                aria-describedby={fout ? "aanmeld-fout" : undefined}
                className="mt-2 h-14 rounded-2xl bg-card px-5 text-base placeholder:text-muted-foreground"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-base font-semibold text-foreground">
                Wachtwoord
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={toonWachtwoord ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 rounded-2xl bg-card py-0 pl-5 pr-16 text-base placeholder:text-muted-foreground"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  aria-invalid={fout ? true : undefined}
                  aria-describedby={fout ? "aanmeld-fout" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setToonWachtwoord((v) => !v)}
                  aria-pressed={toonWachtwoord}
                  aria-label={toonWachtwoord ? "Verberg wachtwoord" : "Toon wachtwoord"}
                  className="absolute inset-y-0 right-1 my-auto flex size-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {toonWachtwoord ? (
                    <EyeOff className="size-6" aria-hidden />
                  ) : (
                    <Eye className="size-6" aria-hidden />
                  )}
                </button>
              </div>
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => void stuurHerstelLink()}
                  disabled={busy}
                  className="mt-2 min-h-11 text-base font-semibold text-primary underline underline-offset-4 disabled:opacity-60"
                >
                  Wachtwoord vergeten?
                </button>
              ) : null}
            </div>

            {fout ? (
              <p
                id="aanmeld-fout"
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-base font-medium text-foreground"
              >
                {fout}
              </p>
            ) : null}
            {melding ? (
              <p
                role="status"
                className="rounded-2xl bg-secondary px-4 py-3 text-base font-medium text-secondary-foreground"
              >
                {melding}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !klaar}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : null}
              {mode === "login" ? "Aanmelden" : "Account maken"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setFout(null);
              setMelding(null);
            }}
            className="mt-6 min-h-12 w-full text-base font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            {mode === "login" ? (
              <>
                Nog geen account?{" "}
                <span className="font-bold text-primary underline underline-offset-4">
                  Account maken
                </span>
              </>
            ) : (
              <>
                Ik heb al een account?{" "}
                <span className="font-bold text-primary underline underline-offset-4">
                  Inloggen
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
