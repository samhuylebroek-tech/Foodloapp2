import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/aanmelden")({
  head: () => ({
    meta: [
      { title: "Aanmelden – MaJeBa" },
      {
        name: "description",
        content:
          "Meld je aan bij MaJeBa en verzamel samen recepten, plan je week en maak je boodschappenlijst.",
      },
      { property: "og:title", content: "Aanmelden – MaJeBa" },
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
            emailRedirectTo: window.location.origin,
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

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Aanmelden met Google lukte niet");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src={logo}
            alt="MaJeBa logo"
            width={112}
            height={112}
            className="mx-auto size-28 rounded-3xl"
          />
          <h1 className="mt-4 font-display text-3xl">MaJeBa</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Al jullie recepten op één plek, makkelijk terug te vinden.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-border bg-card p-6"
        >
          {mode === "signup" && (
            <div>
              <Label htmlFor="name" className="text-base">
                Jouw naam
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-14 text-base"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-base">
              E-mailadres
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-14 text-base"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-base">
              Wachtwoord
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-14 text-base"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <Button type="submit" disabled={busy} className="h-16 w-full text-lg">
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            {mode === "login" ? "Aanmelden" : "Account maken"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogle}
            className="h-16 w-full text-lg"
          >
            Doorgaan met Google
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full py-2 text-base font-semibold text-primary underline underline-offset-4"
          >
            {mode === "login" ? "Nog geen account? Account maken" : "Ik heb al een account"}
          </button>
        </form>
      </div>
    </div>
  );
}
