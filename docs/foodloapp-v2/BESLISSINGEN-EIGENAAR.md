# Beslissingen voor de eigenaar (overzicht)

Stand 2026-11-11. **Eén lijst met alle openstaande beslissingen**, samengevoegd uit:
- masterplan §13 (B1–B9);
- V2-IMPLEMENTATION-PLAN (gates G1–G7);
- 2FA-plannen;
- bewaartermijnen;
- staging;
- Business Control Center;
- onboarding en Help Center;
- de nieuwe productvisie.

Niets uit de oorspronkelijke documenten is weggelaten; die blijven geldig.

**Statussen:**
- **Genomen:** er is al beslist.
- **Open:** wacht op jou.
- **Nieuw:** komt uit deze ronde.

## A. Al genomen (ter herinnering, niet opnieuw beslissen)
| ID | Beslissing | Status |
|---|---|---|
| B1 | Vijf plekken in de onderbalk, "Nieuw" in de kop | Genomen en gebouwd |
| B2 | Omkeerbare acties zonder bevestiging, met ongedaan maken | Genomen |
| B4 | Geen rewrite; bestaande stack blijft | Genomen |
| B7 | Eigen lijstregels past Foodlo nooit aan | Genomen |
| B8 | Tablet: zijbalk en brede lijst | Genomen |
| B9 | Vervangen product in de naam gemarkeerd | Genomen |
| BUG-112 | Gezinsvoorraad zichtbaar voor actieve leden | Genomen (2026-11-11) |
| — | Geen stemopnames in tutorials, wel ondertitels; geen betaalde videodiensten | Genomen (productronde) |

## B. Fase 1: fundament (aanbevolen eerst)
| # | Beslissing | Aanbevolen | Gevolg als ja | Gevolg als nee of later |
|---|---|---|---|---|
| 1 | **Staging aanmaken** (B6/G1), als apart Lovable-project | Ja, zonder echte gegevens | Migraties, 2FA en echte toesteltests worden mogelijk | Alles blijft lokaal; geen gebruikerstest mogelijk |
| 2 | **2FA**: herstelplan + stappenplan goedkeuren, reserve kiezen (toestel of wachtwoordbeheerder) | Ja, eerst op staging | Control Center beschermd tegen wachtwoordlekken | Eén gelekt wachtwoord = volledige beheerderstoegang |
| 3 | **BUG-097 / 0002** beheerregels: live alleen-lezen controle en daarna 0002 op staging | Ja | Databank volgt dezelfde rechten als de app | Latent risico zodra er teamleden komen |
| 4 | **BUG-011**: schema van live vergelijken met de repo (op staging) | Ja | Betrouwbare basis voor elke migratie | Elke migratie blijft een gok |
| 5 | **0004** (weekmenuvoorkeuren alleen voor jezelf, BUG-119) | Ja, op staging | "Liever niet"-tekst niet meer zichtbaar voor gezin of uitnodigers | Mogelijke gezondheidsinfo blijft leesbaar |
| 6 | **0003 en 0003b** bewaartermijnen (zie §G) | Ja, met de aangepaste termijnen in §G | Minder gegevens = minder risico; privacybeleid concreet | AVG-beginsel opslagbeperking niet ingevuld |
| 7 | **0005** allergieën en voorkeuren per gezinslid | Ja, maar **na** 0004 en met toestemming per lid | Echte gezinspersonalisatie | Allergieën blijven per toestel (werkt, maar niet gedeeld) |
| 8 | **Help Center-artikels nalezen** (22): wie leest na en keurt goed? | Jij of een vertrouwd persoon, 1–2 uur | Help Center zichtbaar in productie | In productie alleen "wordt nagelezen" + support |
| 9 | **Proefvideo's** in de app zetten | Pas na staging en echte toestellen | Tutorials met beeld | Alleen ondertitels als tekst (werkt) |
| 10 | **Aantal vragen per dag** aan de assistent | Niet nodig zolang hij geen AI gebruikt | — | — |
| 11 | **Push** naar GitHub (G3) | Na staging-akkoord, naar een aparte branch | Lovable ziet de V2-code | Alles blijft lokaal |
| 12 | **Inactieve accounts**: na 24 maanden (met waarschuwing) verwijderen of nooit | Na 24 maanden mail, na 36 maanden verwijderen | Minder slapende gegevens | Gegevens blijven onbeperkt bewaard |

## C. Foodloapp Intelligence (nieuw)
| # | Beslissing | Aanbevolen | Gevolg |
|---|---|---|---|
| 13 | Productvisie "persoonlijke kookassistent" goedkeuren | Ja | Roadmap fase 2 kan starten |
| 14 | Beginnen **zonder generatieve AI** (regels + redenen) | Ja | Voorspelbaar, goedkoop, testbaar; AI later per onderdeel |
| 15 | **Weerdienst**: Open-Meteo (commerciële licentie nodig voor een commerciële app) of een andere | Open-Meteo via server-proxy, eerst offerte of licentie nakijken | Kleine maandkost (onzeker, zie RISICO-EN-KOSTENANALYSE); het IP-adres van de gebruiker gaat niet naar de weerdienst |
| 16 | **Locatie** voor het weer: gemeente of postcode in plaats van GPS | Ja (gemeente of postcode, zelf gekozen) | Minder privacyrisico, geen GPS-toestemming nodig |
| 17 | **Feedbacktabel** 0006 en **houdbaarheid** in de voorraad 0007 | Ja, op staging | Leren en verspilling tegengaan |
| 18 | **Proactieve push** (max. 1 per dag, opt-in) | Ja, na de mobiele validatie | Meer gebruik, risico op irritatie (daarom opt-in en uitknop) |
| 19 | **AI-budget** per maand (Lovable AI) | Behoud de huidige budgetrem; eerst €0 extra voor fase 2 | Geen verrassingen |
| 20 | **Gezondheidsgegevens nooit naar externe AI** | Ja (vast principe) | Sommige slimme functies kunnen dan niet; dat is de bedoeling |
| 21 | **Budgetvoorkeur** zonder prijs-API (€/€€/€€€ zelf ingevuld) | Ja | Geen verzonnen prijzen |

## D. Mobiel en appwinkels (nieuw)
| # | Beslissing | Aanbevolen | Gevolg |
|---|---|---|---|
| 22 | **App-shell meeleveren** in plaats van de live website te laden (`server.url`) | Ja, eerst technisch onderzoek op staging | Lagere kans op afwijzing door Apple (richtlijn 4.2), nette offline-stand; wel extra werk (± 3–5 dagen onderzoek) |
| 23 | **Native pushmeldingen** (APNs/FCM) | Ja | Meldingen werken in de app; web push blijft voor de browser |
| 24 | **Ontwikkelaarsaccounts** op naam van een **organisatie** (D-U-N-S) of persoon | Organisatie | Professioneel; bij Google geen 12-testersregel; D-U-N-S kan tot ± 30 dagen duren |
| 25 | Apple Developer Program (± €99/jaar) en Google Play (eenmalig) aanmaken | Pas in fase 3 | Kost; zonder account geen TestFlight of gesloten test |
| 26 | **Echte toesteltests**: welke toestellen, wie test | 2 iPhones + 2 Android, jij + 5–8 testers | Fase 3 mogelijk |
| 27 | **Juridisch nalezen**: privacyverklaring, voorwaarden, storeteksten | Ja, vóór indiening | Eenmalige kost (jurist) |

## E. Creators en business
| # | Beslissing | Aanbevolen | Gevolg |
|---|---|---|---|
| 28 | **Creators** pas **na** de eerste lancering | Ja | De lancering wordt niet vertraagd |
| 29 | **B5 betaalprovider** (Stripe Connect voorgesteld; Mollie als alternatief) | Uitstellen tot creators | Geen betaalverkeer, geen fiscale verplichtingen nu |
| 30 | **B3 huishouden** vervangt gezin- en vriendenrechten | Ontwerp behouden, uitvoeren na staging (G1/G2) | Eenvoudiger delen; vraagt een migratie |
| 31 | **BUG-096** teamleden in het Control Center (nu alleen de eigenaar) | Uitstellen tot er echt een team is; dan eerst 0002 en 2FA | — |
| 32 | **Business Control Center**: wat bij de lancering (zie RISICO-EN-KOSTENANALYSE §3) | Alleen echte bronnen: AI-kosten (bestaat), gebruikers, retentie | Geen verzonnen omzet of kasstroom |
| 33 | **Supabase/Lovable-plan** (back-ups, point-in-time recovery) | Back-upbeleid nakijken vóór de lancering | Mogelijk een vaste maandkost |

## F. Overige open punten uit het bugregister (blijven open)
| Bug | Beslissing of actie |
|---|---|
| BUG-012 | AI-foto's als base64 in de cache: opslag in plaats van de databank (na staging) |
| BUG-014 | Dode code `NieuweSuggesties.tsx`: verwijderen pas na akkoord (G7) |
| BUG-035 | Upgrade van de zod-afhankelijkheid (gepland) |
| BUG-086 / 117 | Echte toesteltests en de Safari-engine (fase 3) |
| BUG-087 | Afdelingsvolgorde per huishouden in plaats van per toestel (G1) |
| G6 | Rotatie van geheimen (alleen met bewijs en akkoord) |

## G. Beoordeling van de bewaartermijnen (0003/0003b), geen juridisch advies
| Gegevens | Voorstel | Beoordeling | Aanbevolen |
|---|---|---|---|
| Prullenbak | 30 dagen | Gangbaar, genoeg om vergissingen te herstellen | **30 dagen** |
| Receptversies | Max. 20 per recept | Geen persoonsgegevens buiten het recept; beperkt de groei | **20** |
| Weekmenu | 12 maanden | Volstaat voor seizoensgewoontes; Intelligence kan samenvattingen gebruiken | **12 maanden**, met een anonieme samenvatting per recept ("hoe vaak gekookt") die bij het account blijft |
| Aankoophistoriek | 24 maanden | Voor "vaak gekocht" volstaat 12 maanden | **12 maanden** (strenger) |
| Open uitnodigingen | 30 dagen | Bevat e-mail of naam van een derde: kort houden | **30 dagen** |
| AI-cache | 90 dagen | Kan ingevoerde tekst of links van gebruikers bevatten | **30 dagen** voor invoer van gebruikers, 90 dagen voor algemene resultaten |
| Afgehandelde feedback | 24 maanden | Kan persoonlijke info bevatten | **12 maanden** na afhandeling |
| Telemetrie (0003) | 13 / 6 / 25 maanden | Proportioneel | Behouden |
| Aankopen (zodra er betalingen zijn) | 7 jaar | Belgische boekhoudplicht (laten bevestigen door boekhouder) | Alleen het boekhoudkundige deel |
| Back-ups | Onbekend | Termijn van Lovable Cloud opvragen | Opnemen in het privacybeleid |

**Toestemming en intrekking:**
- dieet, allergieën en mee-eters alleen met een uitdrukkelijk vinkje;
- intrekken = meteen wissen;
- staat in de export;
- wordt gewist bij afmelden (gebouwd).

**Externe diensten:**
- de weerdienst krijgt alleen de gemeente, via de server;
- AI krijgt alleen receptinhoud;
- push-diensten (APNs/FCM) krijgen alleen de meldingstekst, zonder gezondheidsinfo.
