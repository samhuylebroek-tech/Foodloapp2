/**
 * P5 — Bel in de kop met de meldingen in de app (gezin + restjes) en een ongelezen teller.
 * Niets hiervan gaat naar buiten: push en e-mail staan apart op /meldingen en vragen eerst
 * toestemming. Kiezen welke soorten je wilt: Instellingen › Suggesties en meldingen.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CookingPot,
  PackageCheck,
  Settings2,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppMeldingen } from "@/hooks/useAppMeldingen";
import { tellerTekst, wanneerTekst, type MeldingSoort } from "@/lib/samenwerking/meldingen";
import { cn } from "@/lib/utils";

const ICOON: Record<MeldingSoort, LucideIcon> = {
  menu: CalendarDays,
  toegewezen: ShoppingCart,
  "winkelen-klaar": PackageCheck,
  restje: CookingPot,
  conflict: Users,
};

export function MeldingenBel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const m = useAppMeldingen();
  const label = m.ongelezen ? `Meldingen, ${m.ongelezen} nieuw` : "Meldingen";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
        data-testid="meldingen-bel"
        className="relative inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-foreground hover:bg-muted"
      >
        {/* Pictogram in px: groeit niet mee met grote tekst (BUG-126). */}
        <Bell className="size-[24px]" aria-hidden />
        {m.ongelezen ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 flex min-w-[22px] items-center justify-center rounded-full bg-destructive px-1 text-[13px] font-bold leading-[22px] text-destructive-foreground"
          >
            {tellerTekst(m.ongelezen)}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-3xl p-0 sm:bottom-6 sm:rounded-3xl"
        >
          <SheetHeader className="px-5 pb-2 pt-5 text-left">
            <SheetTitle className="pr-12 font-display text-xl font-semibold">Meldingen</SheetTitle>
            <SheetDescription className="text-base">
              Wat er in je gezin gebeurde. Deze meldingen blijven in de app.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
            {m.lijst.length ? (
              <>
                {m.ongelezen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-3"
                    onClick={() => void m.allesGelezen()}
                  >
                    <CheckCheck aria-hidden /> Alles gelezen
                  </Button>
                ) : null}
                <ul className="space-y-2" aria-label="Meldingen" data-testid="meldingen-lijst">
                  {m.lijst.map((x) => {
                    const Icoon = ICOON[x.soort];
                    return (
                      <li key={x.id} className="@container">
                        <button
                          type="button"
                          onClick={() => {
                            void m.markeer([x.id]);
                            setOpen(false);
                            if (x.link) void navigate({ href: x.link });
                          }}
                          className={cn(
                            "flex min-h-16 w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-muted",
                            x.gelezen ? "bg-muted/40" : "bg-secondary",
                          )}
                        >
                          {/* Grote tekst (smal kader): pictogram weg, zodat de tekst niet midden in woorden breekt. */}
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary ring-1 ring-border @max-[22rem]:hidden">
                            <Icoon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-base leading-snug hyphens-auto",
                                !x.gelezen && "font-semibold",
                              )}
                            >
                              {x.tekst}
                            </span>
                            <span className="block text-[0.95rem] text-muted-foreground">
                              {wanneerTekst(x.op)}
                              {x.gelezen ? "" : " · nieuw"}
                            </span>
                          </span>
                          {!x.gelezen ? (
                            <span
                              aria-hidden
                              className="mt-2 size-2.5 shrink-0 rounded-full bg-destructive"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bell className="size-10 text-muted-foreground" aria-hidden />
                <p className="text-lg font-semibold">Nog geen meldingen</p>
                <p className="text-base text-muted-foreground">
                  Verandert iemand van je gezin het weekmenu of vraagt iemand jou iets te halen, dan
                  zie je dat hier.
                </p>
              </div>
            )}
            <Link
              to="/instellingen/suggesties"
              hash="meldingen"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-12 items-center gap-2 rounded-xl px-2 text-base font-semibold text-primary"
            >
              <Settings2 className="size-5" aria-hidden /> Kies welke meldingen je krijgt
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
