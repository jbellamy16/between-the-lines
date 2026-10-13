#!/usr/bin/env bash
# One-time release of Ask the Analyst to the existing Azure app.
# Run on your Mac from the repo root, signed in to git and the Azure CLI:
#
#   bash scripts/release-analyst.sh
#
# It pushes the branch, opens a PR, raises the Foundry rate limit, deploys the
# verified ZIP, checks it, then turns the analyst on and asks it one live
# question. The paid B1 plan is opt-in for judging week:
#
#   UPGRADE_PLAN=1 bash scripts/release-analyst.sh It prompts once for your
# Upstash Redis URL (input hidden; never printed or written to disk).
set -euo pipefail

SUB=f5539b65-3db7-428e-a605-e4c0763c1c5d
RG=rg-between-the-lines
APP=between-the-lines-jb-f5539b65
ORIGIN="https://$APP.azurewebsites.net"
FOUNDRY_RG=rg-josh-5843
FOUNDRY_ACCOUNT=josh-5098-resource
FOUNDRY_DEPLOYMENT=between-the-lines-gpt54-mini
RELEASE_COMMIT=3d97289458d3b32c6d9d6a43f31a1e8a5329b2be
ZIP=artifacts/release-2026-10-13/release-3d97289.zip
ZIP_SHA=d26cac8eeedeb85b21e6ff1ad00085fea35c24f892af4f11a6f54ed31e84becf
ROLLBACK_ZIP=artifacts/release-2026-10-12/azure-release-10cd0aa6.zip
TARGET_TPM=150 # thousands of tokens per minute

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }

step "Checks"
[ "$(git rev-parse --abbrev-ref HEAD)" = "claude/ask-the-analyst" ] ||
  fail "check out claude/ask-the-analyst first"
git merge-base --is-ancestor "$RELEASE_COMMIT" HEAD ||
  fail "this branch doesn't contain the release commit"
[ -f "$ZIP" ] || fail "missing $ZIP"
echo "$ZIP_SHA  $ZIP" | shasum -a 256 -c - >/dev/null || fail "ZIP checksum mismatch"
command -v az >/dev/null || fail "Azure CLI (az) not found"
az account set --subscription "$SUB"
echo "Azure subscription: $(az account show --query name -o tsv)"
echo "Release ZIP verified."

step "1/7 Push the branch and open a PR"
git push -u origin claude/ask-the-analyst
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh pr view claude/ask-the-analyst >/dev/null 2>&1 ||
    gh pr create --base main --head claude/ask-the-analyst \
      --title "Ask the Analyst: grounded Foundry agent for viewer questions" \
      --body "Adds Ask the Analyst (Foundry tool-calling agent + deterministic grounding check), a dollar ledger on every provider call, product-first README and submission docs. Live Foundry eval: 18/18. See docs/ANALYST.md."
  gh pr view claude/ask-the-analyst --json url -q .url
else
  echo "Open the PR here: https://github.com/jbellamy16/second-look/compare/main...claude/ask-the-analyst?expand=1"
fi

step "2/7 Redis for shared limits and the spend ledger"
read -rsp "Paste your Upstash Redis URL (starts with rediss://): " REDIS_URL
echo
[[ "$REDIS_URL" == rediss://* ]] || fail "the URL must start with rediss://"

step "3/7 Raise the Foundry rate limit to ${TARGET_TPM}k tokens/minute"
TPM=30000
RPM=30
if az cognitiveservices account deployment create \
  -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT" --deployment-name "$FOUNDRY_DEPLOYMENT" \
  --model-name gpt-5.4-mini --model-version 2026-03-17 --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity "$TARGET_TPM" --output none; then
  TPM=$((TARGET_TPM * 1000))
  RPM=$TARGET_TPM
  echo "Deployment limit is now ${TARGET_TPM}k TPM (billing is per token; no extra cost)."
else
  echo "Couldn't raise it (quota?). Keeping 30k TPM; the app will pace to match."
fi

if [ "${UPGRADE_PLAN:-0}" = 1 ]; then
  step "4/7 Move the plan to B1 and turn on Always On"
  PLAN_ID=$(az webapp show -g "$RG" -n "$APP" --query appServicePlanId -o tsv)
  PLAN=${PLAN_ID##*/}
  # `az appservice plan update --sku` crashes on some CLI versions (2.89), so
  # patch the plan's SKU through the management API instead.
  az rest --method patch --output none \
    --url "https://management.azure.com${PLAN_ID}?api-version=2023-12-01" \
    --body '{"sku":{"name":"B1","tier":"Basic","size":"B1","family":"B","capacity":1}}'
  for _ in $(seq 1 24); do
    [ "$(az appservice plan show --ids "$PLAN_ID" --query sku.name -o tsv)" = "B1" ] && break
    sleep 5
  done
  [ "$(az appservice plan show --ids "$PLAN_ID" --query sku.name -o tsv)" = "B1" ] ||
    fail "plan didn't switch to B1"

  az webapp config set -g "$RG" -n "$APP" --always-on true --output none
  echo "Plan $PLAN is B1 with Always On (about \$13/month; move back to F1 after Nov 10)."

else
  step "4/7 Plan upgrade skipped (staying on free F1; run with UPGRADE_PLAN=1 for judging week)"
fi

step "5/7 Deploy the release (analyst still off)"
az webapp deploy -g "$RG" -n "$APP" --src-path "$ZIP" --type zip \
  --clean true --restart true --timeout 600000 --output none

step "6/7 Verify the release"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS "$ORIGIN/release.json" | grep -q "$RELEASE_COMMIT"; then ok=1; break; fi
  sleep 5
done
if [ "$ok" != 1 ]; then
  echo "To roll back:"
  echo "  az webapp deploy -g $RG -n $APP --src-path $ROLLBACK_ZIP --type zip --clean true --restart true"
  fail "/release.json doesn't show the new commit"
fi
curl -fsS -o /dev/null "$ORIGIN/" || fail "homepage didn't load"
echo "Live: $(curl -fsS "$ORIGIN/release.json" | tr -d '\n')"

step "7/7 Turn on the analyst"
az webapp config appsettings set -g "$RG" -n "$APP" --output none --settings \
  AI_ENABLED=true AI_PROVIDER=foundry AI_REDIS_URL="$REDIS_URL" \
  AI_SPEND_LEDGER=production AI_SPEND_CEILING_USD=15 \
  AI_MINUTE_LIMIT=10 AI_HOURLY_LIMIT=300 AI_DAILY_LIMIT=500 AI_TOTAL_LIMIT=5000 \
  AI_TOKEN_MINUTE_LIMIT="$TPM" AI_REQUEST_MINUTE_LIMIT="$RPM" \
  AI_PROACTIVE_ENABLED=false AI_INVESTIGATOR_ENABLED=false \
  HISTORICAL_MATCHES_ENABLED=false RECORDED_MATCHES_VISIBLE=false
unset REDIS_URL
enabled=0
for _ in $(seq 1 36); do
  if curl -fsS "$ORIGIN/api/ask" | grep -q '"enabled":true'; then enabled=1; break; fi
  sleep 5
done
[ "$enabled" = 1 ] || fail "the analyst didn't report enabled; check the App Service log stream"
echo "Analyst enabled. Asking one live question…"
curl -fsS -N -X POST "$ORIGIN/api/ask" \
  -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d '{"scenario":"pressure","profile":"demo","time":3804,"question":"What changed in the last ten minutes?","style":"fan"}' |
  while IFS= read -r line; do
    command -v python3 >/dev/null || { printf '%s\n' "$line"; continue; }
    printf '%s\n' "$line" | python3 -c 'import json,sys
d=json.loads(sys.stdin.read())
if d["type"]=="step": print("  -", d["step"]["label"])
else:
  r=d["result"]; print("\n  status:", r["status"]); print("  answer:", r["answer"] or r["notice"])'
  done

step "Done"
echo "Open $ORIGIN and try Ask the analyst. Spend so far: npm run ai:spend (needs AI_REDIS_URL in your shell)."
