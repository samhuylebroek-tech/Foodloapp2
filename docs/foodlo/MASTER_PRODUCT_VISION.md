# Productvisie Foodlo
Bron van waarheid voor visie, doelgroepen en principes.

**Put uit:**
- `docs/foodloapp-v2/PRODUCTVISIE-V2.md`;
- de missie in `CLAUDE.md`;
- `CLAUDE-CODE-HANDOFF.md`;
- de opdrachten van de eigenaar van 2026-11-12/13.

## 1. Waar Foodlo voor staat
**Your personal cooking assistant, and your complete food experience.**

Foodlo helpt elke dag met beslissen wat je eet, je week organiseren, inspiratie vinden, boodschappen doen en met plezier koken. Foodlo begrijpt steeds beter wat bij je past en legt uit waarom het iets voorstelt. De gebruiker houdt altijd de controle.

**Kernlus:** recept vinden of toevoegen → bewaren en ordenen → plannen → boodschappen → (optioneel) voorraad en restjes → koken → beoordelen.

## 2. Voor wie
| Doelgroep | Wat ze nodig hebben | Fase |
|---|---|---|
| Beginner (bv. 70 jaar, weinig technisch) | Grote tekst, gewone taal, één duidelijke actie, niets dat verloren kan gaan | F1 |
| Druk gezin | Snel plannen, één lijst, rekening houden met wie meeeet | F1 (basis), F2 (per lid) |
| Enthousiaste thuiskok, food creator (bv. 20 jaar) | Mooie presentatie, snel recepten importeren, later publiceren en een publiek | F1 (consument), F2 (creator) |
| Creators en receptmakers | Profiel, publiek, statistieken, verdienmodellen | F2–F3 |
| Merken, retail, partners | Transparante samenwerkingen, rapportage, eigen omgeving | F3 |

## 3. Principes (gelden voor elke beslissing)
1. **Behoud:** geen functie verdwijnt stil. Wat niet in F1 komt, staat met een fase in de inventaris.
2. **Veiligheid eerst:**
   - allergieën en dieet zijn harde voorwaarden (`src/lib/veiligheid.ts`), geen suggesties;
   - **persoonlijke allergieën en gevoelige voedingsinformatie gaan nooit naar externe AI-diensten** (D-2026-11-13-2).
3. **Onbekend is niet aanwezig:**
   - onbekende voorraad telt nooit als "in huis";
   - niet-geregistreerde restjes bestaan niet;
   - voorraad en restjes blijven gescheiden.
4. **AI helpt, de mens beslist:** AI overschrijft nooit iets zonder dat de gebruiker het nakijkt. Er is altijd een weg zonder AI.
5. **Begrijpelijk voor iedereen:**
   - WCAG 2.2 AA als doel;
   - werkt bij 200 % tekst;
   - woorden bij knoppen, geen raadselpictogrammen;
   - Nederlands met Belgische notatie.
6. **Eén product:** dezelfde vormtaal (designsysteem), namen en navigatie overal.
7. **Commercieel transparant:**
   - gesponsorde inhoud is altijd herkenbaar;
   - commerciële belangen sturen persoonlijke aanbevelingen niet onzichtbaar;
   - commerciële modules staan los van de consumentenervaring.
8. **Kostenbewust:**
   - regels vóór AI;
   - cache en limieten;
   - kleinste geschikte model;
   - gemeten kost per actie.

## 4. Fasen (beslissing D-2026-11-13-1, optie B)
| Fase | Inhoud |
|---|---|
| **F1: eerste consumentenlancering** | Alle bestaande consumentenfuncties, de 14 manieren om recepten toe te voegen, Vandaag en de assistent, Week, Lijst, Winkelmodus, Kookstand, Keuken. Daarbij:<br>- **persoonlijke allergieën, voorkeuren en uitsluitingen op het account** (maximaal beschermd);<br>- de bestaande gedeelde gezinsplanning;<br>- een veilige, toegankelijke app op iOS en Android. |
| **F2: gezinsuitbreiding en verdieping** | Allergieën en voorkeuren **per gezinslid**, uitgebreide gezinsplanning (mee-eters), eigen receptenverzamelingen, creators (profiel, publiceren, volgen, moderatie), weer, budget, houdbaarheid, documentimport |
| **F3: commerciële uitbreiding** | Business Control Center voor partners, merken en retail; gesponsorde inhoud; premium; betalingen en abonnementen; creatorverdienmodellen |
| **Apart product** | AI Growth OS (`INDUSTRY_AND_GROWTH_FUTURE.md`). Mag F1 nooit vertragen. |

## 5. Wat succes is
- **Gebruik:** consumenten komen dagelijks of wekelijks terug, omdat Foodlo echt helpt beslissen en organiseren.
- **Zonder hulp:** een beginner kan zonder hulp een recept toevoegen, plannen, boodschappen doen en koken.
- **Geen veiligheidsfouten:** geen onveilige suggestie bij een allergie, en geen gevoelige gegevens naar externe AI.
- **Toekomst:** creators en partners kunnen later aansluiten zonder herbouw. Het Growth OS blijft een apart project (D-2026-11-13-6).
