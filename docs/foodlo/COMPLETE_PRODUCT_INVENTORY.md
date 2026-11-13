# Volledige productinventaris
Dit document is de bron van waarheid voor wat er bestaat of gepland is, met status en fase.

De **detailinventaris per functie** blijft `docs/foodloapp-v2/PRODUCTMATRIX.md`. Dat document blijft het werkregister en wordt bij elke wijziging bijgewerkt. Hier staan het overzicht, de afspraken en de wijzigingen door beslissingen.

## 1. Statussen
| Status | Betekenis |
|---|---|
| Behouden | Bestaat, werkt, blijft zoals hij is |
| Verbeteren | Bestaat, maar ervaring of afwerking moet beter |
| Uitbreiden | Bestaat, er komt functionaliteit bij |
| Te ontwikkelen | Bestaat niet en hoort in F1 of F2 |
| Latere fase | Hoort in de visie, gepland voor F2 of F3 |
| Geblokkeerd | Kan niet verder zonder beslissing of goedkeuring; de reden staat erbij |

Naast de status valt elke functie in één van vijf categorieën:
1. Werkt.
2. Werkt, maar is onvoldoende getest.
3. Bekende bug.
4. Ontbreekt.
5. Later.

## 2. Overzicht per domein
Inhoud volgens PRODUCTMATRIX, stand 2026-11-13.

| Domein | Matrix § | Werkt | Onvoldoende getest | Ontbreekt in F1 | Later |
|---|---|---|---|---|---|
| A. Consument | A | Vandaag, Week, Ontdek, Recepten, Receptdetail, Kookstand, Boodschappen, Winkelmodus, Keuken, Klantenkaarten, Vrienden, Meldingen (web), Hulp, Credits, Instellingen | Gezinsplanning in realtime, camera | Instellingen opdelen, alternatief "iets anders vanavond", standaard aantal personen = gezinsgrootte, **persoonlijke allergieën, voorkeuren en uitsluitingen op het account** | Weer, budget, "Niet voor mij", eigen collecties, notities, populair en nieuw, restjes op het account, houdbaarheid |
| A2. Receptinvoer (14 manieren) | A2 | Alle 14 werken | De manieren 2–9 en 14 (alleen de UI getest) | Nakijkstap bij manier 11 (BUG-144) en bij "Vul aan" (BUG-145), één manier van verwijderen (BUG-146), eigen recept dupliceren, editor in stappen | Document/PDF, export uit andere apps, creator-editor |
| B. Creators | B | — | — | — | Alles (F2, betaald F3) |
| C. Gezin | C | Gezin, uitnodigen, gedeelde planning en lijst, overdragen | Realtime | — | Per lid: allergieën, voorkeuren, mee-eters (F2, 0005); één huishoudmodel (#30) |
| D. Control Center / BCC | D | ± 45 beheerschermen | — | 2FA aan (#2), RLS beheer (BUG-097), betaalpoort op de server (BUG-143) | BCC voor partners (F3), bruikbare rollen (BUG-096) |
| E. Betalingen | E | AI-credits, gratis limiet | — | — | Alles wat geld vraagt (F3, G5) |
| F. Assistent | F | Context, voorstellen met reden, tijdregel, veiligheidsregels, generatieve AI met credits | — | Privacylaag (BUG-142) | Weer, budget, gezinssignaal |
| G. Privacy en account | G | Aanmelden, herstellen, export, verwijderen | Sociale login (geen test), verwijderen tegen echte Storage | Jurist (#27), bewaartermijnen (0003/0003b), 0004 | — |
| H. Beheer en operaties | H | Meten, foutopvang, e-mail, web push, feedback | — | Help-artikels nalezen (#8), native push | Vertalingen nalezen |
| I. Mobiel en lancering | I | PWA, Android-project, CI | — | iOS-project, keuze app-shell (#22), accounts, staging, toesteltest, storemateriaal | — |

## 3. Wijzigingen door beslissingen
| Datum | Beslissing | Wijziging in de inventaris |
|---|---|---|
| 2026-11-13 | D-2026-11-13-1 (optie B) | "Allergieën en dieet op het account": van F1/F2 naar **F1, te ontwikkelen**. "Persoonlijke voorkeuren en uitsluitingen op het account": **F1, te ontwikkelen**. Allergieën en voorkeuren per gezinslid, mee-eters en eigen collecties: **F2, latere fase** (blijven op de roadmap). |
| 2026-11-13 | D-2026-11-13-3 (ronde 2) | Status van BUG-142/143/144/145/146, Lijst en Instellingen: "Te ontwikkelen in ronde 2" |

## 4. Regel
Wie een functie toevoegt, wijzigt of uitstelt, past **eerst** de PRODUCTMATRIX aan en daarna dit overzicht. Verwijderen kan alleen met gate G7 en een beslissing in `DECISIONS_LOG.md`.
