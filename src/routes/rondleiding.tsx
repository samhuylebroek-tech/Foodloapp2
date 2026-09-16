import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { startRondleiding } from "@/lib/rondleiding";

export { RONDLEIDING_SLEUTEL } from "@/lib/rondleiding";

export const Route = createFileRoute("/rondleiding")({
  head: () => ({
    meta: [
      { title: "Rondleiding door Foodlo — zo werkt de app" },
      {
        name: "description",
        content:
          "Ontdek stap voor stap hoe je recepten bewaart, je weekmenu plant, boodschappen afvinkt en samen kookt met je gezin.",
      },
      { property: "og:title", content: "Rondleiding door Foodlo — zo werkt de app" },
      {
        property: "og:description",
        content: "In een paar korte stapjes leer je alles wat Foodlo voor je doet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RondleidingPage,
});

// De rondleiding loopt als overlay bovenop de echte app (zie src/components/Rondleiding.tsx).
function RondleidingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    startRondleiding();
    navigate({ to: "/" });
  }, [navigate]);

  return null;
}
