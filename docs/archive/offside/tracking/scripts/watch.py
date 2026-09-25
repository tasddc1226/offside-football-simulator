import sys, json, re, subprocess, time, os
# 워커 터미널 감시. 상태 파일은 ORCH_STATE_DIR(기본 ~/.offside-orch). 45초마다 active.txt의 태스크 화면을 읽어
# RESULT(HEAD 변경·PR URL) / DIALOG / ERROR / IDLE-LONG 이벤트를 stdout에 한 줄씩 낸다.
S = os.environ.get("ORCH_STATE_DIR") or os.path.expanduser("~/.offside-orch")
os.environ["PATH"] = os.path.expanduser("~/.nvm/versions/node/v22.23.1/bin:") + os.environ["PATH"]
# BUSY는 스피너 줄만 본다: '✳ Musing… (12m 25s · …)', '⏺ Reading 1 file, running 2 shell commands…', 'esc to interrupt'.
# 예전 단어 목록(Running·Working·Thinking…)은 워커의 산문("Running the single allowed /review:pr")에 오탐해
# 2026-09-03 새벽 T-1-012 질문 대화상자와 T-1-009 완료 보고를 7시간 놓쳤다.
BUSY = re.compile(r'\S+… \(\d|…\s*$|esc to interrupt', re.M)
DIALOG = re.compile(r'AskUserQuestion|Do you want to|❯ 1\.|Yes, and|Esc to cancel')
DONE = re.compile(r'수정 완료|github\.com/\S+/pull/\d+')
ERR = re.compile(r'API Error|Connection lost|rate limit|usage limit')
DIR = {}
BASE = os.path.expanduser("~/orca/workspaces/offside-football-simulator/")
def wdir(t):
    if t in DIR: return BASE+DIR[t]
    try: return open(f"{S}/{t}.dir").read().strip()
    except Exception: return BASE+t
def head(t):
    r = subprocess.run(["git","-C",wdir(t),"rev-parse","--short","HEAD"],capture_output=True,text=True); return r.stdout.strip() or "?"
def screen(t):
    try: h = open(f"{S}/{t}.handle").read().strip()
    except Exception: return None
    r = subprocess.run(["orca","terminal","read","--terminal",h,"--screen","--json"],capture_output=True,text=True)
    try:
        d = json.loads(r.stdout); return [l for l in d["result"]["terminal"]["tail"] if l.strip()]
    except Exception: return None
idle = {}; emitted = {}; start = {}
while True:
    try: active = [l.strip() for l in open(f"{S}/active.txt") if l.strip()]
    except Exception: active = []
    for t in active:
        if t not in start: start[t] = head(t); idle[t] = 0; emitted[t] = ""
        sc = screen(t)
        if sc is None: continue
        txt = "\n".join(sc); busy = len(BUSY.findall(txt)); hd = head(t); dn = len(DONE.findall(txt))
        idle[t] = idle[t]+1 if busy == 0 else 0
        key = ""
        if idle[t] >= 2 and (hd != start[t] or dn): key = f"RESULT:{hd}:{dn}"
        elif idle[t] >= 2 and DIALOG.search(txt): key = f"DIALOG:{hd}"
        elif idle[t] >= 2 and ERR.search(txt): key = f"ERROR:{hd}"
        elif idle[t] >= 8: key = f"IDLE-LONG:{hd}:{idle[t]//8}"
        if key and key != emitted[t]:
            emitted[t] = key
            last = [l for l in sc if not l.startswith("────") and "Limit" not in l and "Context" not in l][-6:]
            print(f"{t} {key} | " + " ¦ ".join(l.strip()[:120] for l in last), flush=True)
        if key == "" and busy > 0: emitted[t] = ""
    time.sleep(45)
