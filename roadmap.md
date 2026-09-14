# Shared Kitchen roadmap

## Klaar
- [x] Stijlvernieuwing: sage & slate kleuren, strakkere kaarten, Inter font, nieuw logo
- [x] Control Center: rollen & rechten, beveiligde toegang, auditlogboek, dashboard,
      gebruikers, recepten, inhoud/labels, AI & import, support, systeem, instellingen, beheerders
- [x] 2-staps verificatie (authenticator) voor beheerders + verplichting per beheerder
- [x] Sessie-, IP- en apparaatlogging van beheerders
- [x] Snelheidslimiet op beheeracties
- [x] Alleen-lezen supportmodus met duidelijke banner
- [x] Analytics: actieve gebruikers, populaire functies en schermen
- [x] Teksten (CMS) en aankondigingen die medewerkers zelf beheren, met infopagina in de app

- [x] Beveiligingslinter schoon: admin_rate_limits dichtgezet, hulpfuncties afgeschermd voor anoniem
- [x] Foodlo volledig als mobiele app ingericht (PWA, iconen, installatiepagina, QR, mobiel tabmenu)
- [x] Voorbereiding betalen: limiet gratis gerechten + pakketten, beheerinstellingen,
      limietcontrole bij nieuw recept, pakkettenoverzicht in instellingen (nog niet actief)

## Bezig
- [ ] Eigen domeinnaam kopen en koppelen (naam: Foodlo) — wacht tot de rest klaar is

## Ideeën voor later
- [ ] Betalingen activeren met een betaalprovider (voorbereiding ligt klaar, staat nu UIT)
- [ ] Passkeys als alternatief voor de authenticator-app
- [ ] Meekijken met een gebruiker (impersonatie) met expliciete toestemming
- [ ] Externe integraties en betaalde abonnementen
- [ ] Native app in App Store / Play Store (nu is PWA-installatie via QR/link voldoende)

## Nog te doen
- [ ] Vriendenuitnodigingen: op gsm duidelijk zien naar wie je een uitnodiging stuurde
- [ ] Gerechtpagina op gsm volledig responsive (o.a. aantal personen +/-)

## AI-credits & kostenefficiëntie (bezig)
- [x] Creditmotor: saldo, onveranderlijk grootboek, reservering/afronding/terugstorting
- [x] 50 gratis credits bij registratie, ook voor bestaande gebruikers
- [x] Kosten per AI-functie instelbaar, daglimiet per functie, AI-resultaatcache
- [ ] Creditcentrum in de app + saldo zichtbaar bij AI-acties
- [ ] Beheerscherm credits: saldo's, verbruik, kosten, cache-trefkans
- [ ] Kopen van creditpakketten (staat UIT tot betalingen actief zijn)

## Linkimport verbeteren (nog te doen)
- [ ] Eén importpijplijn met adapters: Instagram, TikTok, YouTube, Facebook, Pinterest, websites
- [ ] Volgorde: structured data (JSON-LD Recipe) → metadata → caption → transcript → OCR → AI
- [ ] Canonieke URL + dubbeldetectie ("dit recept heb je al"), gedeelde cache per bron
- [ ] Gedeeltelijke import tonen i.p.v. falen, duidelijk onderscheid import vs AI-voorstel
- [ ] Bronvermelding bewaren, veilige URL-controle (geen interne adressen)
- [ ] Delen vanuit Instagram/TikTok rechtstreeks naar de app (share target)
- [ ] Beheerscherm: importstatistieken per platform, fouten, cache-trefkans


## Weekmenu (klaar)
- Reeds ingepland moment (bv. avondeten) verdwijnt uit de knoppen van die dag
- Instellingen: kies welke maaltijdmomenten je per dag ziet (ontbijt/middageten/avondeten of 1 blok)
- Zelf gerecht toevoegen: keuze "gewoon tekst" of "met AI", daarna controlevenster met bevestigen (knop onderaan + vinkje rechtsboven)
- Gerechten verwijderen via swipe naar links + bevestigingspop-up
- Receptenlijst volledig gsm-leesbaar maken (tekst mag niet afgekapt/onleesbaar zijn)
- Boodschappenlijstjes gemakkelijk verwijderen
- Recept van vriend met 1 knop naar eigen gerechten kopiëren
- Volledig ingeplande dag in het weekmenu ingekleurd tonen
- SSO: geen enkele lovable-verwijzing zichtbaar bij aanmelden
