import { createFileRoute, Link } from "@tanstack/react-router";
import { QrDeelKaart } from "@/components/QrDeelKaart";
import { useT } from "@/lib/voorkeuren";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

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
    <div className="min-h-screen bg-background px-4 py-6 pb-10">
      <header className="mx-auto flex max-w-md items-center gap-3">
        <img src={logo} alt="Foodlo" className="size-10" />
        <h1 className="text-2xl font-bold tracking-tight">Foodlo</h1>
      </header>

      <main className="mx-auto mt-6 max-w-md space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            {t("Laat anderen Foodlo openen")}
          </h2>
          <p className="mt-3 text-center text-base text-muted-foreground">
            {t(
              "Laat ze deze QR-code scannen met hun telefoon. Ze kunnen meteen verder in de browser, zonder app store."
            )}
          </p>
          <p className="mx-auto mt-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-base font-semibold text-emerald-700">
            {t("Geen App Store of Play Store nodig")}
          </p>
          <div className="mt-6">
            <QrDeelKaart />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-bold">{t("Zo werkt het")}</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-muted-foreground">
            <li>{t("Toon deze pagina of maak een screenshot van de QR-code.")}</li>
            <li>{t("De ander scant de code met de camera-app.")}</li>
            <li>{t("Ze openen Foodlo in de browser en kunnen zich aanmelden.")}</li>
          </ol>
        </section>

        <div className="text-center">
          <Link
            to="/aanmelden"
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-5" />
            {t("Terug naar Foodlo")}
          </Link>
        </div>
      </main>
    </div>
  );
}
