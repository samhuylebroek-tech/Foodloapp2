import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminSessies } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/beveiliging")({ component: Beveiliging });

function Beveiliging() {
  const { aal, profiel } = useAdmin();
  const sessieFn = useServerFn(adminSessies);
  const { data: sessies } = useQuery({ queryKey: ["admin-sessies"], queryFn: () => sessieFn() });

  const [factoren, setFactoren] = useState<any[]>([]);
  const [qr, setQr] = useState<{ id: string; svg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [bezig, setBezig] = useState(false);

  const laadFactoren = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactoren(data?.totp ?? []);
  };
  useEffect(() => {
    laadFactoren();
  }, []);

  const start = async () => {
    setBezig(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `MaJeBa ${Date.now()}` });
    setBezig(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQr({ id: data.id, svg: data.totp.qr_code, secret: data.totp.secret });
  };

  const bevestig = async () => {
    if (!qr) return;
    setBezig(true);
    const { data: uitdaging, error: e1 } = await supabase.auth.mfa.challenge({ factorId: qr.id });
    if (e1 || !uitdaging) {
      setBezig(false);
      toast.error(e1?.message ?? "Kon niet starten");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: qr.id,
      challengeId: uitdaging.id,
      code: code.trim(),
    });
    setBezig(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2-staps verificatie staat aan");
    setQr(null);
    setCode("");
    laadFactoren();
  };

  return (
    <AdminShell titel="Beveiliging" omschrijving="2-staps verificatie, sessies en apparaten">
      <div className="grid gap-4 xl:grid-cols-2">
        <Kaart>
          <p className="text-sm font-medium">2-staps verificatie</p>
          <p className="mt-1 text-xs text-slate-400">
            Huidig niveau: {aal === "aal2" ? "geverifieerd in 2 stappen" : "wachtwoord alleen"}
            {profiel?.mfa_required ? " · verplicht voor jouw rol" : ""}
          </p>

          {factoren.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {factoren.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded border border-white/10 p-2">
                  <span>
                    {f.friendly_name || "Authenticator"} · {f.status}
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      toast.success("Verwijderd");
                      laadFactoren();
                    }}
                  >
                    Verwijderen
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Nog geen authenticator gekoppeld.</p>
          )}

          {qr ? (
            <div className="mt-4 space-y-3">
              <div
                className="w-40 rounded bg-white p-2"
                dangerouslySetInnerHTML={{ __html: qr.svg.startsWith("<") ? qr.svg : `<img src="${qr.svg}" />` }}
              />
              <p className="text-xs text-slate-400">Of typ deze sleutel in je app: {qr.secret}</p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-cijferige code"
                  className="max-w-[160px] border-white/10 bg-slate-950 text-slate-100"
                />
                <Button onClick={bevestig} disabled={bezig}>
                  Bevestigen
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-4" onClick={start} disabled={bezig}>
              Authenticator koppelen
            </Button>
          )}
        </Kaart>

        <Kaart>
          <p className="mb-3 text-sm font-medium">Aanmeldingen, IP-adressen en apparaten</p>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Beheerder</th>
                  <th>IP</th>
                  <th>Toestel</th>
                  <th>Laatst actief</th>
                </tr>
              </thead>
              <tbody>
                {(sessies ?? []).map((s: any) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2">{s.naam}</td>
                    <td className="text-slate-400">{s.ip ?? "—"}</td>
                    <td className="max-w-[220px] truncate text-slate-400">{s.user_agent ?? "—"}</td>
                    <td className="whitespace-nowrap text-slate-400">
                      {new Date(s.last_seen_at).toLocaleString("nl-BE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kaart>
      </div>
    </AdminShell>
  );
}
