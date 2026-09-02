#!/bin/bash
# usage: docs/tracking/scripts/dispatch.sh <TASK_ID> <worktree-name-suffix>   e.g. dispatch.sh T-1-011 sync-wiring
# 상태 파일(<T>.handle, <T>.dir, active.txt)은 ORCH_STATE_DIR(기본 ~/.offside-orch)에 둔다.
set -euo pipefail
export PATH=/Users/suyoung/.nvm/versions/node/v22.23.1/bin:$PATH
S=${ORCH_STATE_DIR:-$HOME/.offside-orch}; mkdir -p "$S"
REPO=id:41200e35-ac29-475d-8c7f-6cd38f9bc9e1
T=$1; NAME="$1-$2"
echo "== worktree create $NAME"
orca worktree create --repo $REPO --name "$NAME" --base-branch origin/main --no-parent --json > $S/$T.wt.json
WT=$(python3 - "$S/$T.wt.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
def find(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k=='path' and isinstance(v,str) and '/workspaces/' in v: return v
            r=find(v)
            if r: return r
    if isinstance(o,list):
        for v in o:
            r=find(v)
            if r: return r
print(find(d) or '')
PY
)
[ -n "$WT" ] || { echo "no worktree path"; cat $S/$T.wt.json; exit 1; }
echo "path=$WT"
echo "== terminal create"
orca terminal create --worktree "$REPO::$WT" --title "$T worker" --command 'claude --model claude-sonnet-5' --json > $S/$T.term.json
H=$(python3 -c "import json,sys; d=json.load(open('$S/$T.term.json')); r=d.get('result',d); print((r.get('terminal') or r).get('handle'))")
echo "$H" > $S/$T.handle; echo "$WT" > $S/$T.dir; echo "handle=$H"
for i in $(seq 1 40); do
  sleep 3
  if orca terminal read --terminal "$H" --json | grep -Eq 'Sonnet 5|auto mode|shift\+tab'; then echo "ready after $((i*3))s"; break; fi
done
MSG="docs/tracking/briefs/$T.md 를 읽고 그 브리프대로 작업해 줘. 브리프 밖의 작업은 하지 않는다. 시작 전에 docs/tracking/README.md 와 docs/tracking/worker-brief-template.md 의 규칙(리뷰·PR·lockfile)을 확인한다."
orca terminal send --terminal "$H" --text "$MSG" --json >/dev/null; sleep 1
orca terminal send --terminal "$H" --text $'\r' --json >/dev/null
grep -qx "$T" $S/active.txt || echo "$T" >> $S/active.txt
echo "dispatched $T -> $WT"
