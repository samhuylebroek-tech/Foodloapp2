import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  onderwerp?: string;
  bericht?: string;
  naam?: string;
}

const Email = ({ onderwerp, bericht, naam }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{onderwerp ?? "Bericht van Foodlo"}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
      <Container style={{ padding: "24px", maxWidth: "560px" }}>
        <Heading style={{ fontSize: "22px", color: "#1F2A24" }}>{onderwerp ?? "Bericht van Foodlo"}</Heading>
        {naam ? <Text style={tekst}>Hallo {naam},</Text> : null}
        {(bericht ?? "").split("\n").map((r, i) => (
          <Text key={i} style={tekst}>
            {r || "\u00a0"}
          </Text>
        ))}
        <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />
        <Text style={{ fontSize: "13px", color: "#6b7280" }}>Met vriendelijke groet, het Foodlo-team</Text>
      </Container>
    </Body>
  </Html>
);

const tekst = { fontSize: "16px", lineHeight: "24px", color: "#1F2A24", margin: "0 0 8px" };

export const template: TemplateEntry = {
  component: Email,
  subject: (d) => (d["onderwerp"] as string) || "Bericht van Foodlo",
  displayName: "Persoonlijk bericht",
  previewData: { onderwerp: "Hoe bevalt Foodlo?", bericht: "We horen graag hoe het gaat.", naam: "Sam" },
};
