#!/usr/bin/env bash
# Build the pushed main branch into a release ZIP and deploy it to the
# existing Azure App Service. Run from the repo root on a machine signed in to
# git and the Azure CLI:
#
#   bash scripts/release.sh            # build, check, deploy, verify
#   BUILD_ONLY=1 bash scripts/release.sh
#
# It builds in a clean temporary clone (no local .env files), runs type checks
# and unit tests, builds with the submission flags, adds the Linux image
# runtime, writes public/release.json, scans the package for secrets, then
# deploys with `az webapp deploy` and checks the live app. App settings, the
# plan and the model deployment are not changed.
set -euo pipefail

SUB=f5539b65-3db7-428e-a605-e4c0763c1c5d
RG=rg-between-the-lines
APP=between-the-lines-jb-f5539b65
ORIGIN="https://$APP.azurewebsites.net"

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }
sha256() { if command -v shasum >/dev/null; then shasum -a 256 "$1"; else sha256sum "$1"; fi | cut -c1-64; }

step "Checks"
REPO=$(git rev-parse --show-toplevel)
cd "$REPO"
git fetch -q origin
COMMIT=$(git rev-parse origin/main)
[ "$(git rev-parse HEAD)" = "$COMMIT" ] ||
  fail "HEAD isn't origin/main ($COMMIT); push first, then release what's on GitHub"
command -v zip >/dev/null || fail "zip not found"
if [ "${BUILD_ONLY:-0}" != 1 ]; then
  command -v az >/dev/null || fail "Azure CLI (az) not found"
  az account set --subscription "$SUB"
fi
SHORT=${COMMIT:0:7}
OUT="$REPO/artifacts/release-$(date -u +%Y-%m-%d)"
ZIP="$OUT/release-$SHORT.zip"
mkdir -p "$OUT"
echo "Releasing $COMMIT"

step "1/5 Clean clone, type check and unit tests"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
git clone -q "$REPO" "$WORK/src"
cd "$WORK/src"
git checkout -q "$COMMIT"
npx -y npm@11 ci --no-audit --no-fund
# Tests run in their own environment: the submission flags below are for the
# production build only (some tests expect the historical routes enabled).
env -u HISTORICAL_MATCHES_ENABLED -u RECORDED_MATCHES_VISIBLE -u AI_REDIS_URL \
  npm run typecheck
env -u HISTORICAL_MATCHES_ENABLED -u RECORDED_MATCHES_VISIBLE -u AI_REDIS_URL \
  npm test

step "2/5 Production build"
NEXT_PUBLIC_SITE_URL="$ORIGIN" HISTORICAL_MATCHES_ENABLED=false \
  RECORDED_MATCHES_VISIBLE=false npm run build
STANDALONE="$WORK/src/.next/standalone"
[ -f "$STANDALONE/server.js" ] || fail "no standalone server.js"

# App Service runs Linux x64. Next bundles sharp for its image optimizer; give
# the package the Linux runtime at the lockfile's version, whatever the host OS.
# Install it on its own (the standalone package.json lists every dependency)
# and copy only sharp and its @img packages across.
SHARP=$(node -p "require('./package-lock.json').packages['node_modules/sharp'].version")
mkdir -p "$WORK/sharp" && (cd "$WORK/sharp" && echo '{"private":true}' > package.json &&
  npx -y npm@11 install --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc \
    "sharp@$SHARP" >/dev/null)
rm -rf "$STANDALONE/node_modules/sharp" "$STANDALONE/node_modules/@img"
cp -R "$WORK/sharp/node_modules/sharp" "$WORK/sharp/node_modules/@img" \
  "$STANDALONE/node_modules/"
for dep in detect-libc semver; do
  [ -d "$STANDALONE/node_modules/$dep" ] ||
    cp -R "$WORK/sharp/node_modules/$dep" "$STANDALONE/node_modules/"
done
[ -d "$STANDALONE/node_modules/@img/sharp-linux-x64" ] &&
  [ -d "$STANDALONE/node_modules/@img/sharp-libvips-linux-x64" ] ||
  fail "Linux sharp runtime missing from the package"

node -e '
const fs = require("fs");
fs.writeFileSync(process.argv[1], JSON.stringify({
  product: "Between the Lines",
  commit: process.argv[2],
  builtAt: new Date().toISOString(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
}) + "\n");' "$STANDALONE/public/release.json" "$COMMIT"

step "3/5 Package and scan"
rm -f "$ZIP"
(cd "$STANDALONE" && zip -qr "$ZIP" .)
SCAN="$WORK/scan"
mkdir -p "$SCAN" && (cd "$SCAN" && unzip -q "$ZIP")
[ -z "$(find "$SCAN" -name '.env*' -print -quit)" ] || fail ".env file in the package"
grep -rqE 'rediss://[^[:space:]"'\''`]{8,}' "$SCAN" && fail "a Redis URL is in the package"
grep -rqE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' "$SCAN" && fail "a private key is in the package"
# The exact local secret values, if this machine has them; never printed.
if [ -f "$REPO/.env.local" ]; then
  while IFS='=' read -r name value; do
    value=${value%\"}; value=${value#\"}
    case "$name" in *KEY*|*TOKEN*|*SECRET*|*REDIS_URL*) ;; *) continue ;; esac
    [ ${#value} -ge 12 ] || continue
    grep -rqF -- "$value" "$SCAN" && fail "the value of $name is in the package"
  done < <(grep -E '^[A-Z_]+=' "$REPO/.env.local")
fi
echo "Package: $ZIP"
echo "SHA-256: $(sha256 "$ZIP")"

if [ "${BUILD_ONLY:-0}" = 1 ]; then
  echo "BUILD_ONLY=1: not deploying."
  exit 0
fi

step "4/5 Deploy"
cd "$REPO"
read -rp "Deploy $SHORT to $APP? [y/N] " ok
[ "$ok" = y ] || fail "not confirmed"
az webapp deploy -g "$RG" -n "$APP" --src-path "$ZIP" --type zip \
  --clean true --restart true --timeout 600000 --output none

step "5/5 Verify"
live=0
for _ in $(seq 1 60); do
  [[ "$(curl -fsS "$ORIGIN/release.json" 2>/dev/null)" == *"$COMMIT"* ]] && { live=1; break; }
  sleep 5
done
[ "$live" = 1 ] || fail "/release.json doesn't show $COMMIT; redeploy the previous ZIP in artifacts/ to roll back"
# Capture first: `curl | grep -q` fails under pipefail when grep stops early.
[[ "$(curl -fsS "$ORIGIN/")" == *"Between the Lines"* ]] || fail "homepage didn't load"
# The analyst needs a minute after a restart before its controls connect.
ready=0
for _ in $(seq 1 24); do
  [[ "$(curl -fsS "$ORIGIN/api/ask" 2>/dev/null)" == *'"enabled":true'* ]] && { ready=1; break; }
  sleep 5
done
[ "$ready" = 1 ] || fail "the analyst didn't report enabled"
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ORIGIN/api/mcp?t=77:00" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"release","version":"1"}}}')
[ "$status" = 200 ] || fail "MCP initialize returned $status"
echo "Live: $(curl -fsS "$ORIGIN/release.json" | tr -d '\n')"
echo "Ask the live analyst one question in the app to confirm it answers."
