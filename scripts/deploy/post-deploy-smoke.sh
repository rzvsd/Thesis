#!/usr/bin/env bash
set -euo pipefail

product_api_base_url="${PRODUCT_API_BASE_URL:-http://localhost:3001}"
smoke_email="${SMOKE_EMAIL:-}"
smoke_password="${SMOKE_PASSWORD:-}"
internal_worker_token="${INTERNAL_WORKER_TOKEN:-}"
register_user="${SMOKE_REGISTER_USER:-false}"
python_bin="${PYTHON_BIN:-}"

fail() {
  echo "post-deploy smoke failed: $*" >&2
  exit 1
}

require_non_dev_secret() {
  local name="$1"
  local value="$2"
  local dev_default="$3"

  if [ -z "$value" ]; then
    fail "$name is required"
  fi

  if [ "$value" = "$dev_default" ]; then
    fail "$name must not use the local development default"
  fi
}

json_field() {
  local field="$1"
  FIELD="$field" "$python_bin" -c '
import json
import os
import sys

field = os.environ["FIELD"]
payload = json.load(sys.stdin)
value = payload.get(field)
if not isinstance(value, str) or not value:
    raise SystemExit(f"missing JSON string field: {field}")
print(value)
'
}

json_status() {
  "$python_bin" -c '
import json
import sys

payload = json.load(sys.stdin)
status = payload.get("status")
if not isinstance(status, str) or not status:
    raise SystemExit("missing JSON string field: status")
print(status)
'
}

require_non_dev_secret "SMOKE_EMAIL" "$smoke_email" "dev@example.com"
require_non_dev_secret "SMOKE_PASSWORD" "$smoke_password" "dev-password"
require_non_dev_secret \
  "INTERNAL_WORKER_TOKEN" \
  "$internal_worker_token" \
  "dev-internal-worker-token"

if [ -z "$python_bin" ]; then
  if command -v python3 >/dev/null 2>&1; then
    python_bin="python3"
  elif command -v python >/dev/null 2>&1; then
    python_bin="python"
  else
    fail "python3 or python is required for JSON handling"
  fi
fi

curl -fsS "$product_api_base_url/health" >/dev/null

if [ "$register_user" = "true" ]; then
  register_payload="$(
    SMOKE_EMAIL="$smoke_email" SMOKE_PASSWORD="$smoke_password" "$python_bin" - <<'PY'
import json
import os

print(json.dumps({
    "email": os.environ["SMOKE_EMAIL"],
    "password": os.environ["SMOKE_PASSWORD"],
}))
PY
  )"
  register_response="$(
    curl -fsS \
      -X POST "$product_api_base_url/auth/register" \
      -H "content-type: application/json" \
      --data "$register_payload"
  )"
  verification_token="$(printf '%s' "$register_response" | json_field "verification_token")"
  verify_payload="$(
    VERIFICATION_TOKEN="$verification_token" "$python_bin" - <<'PY'
import json
import os

print(json.dumps({"token": os.environ["VERIFICATION_TOKEN"]}))
PY
  )"
  verify_response="$(
    curl -fsS \
      -X POST "$product_api_base_url/auth/verify" \
      -H "content-type: application/json" \
      --data "$verify_payload"
  )"
  verify_status="$(printf '%s' "$verify_response" | json_status)"
  if [ "$verify_status" != "verified" ]; then
    fail "auth verification did not return verified"
  fi
fi

login_payload="$(
  SMOKE_EMAIL="$smoke_email" SMOKE_PASSWORD="$smoke_password" "$python_bin" - <<'PY'
import json
import os

print(json.dumps({
    "email": os.environ["SMOKE_EMAIL"],
    "password": os.environ["SMOKE_PASSWORD"],
}))
PY
)"
login_response="$(
  curl -fsS \
    -X POST "$product_api_base_url/auth/login" \
    -H "content-type: application/json" \
    --data "$login_payload"
)"
access_token="$(printf '%s' "$login_response" | json_field "access_token")"

curl -fsS \
  -H "authorization: Bearer $access_token" \
  "$product_api_base_url/v1/user/profile" >/dev/null

internal_payload="$(
  "$python_bin" - <<'PY'
import json
from datetime import date

print(json.dumps({
    "as_of": date.today().isoformat(),
    "dry_run": True,
}))
PY
)"
internal_response="$(
  curl -fsS \
    -X POST "$product_api_base_url/internal/research-state/refresh" \
    -H "content-type: application/json" \
    -H "x-internal-token: $internal_worker_token" \
    --data "$internal_payload"
)"
internal_status="$(printf '%s' "$internal_response" | json_status)"
if [ "$internal_status" != "ok" ]; then
  fail "internal research-state smoke did not return ok"
fi

echo "post-deploy smoke passed"
