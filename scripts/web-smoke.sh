#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8070}"
MANAGER_LOGIN="${MANAGER_LOGIN:-gerente@ajust.local}"
MANAGER_PASSWORD="${MANAGER_PASSWORD:-Gerente@123}"
ANALYST_LOGIN="${ANALYST_LOGIN:-analista@ajust.local}"
ANALYST_PASSWORD="${ANALYST_PASSWORD:-Analista@123}"
CLIENT_LOGIN="${CLIENT_LOGIN:-00.000.000/0001-00}"
CLIENT_PASSWORD="${CLIENT_PASSWORD:-0100}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "[web-smoke] FAIL: $*" >&2
  exit 1
}

assert_code() {
  local got="$1"
  local expected="$2"
  local label="$3"
  if [[ "$got" != "$expected" ]]; then
    fail "$label (expected $expected, got $got)"
  fi
}

fetch_page() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl -s -o "$out" -w '%{http_code}' "${BASE_URL}${path}")"
  echo "$code"
}

fetch_authed_page() {
  local cookie_file="$1"
  local path="$2"
  local out="$3"
  local code
  code="$(curl -s -b "$cookie_file" -o "$out" -w '%{http_code}' "${BASE_URL}${path}")"
  echo "$code"
}

check_assets() {
  local html_file="$1"
  python3 - "$html_file" "$BASE_URL" <<'PY'
import re
import sys
import urllib.request

html_path = sys.argv[1]
base_url = sys.argv[2]
html = open(html_path, 'r', encoding='utf-8', errors='ignore').read()
assets = re.findall(r'(?:src|href)="([^"]*?_next/static[^"]+)"', html)
if not assets:
    print('[web-smoke] no _next/static assets found')
    sys.exit(1)
for asset in assets[:8]:
    url = base_url + asset
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        code = resp.getcode()
    if code != 200:
        print(f'[web-smoke] asset {asset} -> {code}')
        sys.exit(1)
print(f'[web-smoke] assets ok ({min(len(assets),8)} checked)')
PY
}

login_and_check() {
  local identifier="$1"
  local password="$2"
  local expected_role="$3"
  local cookie_file="$4"

  local body_file="$TMP_DIR/login_body.json"
  local resp_file="$TMP_DIR/login_resp.json"

  cat > "$body_file" <<JSON
{"identifier":"${identifier}","password":"${password}"}
JSON

  local code
  code="$(curl -s -c "$cookie_file" -H 'Content-Type: application/json' -d @"$body_file" -o "$resp_file" -w '%{http_code}' "${BASE_URL}/api/auth/login")"
  assert_code "$code" "200" "POST /api/auth/login"

  python3 - "$resp_file" "$expected_role" <<'PY'
import json,sys
payload=json.load(open(sys.argv[1], 'r', encoding='utf-8'))
role=sys.argv[2]
if not payload.get('ok'):
    print('[web-smoke] login payload missing ok=true')
    raise SystemExit(1)
if role and payload.get('user',{}).get('role') != role:
    print('[web-smoke] login role mismatch', payload.get('user',{}).get('role'), role)
    raise SystemExit(1)
PY

  local me_file="$TMP_DIR/me_resp.json"
  code="$(curl -s -b "$cookie_file" -o "$me_file" -w '%{http_code}' "${BASE_URL}/api/auth/me")"
  assert_code "$code" "200" "GET /api/auth/me"
}

# Public login page
LOGIN_HTML="$TMP_DIR/login.html"
code="$(fetch_page '/login' "$LOGIN_HTML")"
assert_code "$code" "200" "GET /login"
check_assets "$LOGIN_HTML"

# Protected route should redirect unauthenticated users
code="$(curl -s -o "$TMP_DIR/ger_unauth.html" -w '%{http_code}' "${BASE_URL}/gerencia")"
assert_code "$code" "307" "GET /gerencia unauthenticated"

# Manager flow
MANAGER_COOKIE="$TMP_DIR/manager.cookie"
login_and_check "$MANAGER_LOGIN" "$MANAGER_PASSWORD" "gerente" "$MANAGER_COOKIE"
MANAGER_HTML="$TMP_DIR/gerencia.html"
code="$(fetch_authed_page "$MANAGER_COOKIE" '/gerencia' "$MANAGER_HTML")"
assert_code "$code" "200" "GET /gerencia authenticated"
check_assets "$MANAGER_HTML"

# Analyst flow
ANALYST_COOKIE="$TMP_DIR/analyst.cookie"
login_and_check "$ANALYST_LOGIN" "$ANALYST_PASSWORD" "analista" "$ANALYST_COOKIE"
ANALYST_HTML="$TMP_DIR/analista.html"
code="$(fetch_authed_page "$ANALYST_COOKIE" '/analista' "$ANALYST_HTML")"
assert_code "$code" "200" "GET /analista authenticated"
check_assets "$ANALYST_HTML"

# Client flow (CNPJ first access)
CLIENT_COOKIE="$TMP_DIR/client.cookie"
login_and_check "$CLIENT_LOGIN" "$CLIENT_PASSWORD" "cliente" "$CLIENT_COOKIE"
CLIENT_HTML="$TMP_DIR/cliente.html"
code="$(fetch_authed_page "$CLIENT_COOKIE" '/cliente' "$CLIENT_HTML")"
assert_code "$code" "200" "GET /cliente authenticated"
check_assets "$CLIENT_HTML"

# Logout flow
code="$(curl -s -b "$MANAGER_COOKIE" -o "$TMP_DIR/logout_resp.json" -w '%{http_code}' -X POST "${BASE_URL}/api/auth/logout")"
assert_code "$code" "200" "POST /api/auth/logout"

echo "[web-smoke] OK"
