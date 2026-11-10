import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminBeheerderVerwijderen,
  adminBeheerderZetten,
  adminBeheerders,
  adminZoekGebruikerVoorRol,
} from "@/lib/admin.functions";
import { AdminShell, Kaart } from "@/components/AdminShell";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/beheer/team")({ component: Team });

const ROLLEN = [
  { id: "super_admin", label: "Super admin", uitleg: "Alles, ook beheerders en instellingen" },
  { id: "admin", label: "Admin", uitleg: "Gebruikers, recepten, inhoud, support" },
  { id: "support", label: "Support", uitleg: "Support en gebruikersinzage" },
  { id: "content_manager", label: "Content manager", uitleg: "Recepten, labels en inhoud" },
  { id: "analyst", label: "Analist", uitleg: "Alleen cijfers bekijken" },
];

function Team() {
  const { mag } = useAdmin();
  const qc = useQueryClient();
  const lijstFn = useServerFn(adminBeheerders);
  const zetFn = useServerFn(adminBeheerderZetten);
  const wisFn = useServerFn(adminBeheerderVerwijderen);
  const zoekFn = useServerFn(adminZoekGebruikerVoorRol);

  const [zoek, setZoek] = useState("");
  const [resultaten, setResultaten] = useState<any[]>([]);

  const { data } = useQuery({ queryKey: ["admin-team"], queryFn: () => lijstFn() });

  const zet = useMutation({
    mutationFn: (v: {
      user_id: string;
      role: string;
      active?: boolean;
      can_view_private_content?: boolean;
      note?: string;
    }) => zetFn({ data: v }),
    onSuccess: () => {
      toast.success("Beheerder bijgewerkt");
      qc.invalidateQueries({ queryKey: ["admin-team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!mag("admins.manage")) {
    return (
      <AdminShell titel="Beheerders">
        <p className="text-slate-400">Je hebt geen toegang tot dit onderdeel.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell titel="Beheerders" omschrijving="Wie mag wat in het Control Center">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Kaart>
          <p className="mb-3 text-sm font-medium">Huidig team</p>
          <div className="space-y-3">
            {(data ?? []).map((b: any) => (
              <div key={b.user_id} className="rounded-lg border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{b.naam || "(geen naam)"}</p>
                    <p className="text-xs text-slate-400">{b.role.replace("_", " ")}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await wisFn({ data: { user_id: b.user_id } });
                        toast.success("Verwijderd uit team");
                        qc.invalidateQueries({ queryKey: ["admin-team"] });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Verwijderen
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ROLLEN.map((r) => (
                    <Button
                      key={r.id}
                      size="sm"
                      variant={b.role === r.id ? "default" : "secondary"}
                      onClick={() => zet.mutate({ user_id: b.user_id, role: r.id, active: b.active, can_view_private_content: b.can_view_private_content })}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Mag privé-inhoud van gebruikers bekijken</span>
                  <Switch
                    aria-label="Mag privé-inhoud van gebruikers bekijken"
                    checked={b.can_view_private_content}
                    onCheckedChange={(v) => zet.mutate({ user_id: b.user_id, role: b.role, active: b.active, can_view_private_content: v })}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Actief</span>
                  <Switch
                    aria-label="Actief"
                    checked={b.active}
                    onCheckedChange={(v) => zet.mutate({ user_id: b.user_id, role: b.role, active: v, can_view_private_content: b.can_view_private_content })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Kaart>

        <Kaart>
          <p className="mb-3 text-sm font-medium">Beheerder toevoegen</p>
          <div className="flex gap-2">
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam of e-mail"
              className="border-white/10 bg-slate-950 text-slate-100"
            />
            <Button
              onClick={async () => {
                const r = await zoekFn({ data: { zoek } });
                setResultaten(r as any[]);
              }}
            >
              Zoek
            </Button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {resultaten.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-white/10 p-2">
                <div>
                  <p>{r.display_name || "(geen naam)"}</p>
                </div>
                <Button size="sm" onClick={() => zet.mutate({ user_id: r.id, role: "support", active: true, can_view_private_content: false })}>
                  Toevoegen
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 text-xs text-slate-400">
            {ROLLEN.map((r) => (
              <p key={r.id}>
                <span className="text-slate-200">{r.label}</span> — {r.uitleg}
              </p>
            ))}
          </div>
        </Kaart>
      </div>
    </AdminShell>
  );
}
