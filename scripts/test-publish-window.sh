#!/usr/bin/env bash
# ============================================================
#  THE PUBLISHING WINDOW, EVERY HOUR OF THE DAY
#
#  .github/workflows/refresh.yml decides whether a run may publish by
#  comparing the CLOCK, not the schedule it was supposed to keep -- GitHub
#  starts these jobs two to five hours late, so the schedule cannot carry
#  the rule. The rule: a scheduled run publishes only from 10:00 to 22:59
#  UTC, and a manual run always publishes.
#
#  THIS EXISTS BECAUSE THE OBVIOUS VERSION FAILS AT EXACTLY 08 AND 09.
#  `date -u +%H` returns "08", and bash arithmetic -- `(( h < 10 ))` or
#  `[[ "$h" -lt 10 ]]` -- reads a leading zero as octal, errors, and takes
#  the ELSE branch without tripping `set -e`. The two hours the gate was
#  added for are the two it would have waved through, silently, publishing
#  a morning's European releases a day late. The `case` below compares
#  text and cannot have that fault -- and this asserts it for all 24.
#
#  Run: bash scripts/test-publish-window.sh
# ============================================================

# THE GATE, copied from the workflow. If the two ever disagree this test is
# worthless, so the shape is kept deliberately identical and small.
gate() {
  hour="$1"
  event="$2"
  go=true
  if [ "$event" = "schedule" ]; then
    case "$hour" in
      0[0-9]|23) go=false ;;
    esac
  fi
  echo "$go"
}

failures=0
check() {
  if [ "$2" = "$3" ]; then
    echo "PASS  $1"
  else
    echo "FAIL  $1 — got $2, expected $3"
    failures=$((failures + 1))
  fi
}

# Every hour of the day, scheduled. 00-09 and 23 stop; 10-22 publish.
for h in 00 01 02 03 04 05 06 07 08 09; do
  check "scheduled at ${h}:43 does not publish" "$(gate "$h" schedule)" "false"
done
for h in 10 11 12 13 14 15 16 17 18 19 20 21 22; do
  check "scheduled at ${h}:43 publishes" "$(gate "$h" schedule)" "true"
done
check "scheduled at 23:43 does not publish (it would stamp tomorrow)" "$(gate 23 schedule)" "false"

# THE TWO THAT THE ARITHMETIC VERSION GOT WRONG. Named separately so a
# regression reads as itself rather than as one of twenty-four.
check "08 is not read as octal" "$(gate 08 schedule)" "false"
check "09 is not read as octal" "$(gate 09 schedule)" "false"

# A person pressing the button is never gated -- that button exists to fix
# a day that went wrong, at whatever hour it went wrong.
check "a manual run publishes at 03:00" "$(gate 03 workflow_dispatch)" "true"
check "a manual run publishes at 23:00" "$(gate 23 workflow_dispatch)" "true"
check "a manual run publishes at 14:00" "$(gate 14 workflow_dispatch)" "true"

# THE COPY ABOVE MUST STILL BE THE WORKFLOW'S RULE. A test of a copy that
# has drifted from the thing it copies is worse than no test: it passes
# while the real gate does whatever it now does. So the two lines that
# carry the whole decision are asserted to exist, verbatim, in the file
# that runs them.
WF=".github/workflows/refresh.yml"
grep -qF '0[0-9]|23) go=false ;;' "$WF" \
  && check "the workflow still uses the text comparison" "found" "found" \
  || check "the workflow still uses the text comparison" "MISSING from $WF" "found"
grep -qF 'if [ "${{ github.event_name }}" = "schedule" ]; then' "$WF" \
  && check "the workflow still exempts a manual run" "found" "found" \
  || check "the workflow still exempts a manual run" "MISSING from $WF" "found"

# The hour the workflow actually produces, whatever it is right now, must
# be one of the two answers and nothing else.
now=$(date -u +%H)
now_go=$(gate "$now" schedule)
case "$now_go" in
  true|false) echo "PASS  the current hour ($now) resolves to $now_go" ;;
  *) echo "FAIL  the current hour ($now) resolved to '$now_go'"; failures=$((failures + 1)) ;;
esac

if [ "$failures" -eq 0 ]; then
  echo ""
  echo "All publishing-window checks passed."
  exit 0
fi
echo ""
echo "$failures check(s) failed."
exit 1
