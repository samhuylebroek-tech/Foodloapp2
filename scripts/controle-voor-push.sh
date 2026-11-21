#!/bin/bash
# Controle vóór een push van v2/dev naar GitHub. Leest alleen; pusht nooit zelf.
# Toont bij een vondst alleen bestandsnamen en commits, nooit de waarde.
# Gebruik: bash scripts/controle-voor-push.sh   (exit 0 = veilig om te pushen, na akkoord eigenaar)
set -u
fout=0
meld() { echo "  ✗ $1"; fout=1; }
ok() { echo "  ✓ $1"; }

tak=$(git rev-parse --abbrev-ref HEAD)
# v2/dev of een featurebranch (v2/*, claude/*) met een PR naar v2/dev; main en master nooit (T9).
case "$tak" in
  main | master) meld "branch is '$tak': nooit pushen naar main" ;;
  v2/dev | v2/* | claude/*) ok "branch '$tak' is toegestaan (featurebranch of v2/dev)" ;;
  *) meld "branch '$tak' is onbekend; gebruik v2/dev, v2/<onderwerp> of claude/<onderwerp>" ;;
esac

[ -z "$(git status --porcelain)" ] && ok "geen niet-vastgelegde wijzigingen" || meld "er zijn niet-vastgelegde wijzigingen"

if git rev-parse -q --verify origin/v2/dev >/dev/null; then
  if git merge-base --is-ancestor origin/v2/dev HEAD; then
    ok "gewone vooruitspoeling: $(git rev-list --count origin/v2/dev..HEAD) nieuwe commits, geen force-push nodig"
  else
    meld "origin/v2/dev heeft commits die lokaal ontbreken: eerst samenvoegen, nooit force-pushen"
  fi
  bereik="origin/v2/dev..HEAD"
else
  bereik="HEAD"
fi

if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' >/dev/null; then
  meld ".env-bestand in de repository: $(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | tr '\n' ' ')"
else
  ok "geen .env-bestanden gevolgd"
fi

# Patronen van echte geheimen in de nieuwe commits (de verzonnen testsleutel is toegestaan).
patroon='(eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,})|(sb_secret_[A-Za-z0-9]{8,})|(sk_(live|test)_[A-Za-z0-9]{10,})|(AKIA[0-9A-Z]{16})|(gh[pousr]_[A-Za-z0-9]{30,})|(xox[abpr]-[A-Za-z0-9-]{10,})|(AIza[0-9A-Za-z_-]{30,})|(sk-ant-[A-Za-z0-9_-]{20,})|(sk-[A-Za-z0-9]{40,})|(re_[A-Za-z0-9]{20,}_[A-Za-z0-9]{10,})|(-----BEGIN [A-Z ]*PRIVATE KEY-----)'
treffers=$(git log -p --no-color "$bereik" | grep -E "^\+" | grep -E -o "$patroon" | grep -v -E 'sb_secret_nep_alleen_lokaal' | wc -l | tr -d ' ')
if [ "$treffers" = "0" ]; then
  ok "geen sleutels of geheimen in de nieuwe commits"
else
  meld "$treffers mogelijke geheimen in de nieuwe commits; bestanden:"
  git log --name-only --format='' "$bereik" | sort -u | while read -r f; do
    [ -f "$f" ] && grep -E -q "$patroon" "$f" 2>/dev/null && grep -E -o "$patroon" "$f" | grep -v -q 'sb_secret_nep_alleen_lokaal' && echo "      $f"
  done
fi

groot=$(git log --format='' --name-only "$bereik" | sort -u | while read -r f; do [ -f "$f" ] && [ "$(wc -c <"$f")" -gt 5000000 ] && echo "$f"; done)
[ -z "$groot" ] && ok "geen bestanden groter dan 5 MB" || meld "grote bestanden: $groot"

echo
[ $fout = 0 ] && echo "Klaar om te pushen (alleen na schriftelijk akkoord): git push origin $tak" || echo "Niet pushen: los eerst de punten met ✗ op."
exit $fout
