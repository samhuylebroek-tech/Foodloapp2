# Foodlo als native app (iPhone / iPad / Android)

Foodlo is nu voorbereid als échte native app met Capacitor. De native app is een
volwaardige app-verpakking rond Foodlo: eigen app-icoon, splash screen,
volledig scherm zonder browserbalk, en klaar om in de App Store en Play Store
te zetten.

De native app laadt de live site `https://foodloapp.com`. Voordeel: alles wat je
hier aanpast is meteen zichtbaar in de app, zonder telkens een nieuwe
store-versie in te dienen.

## Eenmalig opzetten (op je eigen computer)

1. Exporteer het project naar GitHub (knop rechtsboven) en haal het binnen:
   `git clone <jouw-repo>` en dan `cd <map>`
2. `npm install`
3. `npm run build`
4. Platformen toevoegen:
   - iPhone/iPad: `npx cap add ios` (vereist een Mac met Xcode)
   - Android: `npx cap add android` (vereist Android Studio)
5. `npx cap sync`

## App openen en testen

- iPhone/iPad: `npx cap open ios` → in Xcode op ▶ klikken
- Android: `npx cap open android` → in Android Studio op ▶ klikken

## Naar de stores

- Apple: Apple Developer-account (± €99/jaar), archiveren in Xcode en uploaden
  naar App Store Connect.
- Google: Play Console-account (± €25 eenmalig), signed bundle uit Android
  Studio uploaden.

## Later: alles in de app zelf bundelen

Wil je dat de app ook zonder internet werkt met eigen ingebouwde bestanden?
Haal dan het `server`-blok uit `capacitor.config.ts` weg en draai opnieuw
`npm run build && npx cap sync`.
