#!/bin/bash
# Start van een Claude Code-sessie in de cloud (claude.ai/code). Lokaal doet dit script niets.
# - Installeert de afhankelijkheden één keer (en opnieuw als package.json of bun.lock wijzigt).
# - Bun werkt soms niet achter de cloudproxy; dan valt het terug op npm (zonder lockfile weg te
#   schrijven, zodat Lovable's bun.lock ongemoeid blijft).
# - Playwright gebruikt de Chrome die in de cloud al klaarstaat (CHROME_PATH, zie playwright.config.ts).
# Geen geheimen: de app draait in de cloud alleen tegen de nep-Supabase (zie scripts/demo.mjs).
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if bun install --frozen-lockfile || npm install --no-package-lock --no-audit --no-fund; then
    sha256sum scripts/cloud-start.sh package.json bun.lock > "$hashes" || rm -f "$hashes"
  else
    echo "cloud-start: installeren mislukt; vraag Claude om 'npm install' te draaien en de fout te tonen." >&2
  fi
fi
exit 0
