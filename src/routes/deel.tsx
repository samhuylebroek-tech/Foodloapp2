import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { QrDeelKaart } from "@/components/QrDeelKaart";
import { useT } from "@/lib/voorkeuren";

export const Route = createFileRoute("/deel")({
  head: () => ({
    meta: [
      { title: "Deel Foodlo" },
      {
        name: "description",
        content: "Deel Foodlo met vrienden via een QR-code of link.",
      },
      { property: "og:title", content: "Deel Foodlo" },
      {
        property: "og:description",
        content: "Scan de QR-code om Foodlo te openen.",
      },
    ],
  }),
  component: DeelPage,
});

function DeelPage() {
  const t = useT();
  return (
    <AppShell title={t("Deel Foodlo")}>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            {t("Laat anderen Foodlo openen")}
          </h2>
          <p className="mt-3 text-center text-base text-muted-foreground">
            {t(
              "Laat ze deze QR-code scannen met hun telefoon. Ze kunnen meteen verder in de browser, zonder app store."
            )}
          </p>
          <div className="mt-6">
            <QrDeelKaart />
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-bold">{t("Zo werkt het")}</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-muted-foreground">
            <li>{t("Toon deze pagina of maak een screenshot van de QR-code.")}</li>
            <li>{t("De ander scant de code met de camera-app.")}</li>
            <li>{t("Ze openen Foodlo in de browser en kunnen zich aanmelden.")}</li>
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
