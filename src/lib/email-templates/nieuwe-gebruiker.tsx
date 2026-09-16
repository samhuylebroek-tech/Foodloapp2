import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  naam?: string;
  handle?: string;
  email?: string;
  taal?: string;
  moment?: string;
  profielUrl?: string;
}

const Email = ({ naam, handle, email, taal, moment, profielUrl }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{`Nieuwe gebruiker: ${naam ?? "onbekend"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={kop}>Nieuwe gebruiker op Foodlo</Heading>
        <Text style={tekst}>
          <strong>{naam ?? "Onbekend"}</strong>
          {handle ? ` (@${handle})` : ""} heeft zopas een profiel aangemaakt.
        </Text>
        <Hr style={lijn} />
        <Text style={regel}>E-mail: {email ?? "niet bekend"}</Text>
        <Text style={regel}>Taal: {taal ?? "onbekend"}</Text>
        <Text style={regel}>Aangemeld: {moment ?? "zonet"}</Text>
        {profielUrl ? (
          <Text style={tekst}>
            <Link href={profielUrl} style={knop}>
              Profiel bekijken in het controlecentrum
            </Link>
          </Text>
        ) : null}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Nieuwe gebruiker: ${data["naam"] ?? "onbekend"}`,
  displayName: "Nieuwe gebruiker",
  previewData: {
    naam: "Jana Peeters",
    handle: "jana",
    email: "jana@example.com",
    taal: "nl",
    moment: "16 september 2026 om 14:05",
    profielUrl: "https://foodloapp.com/beheer/gebruiker/123",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const kop = { fontSize: "20px", color: "#0f172a", margin: "0 0 12px" };
const tekst = { fontSize: "15px", color: "#334155", lineHeight: "24px" };
const regel = { fontSize: "14px", color: "#475569", margin: "4px 0" };
const lijn = { borderColor: "#e2e8f0", margin: "16px 0" };
const knop = { color: "#059669", fontWeight: 600, textDecoration: "none" };
