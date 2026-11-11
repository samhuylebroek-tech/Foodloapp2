import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { codeGeldig, mfaFoutTekst, schoonCode, type Factor } from "@/lib/tweede-stap";

/**
 * De tweede stap bij aanmelden (BUG-095): wie al een authenticator heeft, bevestigt hier met de
 * 6-cijferige code en krijgt een `aal2`-sessie. Zonder dit scherm zou de eigenaar na het
 * afdwingen van 2FA zichzelf buitensluiten (er was alleen een koppelscherm, geen invoer bij
 * een volgende aanmelding). Blokkeert zelf niets: de server beslist (MFA_AFDWINGEN).
 */
export function TweedeStap() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [gekozen, setGekozen] = useState<string>("");

  const { data: factoren, isLoading } = useQuery({
    queryKey: ["mfa-factoren"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return ((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified");
    },
  });

  const factorId = gekozen || factoren?.[0]?.id || "";

  async function bevestig(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!codeGeldig(code)) {
      setFout("Typ de 6 cijfers uit je authenticator-app.");
      return;
    }
    setBezig(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: schoonCode(code) });
    setBezig(false);
    if (error) {
      setFout(mfaFoutTekst(error));
      return;
    }
    setCode("");
    toast.success("Bevestigd in 2 stappen");
    // Nieuwe sessie (aal2): alles opnieuw ophalen.
    await qc.invalidateQueries();
  }

  return (
    <section
      aria-labelledby="tweede-stap-titel"
      className="border-b border-red-500/30 bg-red-500/10 px-6 py-3 text-sm text-red-100"
    >
      <h2 id="tweede-stap-titel" className="font-medium">
        2-staps verificatie is verplicht voor jouw rol
      </h2>
      {isLoading ? (
        <p className="mt-1">Even kijken welke authenticator je gekoppeld hebt…</p>
      ) : !factoren?.length ? (
        <p className="mt-1">
          Je hebt nog geen authenticator gekoppeld.{" "}
          <Link to="/beheer/beveiliging" className="underline">
            Nu instellen
          </Link>
        </p>
      ) : (
        <form onSubmit={bevestig} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
          {factoren.length > 1 ? (
            <label className="flex flex-col gap-1">
              <span>Authenticator</span>
              <select
                value={factorId}
                onChange={(e) => setGekozen(e.target.value)}
                className="h-11 rounded border border-white/20 bg-slate-950 px-2 text-slate-100"
              >
                {factoren.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name || "Authenticator"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span>Code uit je authenticator-app</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={9}
              aria-invalid={fout ? true : undefined}
              aria-describedby={fout ? "tweede-stap-fout" : undefined}
              className="h-11 w-40 rounded border border-white/20 bg-slate-950 px-3 text-base tracking-widest text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={bezig}
            className="h-11 rounded bg-red-500 px-4 font-medium text-white disabled:opacity-60"
          >
            {bezig ? "Bezig…" : "Bevestigen"}
          </button>
          {fout ? (
            <p id="tweede-stap-fout" role="alert" className="basis-full text-red-200">
              {fout}
            </p>
          ) : null}
          <p className="basis-full text-xs text-red-200/80">
            Telefoon kwijt? Kies je reserve-authenticator. Alles kwijt? Alleen de eigenaar kan dit
            herstellen via het beheerdashboard van de databank (zie het herstelplan).
          </p>
        </form>
      )}
    </section>
  );
}
