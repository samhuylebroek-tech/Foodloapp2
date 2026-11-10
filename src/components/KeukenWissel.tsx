import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Refrigerator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/voorkeuren";
import { useVoorraadNamen } from "@/hooks/useVoorraadStand";

/** Keuken = je recepten en je voorraad, één tik van elkaar. */
export function KeukenWissel() {
  const t = useT();
  const pad = useRouterState({ select: (s) => s.location.pathname });
  const { data: voorraad } = useVoorraadNamen();
  const items = [
    { to: "/gerechten" as const, label: t("Recepten"), icon: BookOpen },
    { to: "/voorraad" as const, label: t("Voorraad"), icon: Refrigerator },
  ];
  return (
    <nav aria-label={t("Keuken")} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {items.map((i) => {
        const actief = pad === i.to;
        return (
          <Link
            key={i.to}
            to={i.to}
            aria-current={actief ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full px-2 py-1 text-center text-base font-semibold leading-tight transition-colors",
              actief
                ? "bg-card text-foreground shadow-zacht"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <i.icon className="size-5" aria-hidden />
            {i.label}
            {i.to === "/voorraad" && voorraad?.length ? (
              <span className="rounded-full bg-secondary px-2 text-[0.85rem] tabular-nums text-secondary-foreground">
                {voorraad.length}
                <span className="sr-only"> {t("producten")}</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
