import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminTicketBijwerken, adminTickets } from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/beheer/support")({ component: Support });

const STATUSSEN = ["alles", "nieuw", "bezig", "opgelost", "gesloten"];

function Support() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(adminTickets);
  const updateFn = useServerFn(adminTicketBijwerken);
  const [status, setStatus] = useState("alles");
  const [notities, setNotities] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", status],
    queryFn: () => lijstFn({ data: { status } }),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string; admin_note: string }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Ticket bijgewerkt");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell titel="Support" omschrijving="Vragen en meldingen van gebruikers">
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSSEN.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "secondary"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-400">Laden…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-slate-400">Geen tickets in deze status.</p>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((t: any) => (
            <Kaart key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t.kind} · {t.naam}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{t.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.page ?? "—"} · {new Date(t.created_at).toLocaleString("nl-BE")}
                    {t.rating ? ` · ${t.rating}/5` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t.status}</span>
              </div>

              {mag("support.manage") ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    defaultValue={t.admin_note}
                    onChange={(e) => setNotities((n) => ({ ...n, [t.id]: e.target.value }))}
                    placeholder="Interne notitie"
                    className="max-w-xs border-white/10 bg-slate-950 text-slate-100"
                  />
                  {["nieuw", "bezig", "opgelost", "gesloten"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        update.mutate({ id: t.id, status: s, admin_note: notities[t.id] ?? t.admin_note ?? "" })
                      }
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              ) : null}
            </Kaart>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
