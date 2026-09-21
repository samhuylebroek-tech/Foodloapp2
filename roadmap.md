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
- [ ] Volledige mobiele UX/UI-herwerking volgens het goedgekeurde plan van 21 september 2026

## Actief — volledige A-Z kwaliteitsronde
- [x] Boodschappenlijst compacter en overzichtelijker maken
- [x] Alles of alle afgevinkte boodschappen in één keer kunnen verwijderen
- [x] Bestaande boodschappen snel en duidelijk kunnen aanpassen
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

## Eerdere UX-herwerking (klaar)
- [x] Gedeeld Foodlo-designsysteem en rustige navigatie
- [x] Contextuele Home en visueel receptenoverzicht
- [x] Receptdetail met tabs en vereenvoudigde kookstand
- [x] Rustig weekmenu, boodschappen en voorraad
- [x] Wallet en vrienden/gezin vereenvoudigen
- [x] Meldingen, instellingen en onboarding stroomlijnen
- [x] Toestanden, microcopy, toegankelijkheid en mobiele eindcontrole

## Volledige mobiele UX/UI-herwerking (actief)
- [x] Mobiele app-schil met vijf vaste tabs, veilige schermranden en logische terugnavigatie
- [x] Rustige Home en duidelijke Meer-pagina zonder blokkerende installatievraag
- [x] Recepten zoeken, filters, toevoegen/importeren en receptdetail vereenvoudigen
- [x] Weekmenu, boodschappen, voorraad en klantenkaarten stroomlijnen
- [x] Samen koken, meldingen, instellingen en onboarding groeperen via Meer
- [x] Terugknop op elk onderliggend scherm + duidelijke fout- en laadweergave
- [ ] Toegankelijkheid, snelheid, alle routes en belangrijke tikacties eindtesten

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

## Actief — compact mobiel Weekmenu
- [x] Compacte weekkeuze en persoonlijke/gezinsplanning
- [x] Planning als verticale daglijn met foto, maaltijdtype en kooktijd
- [x] Toevoegen, Foodlo kiezen en boodschappen als rustige actierij
- [x] Maaltijdacties gebundeld in één contextmenu
- [ ] Mobiele en desktop-eindcontrole van het vernieuwde Weekmenu

## Actief — weekmenu en boodschappen verbeteren
- [x] Weeknavigatie met weekbalk en kalender
- [x] Verstreken dagen uitsluiten
- [x] Voorstellen zichtbaar en gevarieerd vernieuwen
- [x] Weekmenu-instellingen in uitklapbare categorieën
- [x] Recept direct en duidelijk aan gekozen boodschappenlijst toevoegen
- [x] Mobiel en desktop gecontroleerd

## Actief — foto's en weekmenuvoorstellen
- [x] Foto van gevonden recept mee bewaren bij direct opslaan
- [x] Externe foto naar eigen opslag kopiëren
- [x] Foto tonen in voorbeeldvenster
- [x] Weekmenuvoorstel nooit een gerecht dat al in het weekmenu staat
- [x] AI-zoeken en meer info merkbaar sneller maken
- [x] Controlecentrum: e-mail van de persoon duidelijk tonen
- [x] Controlecentrum: laatste aanmelding per persoon in het overzicht
- [x] Fotoʼs tonen niet goed in het weekmenu

## Actief — boodschappen scherper + weekmenu
- [x] Overzicht per categorie, compacte regels, voortgang
- [x] Snel bewerken, verwijderen met ongedaan maken, meerdere tegelijk
- [x] Winkelmodus (schermvullend)
- [x] Lijst delen via link (account nodig bij openen)
- [ ] Weekmenu doorlopen en herstellen
- [x] Recept uit weekmenu halen: vraag om ingrediënten mee te verwijderen
- [x] Na weekmenu bevestigen: gekozen gerechten in één keer op de boodschappenlijst
- [x] Bij één recept snel labels en details aanpassen
- [x] Recepten filteren: Van mij / Van vrienden + eigenaarsnaam op kaartjes (gerechten.tsx)
