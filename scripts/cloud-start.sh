#!/bin/bash
# Start van een Claude Code-sessie in de cloud (claude.ai/code). Lokaal doet dit script niets.
# - Installeert de afhankelijkheden één keer (en opnieuw als package.json of bun.lock wijzigt).
# - Altijd de exacte versies uit bun.lock (met hun controlesommen). bun.lock verwijst naar
#   Lovable's interne npm-kopie (europe-west*-npm.pkg.dev/lovable-core-prod), die vanuit de cloud
#   niet bereikbaar is. Dan installeren we dezelfde versies via het publieke npm-register, met een
#   tijdelijke kopie van bun.lock; het origineel wordt daarna altijd teruggezet.
# - npm zonder lockfile is alleen nog de laatste noodoplossing: die kiest nieuwere versies dan
#   bun.lock en brak op 2026-11-12 de dev-server (htmlparser2 10 vraagt entities/decode).
# - Playwright gebruikt de Chrome die in de cloud al klaarstaat (CHROME_PATH, zie playwright.config.ts).
# Geen geheimen: de app draait in de cloud alleen tegen de nep-Supabase (zie scripts/demo.mjs).
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud-start.sha256

installeer_via_publiek_register() {
  local reserve
  reserve=$(mktemp) || return 1
  cp bun.lock "$reserve" || return 1
  # Lege URL = standaardregister; versie en controlesom blijven die uit bun.lock.
  sed -i -E 's#"https://[a-z0-9-]+-npm\.pkg\.dev/lovable-core-prod/sandbox-npm-cache/[^"]*"#""#g' bun.lock
  bun install --frozen-lockfile
  local status=$?
  cp "$reserve" bun.lock && rm -f "$reserve"
  return $status
}

if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if bun install --frozen-lockfile || installeer_via_publiek_register; then
    sha256sum scripts/cloud-start.sh package.json bun.lock > "$hashes" || rm -f "$hashes"
  elif npm install --no-package-lock --no-audit --no-fund; then
    echo "cloud-start: LET OP, geïnstalleerd met npm zonder bun.lock; versies kunnen afwijken." >&2
  else
    echo "cloud-start: installeren mislukt; vraag Claude om de fout te tonen." >&2
  fi
  git diff --quiet -- bun.lock 2>/dev/null || echo "cloud-start: bun.lock is gewijzigd; niet vastleggen." >&2
fi
exit 0
