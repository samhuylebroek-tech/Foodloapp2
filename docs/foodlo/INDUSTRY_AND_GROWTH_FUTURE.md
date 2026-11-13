# AI Growth OS en de toekomst van de sector
**Bron van waarheid voor:** de strategische ambitie van een generiek AI Growth Operating System, en hoe het zich verhoudt tot Foodlo.

**Status:** **apart product**. Het hoort niet bij Foodlo F1–F3 en mag de Foodlo-lancering nooit vertragen (D-2026-11-13-1). Er wordt niets van gebouwd zonder een aparte opdracht.

## 1. Wat het zou kunnen worden
- AI-marketingagents;
- SEO en contentmarketing;
- koppelingen met sociale media;
- advertentiebeheer;
- marketingautomatisering;
- omzetanalyse;
- business intelligence;
- CRM-koppelingen;
- revenue intelligence;
- commerciële SaaS-diensten.

## 2. Wat gedeeld kan worden, en wat apart blijft
| Onderdeel | Delen? | Waarom |
|---|---|---|
| AI-gateway en providerinterface, credits, kostenmeting, cache | **ja, als infrastructuur** (bibliotheek of dienst) | Zelfde probleem: kosten, limieten, providers wisselen |
| Privacylaag (`voorAI`) | **het patroon wel, de lijsten niet** | Foodlo-gezondheidstermen horen niet in een marketingproduct |
| Auth, meten, foutopvang, e-mail, push | ja, als infrastructuur | Generiek |
| Designsysteem | deels (basiscomponenten) | Het merk en de toon verschillen |
| **Foodlo-gebruikersgegevens** (profielen, recepten, voeding, gezin) | **nooit** | Ander doel (AVG doelbinding), bijzondere gegevens |
| Partner-BCC (F3) | mogelijk de eerste klant van het Growth OS | Via een API met geaggregeerde, toegestane gegevens |
| Databank | **apart** | Eigen schema, eigen toegangsrechten (RLS) en bewaartermijnen |

## 3. Wat Foodlo nu doet om dit later mogelijk te houden
- **Infrastructuur achter interfaces:**
  - de AI-provider (`AI_ARCHITECTURE.md` §4);
  - de betaaladapter (F3);
  - e-mail en push.
- **Geen marketing in de consumentenapp:** geen marketing- of advertentiefuncties hardgecodeerd in de consumentenapp.
- **Gebeurtenissen zonder inhoud:** de gebeurtenissen (`meten.ts`) zijn al zonder inhoud en per sessie. Een latere BI-laag kan geaggregeerd meelezen, met toestemming.
