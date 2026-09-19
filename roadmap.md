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

## Actief — volledige A-Z kwaliteitsronde
- [ ] Boodschappenlijst compacter en overzichtelijker maken
- [ ] Alles of alle afgevinkte boodschappen in één keer kunnen verwijderen
- [ ] Bestaande boodschappen snel en duidelijk kunnen aanpassen
- [ ] Kernflows, samenwerking, beheer, PWA en toegankelijkheid volledig testen
- [ ] Veiligheid, prestaties en AI-kosten controleren en noodzakelijke problemen herstellen
- [ ] Tijdelijke testgegevens opruimen en een eindcontrole uitvoeren

## Ideeën voor later
- [ ] Betalingen activeren met een betaalprovider (voorbereiding ligt klaar, staat nu UIT)
- [ ] Passkeys als alternatief voor de authenticator-app
- [ ] Meekijken met een gebruiker (impersonatie) met expliciete toestemming
- [ ] Externe integraties en betaalde abonnementen
- [ ] Native app in App Store / Play Store (nu is PWA-installatie via QR/link voldoende)

## Nog te doen
- [x] Vriendenuitnodigingen: op gsm duidelijk zien naar wie je een uitnodiging stuurde
- [x] Gerechtpagina op gsm volledig responsive (o.a. aantal personen +/-)

## AI-credits & kostenefficiëntie (bezig)
- [x] Creditcentrum in de app + saldo in Instellingen
- [x] Beheerscherm Credits & AI-kosten (prijs, daglimiet, aan/uit, verbruik, cache-trefkans)
- [x] Kostmelding vóór elke slimme actie, geen AI zonder tik van de gebruiker
- [x] Creditmotor: saldo, onveranderlijk grootboek, reservering/afronding/terugstorting
- [x] 50 gratis credits bij registratie, ook voor bestaande gebruikers
- [x] Kosten per AI-functie instelbaar, daglimiet per functie, AI-resultaatcache
- [ ] Kopen van creditpakketten (staat UIT tot betalingen actief zijn)

## Linkimport (klaar)
- [x] Eén importpijplijn met adapters: Instagram, TikTok, YouTube, Facebook, Pinterest, websites
- [x] Volgorde: structured data (JSON-LD Recipe, gratis) → metadata → caption → AI
- [x] Canonieke URL + dubbeldetectie ("dit recept heb je al"), gedeelde cache per bron
- [x] Gedeeltelijke import tonen i.p.v. falen, duidelijk onderscheid import vs AI-voorstel
- [x] Bronvermelding bewaren, veilige URL-controle (geen interne adressen)
- [x] Delen vanuit Instagram/TikTok rechtstreeks naar de app (share target)
- [x] Beheerscherm Importcentrum: statistieken per platform, fouten, credits, cache-trefkans


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


## Slimme meldingen (klaar)
- [x] Vijf soorten: menu van vandaag, weekmenu plannen, maaltijd komt eraan, boodschappen, tijd om te koken
- [x] Instellingen per soort (aan/uit, tijd, dag, hoelang vooraf) + vergrendelscherm-privacy
- [x] Onboardingstap "Blijf op schema" met toestemming pas bij eigen keuze
- [x] Slimme regels: geen melding zonder geplande maaltijd, lege lijst of al geplande week; samenvoegen en dedupe
- [x] Eigen Web Push (VAPID), kwartiertaak in de database, deep links, geen AI-credits
- [x] Control Center → Meldingen: opt-in, aflevering, mislukt, engagement, standaardinstellingen

## Gezin écht samen (klaar)
- [x] Eén gezamenlijk weekmenu en één gezamenlijke gezinslijst per gezin (group_id op meal_plan en shopping_lists)
- [x] Gezinsuitnodigingen op naam/@naam met bericht + push, aannemen/weigeren in app en push
- [x] Uitgenodigde leden met status, "Wacht op antwoord", intrekken door eigenaar
- [x] Live verversing van leden, weekmenu en boodschappen (realtime)
- [x] Weekmenu: schakel "Mijn weekmenu / Weekmenu gezin", wie iets inplande zichtbaar

## Volledig UX-herontwerp (klaar)
- [x] Gedeeld Foodlo-designsysteem en rustige navigatie
- [x] Contextuele Home en visueel receptenoverzicht
- [x] Receptdetail met tabs en vereenvoudigde kookstand
- [x] Rustig weekmenu, boodschappen en voorraad
- [x] Wallet en vrienden/gezin vereenvoudigen
- [x] Meldingen, instellingen en onboarding stroomlijnen
- [x] Toestanden, microcopy, toegankelijkheid en mobiele eindcontrole

## Suggesties + planner-datum (lopend)
- [x] Suggestieblok herbruikbaar met "Zoek opnieuw"; ook op receptenpagina
- [x] Inplannen: tweestapsflow (eerst gerecht, dan dag) gebouwd en getest

## Open
- [x] Controlecentrum-link weer zichtbaar onderaan instellingen

## Actief — weekmenuvoorstel per dag
- [x] Voorstel als rustige dagkaart met één dag tegelijk
- [x] Kooktijd en type direct per dag aanpasbaar
- [x] Alternatief kiezen uit Foodlo, eigen gerecht of nieuw idee
- [x] Accepteren, overslaan en navigeren per dag getest

## Actief — weekmenu en boodschappen verbeteren
- [x] Weeknavigatie met weekbalk en kalender
- [x] Verstreken dagen uitsluiten
- [x] Voorstellen zichtbaar en gevarieerd vernieuwen
- [x] Weekmenu-instellingen in uitklapbare categorieën
- [x] Recept direct en duidelijk aan gekozen boodschappenlijst toevoegen
- [x] Mobiel en desktop gecontroleerd
