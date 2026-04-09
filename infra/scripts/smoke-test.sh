#!/usr/bin/env bash
# ─── iF Fleet Staging Smoke Test ────────────────────────────────────────────
# Usage: bash infra/scripts/smoke-test.sh [API_BASE_URL]
# Example: bash infra/scripts/smoke-test.sh https://staging-fleet-api.internal/api/v1

set -euo pipefail

API="${1:-http://localhost:3001/api/v1}"
PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"

  actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$actual" = "$expected_status" ]; then
    echo "  ✓ $label ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected $expected_status, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "iF Fleet Smoke Tests → $API"
echo "────────────────────────────────────"

echo "[ Health ]"
check "API health endpoint" "$API/health"

echo ""
echo "[ Auth ]"
check "Request OTP — rejects non-company email (400)" \
  "$API/auth/request-otp" 400 || true
# POST with bad email
actual=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"notacompanyemail@gmail.com"}')
if [ "$actual" = "400" ]; then
  echo "  ✓ Request OTP rejects non-company email (400)"
  PASS=$((PASS + 1))
else
  echo "  ✗ Request OTP domain validation — expected 400, got $actual"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "[ Protected endpoints — unauthenticated should 401 ]"
check "GET /bookings (unauthenticated → 401)"      "$API/bookings" 401
check "GET /admin/fleet/vehicles (unauth → 401)"   "$API/admin/fleet/vehicles" 401
check "GET /notifications (unauth → 401)"          "$API/notifications" 401

echo ""
echo "────────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "SMOKE TEST FAILED — $FAIL check(s) did not pass"
  exit 1
else
  echo "All smoke tests passed."
  exit 0
fi
