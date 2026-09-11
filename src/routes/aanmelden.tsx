import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { appOrigin } from "@/lib/app-url";

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
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    const code = sessionStorage.getItem("uitnodiging");
    if (code) {
      navigate({ to: "/uitnodiging", search: { code } });
      return;
    }
    navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: appOrigin(),
            data: { display_name: name },
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
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBusy(false);
    }
  }

  async function handleSso(provider: "google" | "apple" | "microsoft", naam: string) {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: appOrigin(),
    });
    if (result.error) {
      toast.error(`Aanmelden met ${naam} lukte niet`);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-[2.5rem] border border-border bg-card p-8 shadow-2xl shadow-muted/50 sm:p-10">
          {/* Logo & Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <img src={logo} alt="Foodlo logo" width={40} height={40} className="size-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Foodlo</h1>
            <p className="mt-2 text-base font-medium text-muted-foreground">
              Ontdek je volgende favoriete recept
            </p>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSso("google", "Google")}
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <svg className="size-5" viewBox="0 0 24 24">
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
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.36 12.79c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.045 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.55zM14.2 5.87c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z" />
              </svg>
              Doorgaan met Apple
            </button>

            <button
              type="button"
              onClick={() => handleSso("microsoft", "Microsoft")}
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
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
            <span className="relative bg-card px-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Of met e-mail
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="text-base font-semibold text-foreground">
                  Jouw naam
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base placeholder:text-muted-foreground focus-visible:ring-primary/20"
                  autoComplete="name"
                />
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
                placeholder="naam@voorbeeld.nl"
                className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base placeholder:text-muted-foreground focus-visible:ring-primary/20"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-base font-semibold text-foreground">
                Wachtwoord
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 h-14 rounded-2xl border-input bg-muted px-5 text-base placeholder:text-muted-foreground focus-visible:ring-primary/20"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : null}
              {mode === "login" ? "Aanmelden" : "Account maken"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-6 w-full text-base font-semibold text-muted-foreground transition-colors hover:text-primary"
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
