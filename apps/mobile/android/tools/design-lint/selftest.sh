#!/usr/bin/env bash
# Self-test for tools/design-lint.sh (section 7.2). Run it as: tools/design-lint.sh --self-test
#  1. Fixtures: every finding on fixtures/** must be marked "// LINT: <id>..." on its line (ids, then optional text in
#     parentheses), and every marker must
#     be found (must-fail and must-pass in one pass; ui/theme and ui/components fixtures must stay silent).
#  2. Baseline mechanics on a scratch copy: at baseline exit 0; a new Color(0x fails; the baseline refuses to
#     rise without --allow-raise; an allowlist entry clears it; a removed finding is reported as "below";
#     --update-baseline FILE... keeps every other file's rows and still refuses to raise; --allow-raise moves
#     findings between files but the total needs --allow-total-raise.
#  3. --strict: any finding fails; out-of-scope files are skipped. Usage errors (missing option value, missing
#     --root folder, unknown option) exit 2.
#  4. The real tree: exit 0 at its baseline, and exit 1 once a Color(0x... is added to a screen.
set -uo pipefail

LINT="${1:?usage: selftest.sh path/to/design-lint.sh}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_ROOT="$(cd "$HERE/../.." && pwd)"
FIX="$HERE/fixtures"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/design-lint-selftest.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
failures=0
pass() { echo "  ok   $*"; }
fail() { echo "  FAIL $*"; failures=$((failures + 1)); }

expect_exit() { # expected-exit description command...
  local want="$1" what="$2"; shift 2
  local out code
  out="$("$@" 2>&1)"; code=$?
  if [ "$code" = "$want" ]; then pass "$what (exit $code)"; else fail "$what: exit $code, wanted $want"; echo "$out" | sed 's/^/       /'; fi
  LAST_OUT="$out"
}

echo "design-lint self-test"

# ---- 1. fixtures: findings == markers
SRC="$FIX/app/src/main/java/com/thesis/mobile"
expected="$(cd "$SRC" && grep -rn 'LINT:' --include='*.kt' . | sed 's#^\./##' |
  perl -ne 'if (m{^([^:]+):(\d+):.*LINT:\s*([a-z -]+)}) { print "$1:$2: $_\n" for split /\s+/, $3 }' | sort)"
actual="$("$LINT" --root "$FIX" --baseline "$TMP/none.txt" --allow "$FIX/allow.txt" --copy-allow "$FIX/copy-allow.txt" \
  --report | grep -E '^ui/' | sed -E 's/^([^:]+:[0-9]+: [a-z-]+):.*/\1/' | sort)"
if [ "$expected" = "$actual" ]; then
  pass "fixtures: $(echo "$expected" | wc -l | tr -d ' ') marked findings, nothing else (incl. excluded dirs, comments)"
else
  fail "fixtures: findings differ from the LINT markers (< expected, > actual)"
  diff <(echo "$expected") <(echo "$actual") | sed 's/^/       /'
fi
grep -q 'ui/theme/' <<<"$actual" && fail "ui/theme must be excluded" || pass "ui/theme and ui/components are excluded"

# ---- 2. baseline mechanics on a scratch copy of the fixtures
W="$TMP/work"
mkdir -p "$W" && cp -R "$FIX/." "$W/"
ARGS=(--root "$W" --baseline "$W/baseline.txt" --allow "$W/allow.txt" --copy-allow "$W/copy-allow.txt")
expect_exit 0 "update-baseline writes the counts" "$LINT" "${ARGS[@]}" --update-baseline
expect_exit 0 "at baseline" "$LINT" "${ARGS[@]}"
SCREEN="$W/app/src/main/java/com/thesis/mobile/ui/screens/TokenFixture.kt"
echo 'val probe = Color(0xFFABCDEF)' >>"$SCREEN"
expect_exit 1 "a new Color(0x in a screen fails" "$LINT" "${ARGS[@]}"
grep -q 'color-hex: 2 finding(s), baseline 1' <<<"$LAST_OUT" && pass "failure names the file, pattern and counts" \
  || fail "failure message: $LAST_OUT"
expect_exit 1 "update-baseline refuses to raise a count" "$LINT" "${ARGS[@]}" --update-baseline
echo 'screens/TokenFixture.kt:/val probe = Color(0xFFABCDEF)/ color-hex  # self-test' >>"$W/allow.txt"
expect_exit 0 "an allowlist entry (path suffix + substring) clears it" "$LINT" "${ARGS[@]}"
echo 'nonsense line' >>"$W/allow.txt"
expect_exit 2 "a malformed allowlist line is an error" "$LINT" "${ARGS[@]}"
sed -i.bak '$d' "$W/allow.txt"
sed -i.bak '/val f = 16.dp/d' "$SCREEN"
expect_exit 0 "a removed finding passes" "$LINT" "${ARGS[@]}"
grep -q 'below baseline' <<<"$LAST_OUT" && pass "and is reported as below the baseline" || fail "no below-baseline note"
expect_exit 0 "lowering the baseline is allowed" "$LINT" "${ARGS[@]}" --update-baseline
expect_exit 0 "new screens file with no findings passes" bash -c "echo 'val ok = ThesisSpace.l' >'$W/app/src/main/java/com/thesis/mobile/ui/screens/New.kt' && '$LINT' ${ARGS[*]}"
echo 'val bad = 4.dp' >"$W/app/src/main/java/com/thesis/mobile/ui/screens/New.kt"
expect_exit 1 "a new file starts at baseline 0" "$LINT" "${ARGS[@]}"
rm "$W/app/src/main/java/com/thesis/mobile/ui/screens/New.kt"

# ---- 2b. --update-baseline FILE... merges: only the named files' rows change, the rest are kept
cp "$W/baseline.txt" "$TMP/before.txt"
rows_other() { grep -v '^#' "$1" | grep -v '^ui/screens/TokenFixture.kt' | sort; }
expect_exit 0 "update-baseline with a FILE argument" "$LINT" "${ARGS[@]}" --update-baseline "$SCREEN"
if [ "$(rows_other "$TMP/before.txt")" = "$(rows_other "$W/baseline.txt")" ] && [ -n "$(rows_other "$W/baseline.txt")" ]; then
  pass "other files' baseline rows are kept"
else
  fail "update-baseline FILE dropped or changed other files' rows"
  diff "$TMP/before.txt" "$W/baseline.txt" | sed 's/^/       /'
fi
expect_exit 0 "and the full check still passes" "$LINT" "${ARGS[@]}"
echo 'val probe2 = 3.dp' >>"$SCREEN"
expect_exit 1 "update-baseline FILE still refuses to raise" "$LINT" "${ARGS[@]}" --update-baseline "$SCREEN"
sed -i.bak '$d' "$SCREEN"

# ---- 2c. --allow-raise moves findings between files; the total may only rise with --allow-total-raise
MOVED="$W/app/src/main/java/com/thesis/mobile/ui/screens/Moved.kt"
echo 'val moved = 24.dp' >"$MOVED"
sed -i.bak '/val ae = 24.dp/d' "$SCREEN"
expect_exit 1 "a finding moved to a new file needs --allow-raise" "$LINT" "${ARGS[@]}" --update-baseline
expect_exit 0 "--allow-raise accepts the move (total unchanged)" "$LINT" "${ARGS[@]}" --update-baseline --allow-raise
echo 'val extra = 9.dp' >>"$MOVED"
expect_exit 1 "--allow-raise still refuses a higher total" "$LINT" "${ARGS[@]}" --update-baseline --allow-raise
expect_exit 0 "--allow-total-raise accepts it" "$LINT" "${ARGS[@]}" --update-baseline --allow-total-raise
rm "$MOVED"
expect_exit 0 "a deleted file's rows leave the baseline on a full update" "$LINT" "${ARGS[@]}" --update-baseline
grep -q 'Moved.kt' "$W/baseline.txt" && fail "Moved.kt rows kept after the file was deleted" || pass "and are gone"

# ---- 3. strict
expect_exit 1 "--strict fails on any finding" "$LINT" "${ARGS[@]}" --strict \
  "$W/app/src/main/java/com/thesis/mobile/ui/shell/ShellFixture.kt"
expect_exit 0 "--strict skips out-of-scope files" "$LINT" "${ARGS[@]}" --strict --quiet \
  "$W/app/src/main/java/com/thesis/mobile/ui/theme/ExcludedTheme.kt"
expect_exit 2 "--strict on a missing file is an error" "$LINT" "${ARGS[@]}" --strict "$W/nope.kt"

# ---- 3b. usage errors are exit 2, never 1 (1 means findings)
expect_exit 2 "an option without its value is a usage error" "$LINT" --baseline
expect_exit 2 "--root without a value is a usage error" "$LINT" --root
expect_exit 2 "--root on a missing folder is a usage error" "$LINT" --root "$TMP/no-such-folder"
expect_exit 2 "an unknown option is a usage error" "$LINT" --bogus

# ---- 4. the real tree
expect_exit 0 "the real tree is at its baseline" "$LINT" --root "$REAL_ROOT" --quiet
R="$TMP/real"
mkdir -p "$R/app/src/main/java/com/thesis/mobile" "$R/tools"
cp -R "$REAL_ROOT/app/src/main/java/com/thesis/mobile/ui" "$R/app/src/main/java/com/thesis/mobile/"
cp "$REAL_ROOT"/tools/design-lint-*.txt "$R/tools/"
HOME_SCREEN="$R/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt"
if [ -f "$HOME_SCREEN" ]; then
  echo 'private val lintProbe = androidx.compose.ui.graphics.Color(0xFF123456)' >>"$HOME_SCREEN"
  expect_exit 1 "adding Color(0x to HomeScreen.kt fails against the real baseline" "$LINT" --root "$R"
else
  fail "ui/screens/HomeScreen.kt not found in the real tree"
fi

if [ "$failures" -eq 0 ]; then echo "design-lint self-test: all checks passed"; exit 0; fi
echo "design-lint self-test: $failures check(s) failed"; exit 1
