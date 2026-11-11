import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, MessageSquareHeart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";
import { ConceptBand, DoeHetNu, SOORT_LABEL, Stappen } from "@/components/hulp/HulpDelen";
import { MODULES } from "@/lib/functies";
import { artikel as zoekArtikel, zichtbareArtikels } from "@/lib/hulp/artikels";
import { maakTutorial } from "@/lib/hulp/tutorials";

export const Route = createFileRoute("/hulp/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${zoekArtikel(params.slug)?.titel ?? "Hulp"} — Foodlo` }],
  }),
  component: ArtikelPagina,
});

function ArtikelPagina() {
  const { slug } = Route.useParams();
  const zichtbaar = zichtbareArtikels();
  const a = zichtbaar.find((x) => x.slug === slug);

  if (!a)
    return (
      <AppShell title="Hulp">
        <div className="space-y-4">
          <p className="text-base">Deze uitleg bestaat niet (meer).</p>
          <Link
            to="/hulp"
            className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
          >
            Naar het Help Center
          </Link>
        </div>
      </AppShell>
    );

  const module = MODULES.find((m) => m.id === a.module);
  const tut = maakTutorial(a);
  const verwant = zichtbaar.filter((x) => x.module === a.module && x.slug !== a.slug).slice(0, 4);

  return (
    <AppShell title={a.titel} ondertitel={`${SOORT_LABEL[a.soort]} · ${module?.titel ?? ""}`}>
      <div className="space-y-7">
        <ConceptBand />
        <p className="text-lg leading-relaxed">{a.samenvatting}</p>

        <section aria-labelledby="stappen-kop" className="paneel space-y-4 p-5">
          <h2 id="stappen-kop" className="text-kaarttitel">
            {a.soort === "handleiding" ? "Zo doe je het" : "Wat kan je doen?"}
          </h2>
          <Stappen stappen={a.stappen} />
          {a.tips?.length ? (
            <div className="rounded-2xl bg-secondary/60 p-4">
              <h3 className="text-base font-bold">Goed om te weten</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-base">
                {a.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <DoeHetNu artikel={a} />
        </section>

        {tut ? (
          <section aria-labelledby="tutorial-kop" className="paneel space-y-3 p-5">
            <h2 id="tutorial-kop" className="text-kaarttitel">
              Tutorial
            </h2>
            <p className="text-base text-muted-foreground">
              ± {Math.round(tut.duur)} seconden, met ondertitels en zonder geluid. De video wordt
              opgenomen in de demo-app; tot dan lees je hier de ondertitels.
            </p>
            <details className="rounded-2xl bg-muted/60 p-4">
              <summary className="min-h-11 cursor-pointer text-base font-semibold">
                Ondertitels lezen
              </summary>
              <ol className="mt-2 space-y-2">
                {tut.scenes.map((s) => (
                  <li key={s.nummer} className="text-base">
                    <span className="font-mono text-[0.9rem] text-muted-foreground">
                      {s.start.toFixed(0)} s
                    </span>{" "}
                    {s.tekst}
                  </li>
                ))}
              </ol>
            </details>
          </section>
        ) : null}

        {verwant.length ? (
          <Groep titel="Meer over dit onderwerp">
            {verwant.map((v) => (
              <LinkRij
                key={v.slug}
                to="/hulp/$slug"
                params={{ slug: v.slug }}
                icoon={BookOpen}
                titel={v.titel}
              />
            ))}
          </Groep>
        ) : null}

        <Groep titel="Hielp dit niet?">
          <LinkRij
            to="/feedback"
            icoon={MessageSquareHeart}
            tint="terracotta"
            titel="Contact met support"
            uitleg="Vertel ons waar je vastloopt"
          />
          <LinkRij to="/hulp" icoon={BookOpen} tint="grijs" titel="Alle hulp" />
        </Groep>
      </div>
    </AppShell>
  );
}
