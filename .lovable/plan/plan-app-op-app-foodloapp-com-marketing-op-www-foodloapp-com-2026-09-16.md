# Plan: app op app.foodloapp.com, marketing op www.foodloapp.com

## Doel
- **App (dit project / PWA)** → `https://app.foodloapp.com`
- **Marketingwebsite (apart Lovable-project)** → `https://www.foodloapp.com`
- De app blijft gewoon werken op `foodloapp.com` tijdens de overstap; niets gaat offline.

## Stappen

### 1. Subdomein app.foodloapp.com koppelen aan dit project
- foodloapp.com is via Lovable gekocht, dus de DNS-records worden automatisch geschreven zodra je de koppel-kaart bevestigt (ik toon die kaart na goedkeuring van dit plan).
- Daarna verloopt verificatie en SSL automatisch (kan tot 72 uur duren, meestal sneller).

### 2. www.foodloapp.com loskoppelen van dit project
- Dit doe je zelf: **Project Settings → Domains → www.foodloapp.com → verwijderen** (ik kan domeinen niet zelf verwijderen).
- Daarna koppel je www.foodloapp.com in het **marketingproject** (Project Settings → Domains → Connect Domain). Omdat het domein via Lovable is gekocht, staan de DNS-records in hetzelfde beheer — Lovable begeleidt je daar bij het verbinden.
- `foodloapp.com` (zonder www) blijft bij deze app verbonden en redirect mee naar het primaire adres.

### 3. Primair domein instellen
- Zodra app.foodloapp.com actief is, zetten we **app.foodloapp.com als primair domein** van dit project, zodat foodloapp.com automatisch naar de app-subdomein redirect.
- Tot die tijd blijft foodloapp.com primair, zodat de app bereikbaar blijft.

### 4. App-URL's bijwerken (omgevingsvariabelen)
- `VITE_FOODLO_APP_URL` → `https://app.foodloapp.com` (wordt o.a. gebruikt in e-mails, deel-links en push-notificatie-dieplinks).
- `VITE_FOODLO_MARKETING_URL` → `https://www.foodloapp.com` (links naar de website in Instellingen).
- Daarna opnieuw **publiceren**, want deze instellingen zitten in de gebouwde app.

### 5. Controleren
- app.foodloapp.com serveert de app (ook dieplinks zoals /recepten/...).
- foodloapp.com redirect naar app.foodloapp.com.
- PWA-installeer- en push-links verwijzen naar het nieuwe adres.

## Randgevallen
- Tijdens de DNS-overgang blijft de app op foodloapp.com werken.
- Bestaande uitgeklede QR-codes/links naar foodloapp.com blijven werken via de redirect.
- E-mailinfrastructuur (notify.foodloapp.com) blijft onveranderd.

## Wat ik van jou nodig heb
1. Goedkeuring van dit plan (dan toon ik de koppel-kaart voor app.foodloapp.com).
2. Het verwijderen van www.foodloapp.com uit dit project en het verbinden ervan in het marketingproject (via de Domains-pagina).
