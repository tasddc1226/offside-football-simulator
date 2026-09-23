#!/bin/bash
# usage: docs/tracking/scripts/redispatch.sh <TASK_ID> <message>   — 기존 워크트리에 새 워커 터미널을 띄우고 메시지를 보낸다(워커 TUI가 멈췄을 때)
set -euo pipefail
export PATH=/Users/suyoung/.nvm/versions/node/v22.23.1/bin:$PATH
S=${ORCH_STATE_DIR:-$HOME/.offside-orch}; mkdir -p "$S"
REPO=id:41200e35-ac29-475d-8c7f-6cd38f9bc9e1
T=$1; MSG=$2
WT=$(cat $S/$T.dir)
OLD=$(cat $S/$T.handle 2>/dev/null || true)
if [ -n "$OLD" ]; then orca terminal close --terminal "$OLD" --json >/dev/null 2>&1 && echo "closed old terminal $OLD" || echo "old terminal close failed/absent"; fi
orca terminal create --worktree "$REPO::$WT" --title "$T worker (2)" --command 'claude --model claude-sonnet-5' --json > $S/$T.term2.json
H=$(python3 -c "import json,sys; d=json.load(open('$S/$T.term2.json')); r=d.get('result',d); print((r.get('terminal') or r).get('handle'))")
echo "$H" > $S/$T.handle; echo "handle=$H"
for i in $(seq 1 40); do
  sleep 3
  if orca terminal read --terminal "$H" --json | grep -Eq 'Sonnet 5|auto mode|shift\+tab'; then echo "ready after $((i*3))s"; break; fi
done
orca terminal send --terminal "$H" --text "$MSG" --json >/dev/null; sleep 1
orca terminal send --terminal "$H" --text $'\r' --json >/dev/null
grep -qx "$T" $S/active.txt || echo "$T" >> $S/active.txt
echo "redispatched $T -> $WT"
