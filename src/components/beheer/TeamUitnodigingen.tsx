/**
 * Team en rollen (fase 5): uitnodigen in TESTMODUS (er wordt geen e-mail verstuurd) en een tabel
 * met de rechten per scherm voor elke rol. De tabel komt uit dezelfde rechtenmatrix die de server
 * gebruikt (`rechtenVanRol`), dus wat hier staat, is wat de server afdwingt.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { Kaart } from "@/components/AdminShell";
import { BccTestmodus, datumTijd } from "@/components/beheer/BccDelen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rechtenVanRol, type AdminRol } from "@/lib/admin.functions";
import {
  BCC_SCHERMEN,
  ROL_NAAM,
  rolNaam,
  UITNODIGBARE_ROLLEN,
  uitnodigingFout,
  WIJZIG_RECHT,
} from "@/lib/bcc";
import { bccUitnodigen, bccUitnodigingen, bccUitnodigingIntrekken } from "@/lib/bcc.functions";

const SLEUTEL = ["bcc-uitnodigingen"];

export function TeamUitnodigingen() {
  const qc = useQueryClient();
  const lijstFn = useServerFn(bccUitnodigingen);
  const nodigFn = useServerFn(bccUitnodigen);
  const trekFn = useServerFn(bccUitnodigingIntrekken);
  const { data, isLoading, isError } = useQuery({
    queryKey: SLEUTEL,
    queryFn: () => lijstFn(),
  });
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<AdminRol>("content_manager");
  const [geprobeerd, setGeprobeerd] = useState(false);
  const fout = uitnodigingFout(email, rol, data?.uitnodigingen ?? []);
  const nodig = useMutation({
    mutationFn: () => nodigFn({ data: { email, rol } }),
    onSuccess: () => {
      toast.success("Uitnodiging klaargezet in testmodus. Er is geen e-mail verstuurd.");
      setEmail("");
      setGeprobeerd(false);
      void qc.invalidateQueries({ queryKey: SLEUTEL });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const trek = useMutation({
    mutationFn: (id: string) => trekFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Uitnodiging ingetrokken.");
      void qc.invalidateQueries({ queryKey: SLEUTEL });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Kaart className="space-y-3">
      <h2 className="text-base font-semibold">Teamlid uitnodigen</h2>
      <BccTestmodus>
        Er wordt geen e-mail verstuurd. Een uitgenodigd teamlid kan pas meewerken nadat de vaste
        eigenaarscontrole van het Control Center is aangepast; dat vraagt een aparte beslissing van
        de eigenaar.
      </BccTestmodus>
      {isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : isError ? (
        <p role="alert">De uitnodigingen konden niet geladen worden.</p>
      ) : !data?.beschikbaar ? (
        <p className="text-sm text-slate-300">Teamuitnodigingen worden binnenkort geactiveerd.</p>
      ) : (
        <>
          <form
            aria-label="Teamlid uitnodigen"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setGeprobeerd(true);
              if (!fout) nodig.mutate();
            }}
          >
            <label className="block text-sm text-slate-300">
              E-mailadres
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                aria-invalid={(geprobeerd && !!fout) || undefined}
                aria-describedby={geprobeerd && fout ? "uitnodiging-fout" : undefined}
                className="mt-1 min-h-11 border-white/10 bg-slate-950 text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Rol
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as AdminRol)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-slate-100"
              >
                {UITNODIGBARE_ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {ROL_NAAM[r].naam} — {ROL_NAAM[r].uitleg}
                  </option>
                ))}
              </select>
            </label>
            {geprobeerd && fout ? (
              <p id="uitnodiging-fout" className="text-sm text-red-300">
                {fout}
              </p>
            ) : null}
            <Button type="submit" className="min-h-11" disabled={nodig.isPending}>
              Uitnodiging klaarzetten (test)
            </Button>
          </form>
          {data.uitnodigingen.length ? (
            <ul className="space-y-2 text-sm" aria-label="Uitnodigingen">
              {data.uitnodigingen.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3"
                >
                  <span className="min-w-0 break-words">
                    {u.email}
                    <span className="block text-xs text-slate-400">
                      {rolNaam(u.rol)} ·{" "}
                      {u.status === "testmodus"
                        ? `klaargezet ${datumTijd(u.created_at)}, geen e-mail verstuurd`
                        : "ingetrokken"}
                    </span>
                  </span>
                  {u.status === "testmodus" ? (
                    <Button
                      variant="secondary"
                      className="min-h-11"
                      disabled={trek.isPending}
                      onClick={() => trek.mutate(u.id)}
                    >
                      Intrekken
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Nog geen uitnodigingen.</p>
          )}
        </>
      )}
    </Kaart>
  );
}

const ROL_VOLGORDE: AdminRol[] = ["super_admin", "admin", "content_manager", "analyst", "support"];

export function RechtenPerScherm() {
  const rechten = new Map(ROL_VOLGORDE.map((r) => [r, new Set(rechtenVanRol(r))]));
  return (
    <Kaart>
      <h2 className="mb-1 text-base font-semibold">Rechten per scherm</h2>
      <p className="mb-3 text-sm text-slate-300">
        Dezelfde regels gelden op de server: wie een scherm niet mag zien, krijgt ook via een
        directe aanvraag geen gegevens.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Wat elke rol mag per scherm</caption>
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th scope="col" className="py-2">
                Scherm
              </th>
              {ROL_VOLGORDE.map((r) => (
                <th key={r} scope="col">
                  {ROL_NAAM[r].naam}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BCC_SCHERMEN.map((s) => (
              <tr key={s.pad} className="border-t border-white/5">
                <th scope="row" className="py-2 text-left font-medium">
                  {s.label}
                </th>
                {ROL_VOLGORDE.map((r) => {
                  const zien = rechten.get(r)!.has(s.recht);
                  const wijzig = WIJZIG_RECHT[s.pad];
                  const ook = zien && wijzig ? rechten.get(r)!.has(wijzig) : null;
                  return (
                    <td key={r}>
                      {zien ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-4 text-emerald-400" aria-hidden />
                          {ook === null ? "Ja" : ook ? "Ja, ook wijzigen" : "Alleen bekijken"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Minus className="size-4" aria-hidden />
                          Nee
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kaart>
  );
}
