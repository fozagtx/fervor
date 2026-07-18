#!/usr/bin/env bash
# End-to-end smoke check against the public MVP.
set -euo pipefail
BASE="${1:-https://fervor.up.railway.app}"

fail=0
check() {
  local path="$1" expect="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}${path}" || echo 000)
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $code  $path"
  else
    echo "FAIL $code (want $expect)  $path"
    fail=1
  fi
}

echo "Smoke → $BASE"
check "/"
check "/matches"
check "/feed"
check "/leaders"
check "/api/matches"
check "/manifest.webmanifest"

FID=$(curl -s --max-time 20 "$BASE/api/matches" | python3 -c "import json,sys;d=json.load(sys.stdin);ms=d.get('matches') or [];print(ms[0]['fixtureId'] if ms else '')" 2>/dev/null || true)
if [[ -n "${FID:-}" ]]; then
  check "/match/${FID}"
  check "/embed/${FID}"
  check "/watch/${FID}"
  check "/api/verify/${FID}"
else
  echo "FAIL no fixtures from /api/matches"
  fail=1
fi

# SSE must emit an init event (read a chunk without SIGPIPE flaking set -e)
sse=$(curl -sN --max-time 5 "$BASE/api/stream" 2>/dev/null | dd bs=512 count=1 2>/dev/null || true)
if echo "$sse" | grep -q '"type":"init"'; then
  echo "OK  SSE  /api/stream (init)"
else
  echo "FAIL SSE  /api/stream"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Smoke FAILED"
  exit 1
fi
echo "Smoke PASSED"
