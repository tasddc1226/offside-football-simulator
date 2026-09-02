#!/usr/bin/env python3
"""docs/tracking/board.md + git log -> dashboard.html (OFFSIDE 개발 현황)."""
import re, json, subprocess, datetime, html, os, sys
# 저장소 사본: docs/tracking/dashboard/build-dashboard.py (ROOT = 저장소 루트). 출력은 DASHBOARD_OUT 환경 변수,
# 없으면 이 파일 옆 dashboard.html(.gitignore 대상). 오케스트레이터가 머지·투입 때마다 실행해 아티팩트로 재게시한다.
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("DASHBOARD_ROOT") or (
    os.path.abspath(os.path.join(_HERE, "..", "..", "..")) if os.path.basename(_HERE) == "dashboard" else "/Users/suyoung/orca/workspaces/offside-football-simulator/main-2"
)
OUT = os.environ.get("DASHBOARD_OUT") or os.path.join(_HERE, "dashboard.html")
GH = "https://github.com/tasddc1226/offside-football-simulator"

board = open(f"{ROOT}/docs/tracking/board.md", encoding="utf-8").read()

def section(title):
    m = re.search(r"^## " + re.escape(title) + r".*?$(.*?)(?=^## |\Z)", board, re.M | re.S)
    return m.group(1) if m else ""

def table_rows(text):
    rows = []
    for line in text.splitlines():
        if line.startswith("|") and not re.match(r"^\|\s*-", line) and not re.match(r"^\|\s*ID", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            rows.append(cells)
    return rows

def md_inline(s):
    """markdown links/code -> html (escape the rest)."""
    out = ""; i = 0
    pat = re.compile(r"\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|PR #(\d+)")
    for m in pat.finditer(s):
        out += html.escape(s[i:m.start()])
        if m.group(1):
            href = m.group(2)
            if not href.startswith("http"):
                href = f"{GH}/blob/main/docs/tracking/{href}"
            out += f'<a href="{html.escape(href)}" target="_blank" rel="noopener">{html.escape(m.group(1))}</a>'
        elif m.group(3):
            out += f"<code>{html.escape(m.group(3))}</code>"
        else:
            n = m.group(4)
            out += f'<a href="{GH}/pull/{n}" target="_blank" rel="noopener">PR #{n}</a>'
        i = m.end()
    return out + html.escape(s[i:])

gate = re.sub(r"\*\*(.*?)\*\*", r"\1", section("현재 게이트").strip())
gate = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", gate)

phase0 = [dict(id=r[0], task=r[1], ref=r[2], status=r[3], note=r[4]) for r in table_rows(section("Phase 0 백로그")) if len(r) >= 5]
phase1 = [dict(id=r[0], pkg=r[1], task=r[2], deps=r[3], wave=r[4], status=r[5], note=r[6] if len(r) > 6 else "") for r in table_rows(section("Phase 1 백로그")) if len(r) >= 6]
active = [dict(id=r[0], worker=r[1], start=r[2], status=r[3]) for r in table_rows(section("진행 중")) if len(r) >= 4 and r[0] != "(없음)"]
uacts = [dict(id=r[0], task=r[1], status=r[2], note=r[3]) for r in table_rows(section("사용자 액션")) if len(r) >= 4]

log = subprocess.run(["git", "-C", ROOT, "log", "origin/main", "--format=%h|%ci|%s", "-n", "80"], capture_output=True, text=True).stdout
merges = []
for line in log.splitlines():
    h, ts, subj = line.split("|", 2)
    if re.match(r"^T-\d-\d{3}:", subj):
        m = re.search(r"\(#(\d+)\)$", subj)
        merges.append(dict(sha=h, time=ts[11:16], date=ts[:10], task=subj.split(":")[0], title=re.sub(r"\s*\(#\d+\)$", "", subj.split(":", 1)[1]).strip(), pr=m.group(1) if m else None))

now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
updated = now.strftime("%Y-%m-%d %H:%M KST")

STATUS = {
    "done": ("완료", "done"), "completed": ("완료", "done"), "in-progress": ("진행 중", "active"),
    "todo": ("예정", "todo"), "blocked": ("대기", "blocked"), "deferred": ("보류", "todo"),
}
def pill(status):
    label, cls = STATUS.get(status, (status, "todo"))
    return f'<span class="pill {cls}">{label}</span>'

def counts(rows):
    c = dict(done=0, active=0, todo=0, blocked=0)
    for r in rows:
        c[STATUS.get(r["status"], ("", "todo"))[1]] += 1
    return c

c0, c1 = counts(phase0), counts(phase1)

# --- 손으로 유지하는 데이터 ---
SCREENS = [
    ("SCR-034", "온보딩", "구현", "3장, 건너뛰기·KICKOFF (T-1-007)"),
    ("SCR-001", "허브(홈)", "구현", "카드·이어하기·삭제 2단계·새 커리어 (T-1-007)"),
    ("SCR-002", "선수 만들기 1단계", "구현", "T-1-008"),
    ("SCR-003", "선수 만들기 2단계", "구현", "T-1-008"),
    ("SCR-004", "확정·복구 코드 발급", "구현", "T-1-008"),
    ("SCR-007", "진로 선택", "구현", "T-1-009"),
    ("SCR-008", "입단 테스트", "구현", "T-1-009"),
    ("SCR-013·014", "범용 이벤트·결과 카드", "구현", "T-1-009"),
    ("SCR-009", "제안 비교", "구현", "T-1-009"),
    ("SCR-010", "계약 확정", "구현", "T-1-009"),
    ("SCR-029", "대시보드(5탭·다음 결정 카드)", "구현", "T-1-009"),
    ("SCR-030", "설정·데이터(복구·삭제)", "부분", "테마·모션·글자 크기·기본 모드·버전 (T-1-007), 동기화 행 (T-1-011). 데이터 섹션은 T-1-012 진행 중"),
    ("법적 문서", "개인정보·약관", "부분", "라우트만. 본문은 T-1-012"),
]
LAYERS = [
    ("domain", "결정론 시뮬레이터", ["시드 RNG·canonical hash·golden fixture", "CREATE_CAREER·RESOLVE_EVENT·ADVANCE", "효과 5종·태그·지연 효과", "선수 모델·Base OVR 59·DRAFT→확정·이벤트 제시 (T-1-001)", "제안 생성·계약 확정, golden 첫 계약까지 (T-1-005)"], []),
    ("content", "이벤트·룰셋 데이터", ["프로토타입 팩 0.1.0(이벤트 10개)", "조건 DSL·효과 스키마·검증 CLI", "룰셋 1.0.0(아키타입 24·배경 3·팀 8·제안·계약 규칙)", "조건 컨텍스트·적격 이벤트 선택기·브라우저 팩 로더 (T-1-015)"], []),
    ("contracts", "API·명령 스키마(Zod)", ["요청·응답 봉투·오류 코드·프로필 설정", "커리어 동기화 GET/PUT·Snapshot 봉투", "Phase 1 명령 payload 판별 유니온·CareerState·PlayerPublic(잠재력 비노출)·복구·삭제 스키마 (T-1-006)"], ["api 복구·삭제 라우트의 contracts 스키마 채택 (T-1-012)"]),
    ("engine-client", "브라우저 실행기", ["명령 실행기·멱등성·Snapshot 복구", "Web Worker 시뮬레이터", "동기화 클라이언트(재시도·409 처리)", "룰셋 배선 (T-1-001)", "포크(fork-by-replay)·Worker 실패 처리 (T-1-011)"], ["서버 커리어 가져오기 (T-1-012)"]),
    ("platform", "저장소 추상화", ["Dexie(IndexedDB) LocalStore", "KV LocalStore(토스 채널용 스텁)"], []),
    ("api", "Cloudflare Workers + D1", ["D1 스키마·migration", "세션(쿠키·Bearer)·익명 프로필·설정", "커리어 동기화 GET/PUT·If-Match·멱등", "복구 코드·프로필 복구·삭제·로그아웃·커리어 삭제 (T-1-004)"], ["Google 로그인 (T-1-013, U-003 대기)"]),
    ("web · ui", "React 화면", ["라우터·디자인 토큰·허브 빈 상태", "Pretendard 동적 서브셋(2109KB→269KB)", "Button·Card 등 기본 부품", "Radix RadioGroup·Dialog·Tabs, ChoiceCard·CompareCards 등 부품 10종", "Playwright + axe E2E, 브라우저 Worker 해시 검증 (T-1-010)", "엔진 배선(Worker·IndexedDB)·허브·온보딩·설정 영속화 (T-1-007)", "선수 만들기 SCR-002~004·복구 코드 발급·API 클라이언트 (T-1-008)", "동기화 배선·저장 배지·충돌 대화상자·오프라인 (T-1-011)", "진로·입단 테스트·이벤트·결과·제안·계약·대시보드 화면, first-contract e2e (T-1-009)"], ["설정 데이터 섹션·법적 문서 (T-1-012)", "선수 성별·선호 포지션 (T-1-016)", "E2E 완료 조건 표·5분 세션 측정 (T-1-014)"]),
    ("CI · 배포", "GitHub Actions · Pages · Workers", [], ["U-002 Cloudflare 계정 대기 (T-0-010)"]),
]
ETA = [
    ("9/2 20:50", "Wave 1·2 전부 머지(도메인 제안·계약, 이벤트 선택기, contracts 스키마). 웹 엔진 배선(T-1-007) 진행 중"),
    ("9/2 22:05", "웹 엔진 배선 머지: 온보딩→커리어 생성→허브 카드가 브라우저에서 동작. 선수 만들기(T-1-008)·진로~계약·대시보드(T-1-009) 동시 투입"),
    ("9/2 23:42", "선수 만들기(T-1-008) 머지: 이름·포지션·스타일 → KICKOFF → 복구 코드까지 브라우저에서 동작. 동기화 배선(T-1-011) 투입"),
    ("9/3 01:55", "동기화 배선(T-1-011) 머지: 저장 배지·충돌 해소·오프라인·실브라우저 CORS 수정. 설정 데이터 섹션(T-1-012) 투입"),
    ("9/3 08:57", "진로~계약·대시보드(T-1-009) 머지: 온보딩부터 첫 계약·대시보드까지 브라우저에서 동작(e2e 전 구간 3.4~5.5초). 선수 성별·선호 포지션(T-1-016) 투입"),
    ("9/3 오전~오후", "설정·복구·삭제·법적 문서(T-1-012) PR 리뷰·머지, 성별·선호 포지션(T-1-016) → Google 연결(T-1-013)·E2E 완료 조건(T-1-014) 투입"),
    ("9/3 오후~저녁", "Phase 1 종료(T-1-013·014 머지) 목표 → Phase 2 Wave 1(시즌 구조·12스텝) 투입"),
]
DECISIONS = [
    ("Phase 순서 준수", "Phase 0을 닫은 뒤 Phase 1 워커 투입. 브리프는 미리 작성."),
    ("머지 위임", "리뷰 통과 시 오케스트레이터가 바로 squash 머지."),
    ("Phase 1 설계 결정 D-1~D-18", "포지션 8종·아키타입 24·배경 3·Base OVR golden 59·복구 코드 형식·이벤트 제시 방식."),
    ("동기화 충돌·설정 데이터 D-19·D-20", "'이 기기 진행 유지'는 명령 로그를 새 커리어로 재실행(fork-by-replay). 복구 뒤 서버 목록으로 로컬 대조. 복구 코드 다시 보기는 없음(해시만 저장)."),
    ("Google 연결·완료 판정 D-21·D-22", "arctic + 가짜 OIDC로 U-003 전에도 E2E. 완료 조건 13행 표, 5분 세션은 자동화 시간으로 판정, LCP·CLS는 기록만."),
    ("브리프 15개 전부 작성", "투입 순서: T-1-007 → 008·009 → 011 → 012 → 013·014."),
    ("PR #25 리뷰: 복구 코드 발급 400", "apiFetch가 body 없는 POST에 Content-Type을 안 붙여 서버 bodyGuard가 거부. 워커의 '일시적 400' 설명을 재현으로 반박하고 수정 후 머지."),
    ("Phase 3 이후 병렬화 D-32", "Phase 2까지 순차. 공유 계약(Effect·시장가치·태그) 확정 뒤 Phase 3·4 병렬, 그 위에 5·6 병렬. Phase 2 계획 T-2-001~014 초안."),
    ("PR #26 리뷰: 실패 표시·아키타입 한글명·중복 정리", "진행·다음의 실패를 조용히 삼키던 곳 2군데를 ErrorState로, 룰셋 이중 파싱·능력치 라벨 3중 정의를 통합. 재검증에서 e2e 타입 오류·시드 의존 플레이키 추가 수정."),
    ("PR #30 리뷰: 저장 배지·401 삭제·CORS", "새로고침 뒤 '아직 저장 안 됨' 오표시를 로컬 레코드로 보정, 세션 없는 삭제는 큐에 유지, X-Request-Id preflight 허용(범위 확장). 워커의 대체 typecheck 명령 보고는 재검증에서 되돌려 보냄."),
    ("콘텐츠 정본 PR #24", "사용자가 docs/content/kickoff/ 6종을 머지. SHIPPABLE 전에는 개발 작업을 만들지 않는다(Phase 2 입력)."),
    ("룰셋은 데이터", "packages/content/rulesets/1.0.0, 도메인은 입력으로 받고 해시에는 넣지 않음."),
]

def esc(s): return html.escape(s)

def render():
    p = []
    a = p.append
    a(f"""<title>OFFSIDE 개발 현황판</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{{
  --bg:#F7F6F1;--surface:#FFFFFF;--surface-2:#EEECE4;--border:#D6D3C9;--text:#141A17;--text-2:#4F5A54;
  --accent:#F5C400;--on-accent:#0B1410;--line:#0E7C8A;--success:#1E7B45;--warning:#8A5A00;--danger:#B3261E;
  --pill-done-bg:#DCEFE3;--pill-active-bg:#FFF3B8;--pill-todo-bg:#EEECE4;--pill-blocked-bg:#F6DEDC;
  --font:'Pretendard Variable',Pretendard,'Noto Sans KR',-apple-system,'Apple SD Gothic Neo',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{
  --bg:#0B1410;--surface:#121C17;--surface-2:#1A2620;--border:#2A3A32;--text:#EDEFEA;--text-2:#A6B0AA;
  --line:#3FB8C6;--success:#5CC080;--warning:#E0A93A;--danger:#EF7A72;
  --pill-done-bg:#173A27;--pill-active-bg:#4A3B00;--pill-todo-bg:#1A2620;--pill-blocked-bg:#4A1F1C;
}}}}
:root[data-theme="dark"]{{
  --bg:#0B1410;--surface:#121C17;--surface-2:#1A2620;--border:#2A3A32;--text:#EDEFEA;--text-2:#A6B0AA;
  --line:#3FB8C6;--success:#5CC080;--warning:#E0A93A;--danger:#EF7A72;
  --pill-done-bg:#173A27;--pill-active-bg:#4A3B00;--pill-todo-bg:#1A2620;--pill-blocked-bg:#4A1F1C;
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}}
a{{color:var(--line);text-decoration:none;border-bottom:1px solid transparent}}
a:hover,a:focus-visible{{border-bottom-color:currentColor;outline:none}}
:focus-visible{{outline:2px solid var(--line);outline-offset:2px}}
code{{font-family:var(--mono);font-size:.86em;background:var(--surface-2);padding:1px 5px;border-radius:3px}}
.wrap{{max-width:1180px;margin:0 auto;padding:28px 20px 60px}}
header{{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:3px solid var(--line)}}
.wordmark{{font-weight:900;letter-spacing:.12em;font-size:13px;color:var(--text-2);margin:0 0 6px}}
h1{{font-size:28px;line-height:1.2;margin:0;font-weight:800;text-wrap:balance}}
.meta{{font-family:var(--mono);font-size:12.5px;color:var(--text-2);text-align:right}}
.meta strong{{color:var(--text);font-weight:500}}
.gate{{margin:18px 0 0;padding:14px 18px;background:var(--surface-2);border-left:4px solid var(--accent);font-size:14.5px;max-width:80ch}}
h2{{font-size:17px;margin:0 0 12px;font-weight:700;display:flex;align-items:baseline;gap:10px}}
h2 small{{font-family:var(--mono);font-weight:400;font-size:12px;color:var(--text-2);letter-spacing:.04em}}
section{{margin-top:34px}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:22px}}
.tile{{background:var(--surface);border:1px solid var(--border);padding:16px 18px 14px}}
.tile .label{{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2);font-weight:500}}
.tile .num{{font-size:34px;line-height:1.1;font-weight:800;font-variant-numeric:tabular-nums;margin-top:6px}}
.tile .num small{{font-size:15px;font-weight:500;color:var(--text-2);margin-left:4px}}
.tile .sub{{font-size:12.5px;color:var(--text-2);margin-top:6px}}
.bar{{position:relative;height:10px;background:var(--surface-2);border:1px solid var(--border);margin-top:10px;overflow:hidden}}
.bar > i{{display:block;position:absolute;top:0;bottom:0;left:0}}
.bar .d{{background:var(--success)}}
.bar .a{{background:var(--accent)}}
.bar .b{{background:var(--danger);opacity:.6}}
.legend{{display:flex;gap:14px;font-size:12px;color:var(--text-2);margin-top:6px;flex-wrap:wrap}}
.legend i{{display:inline-block;width:10px;height:10px;vertical-align:-1px;margin-right:5px}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:28px}}
@media (max-width:820px){{.cols{{grid-template-columns:1fr}}}}
table{{width:100%;border-collapse:collapse;font-size:14px}}
th{{text-align:left;font-size:12px;letter-spacing:.05em;color:var(--text-2);font-weight:500;padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap}}
td{{padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}}
tr:last-child td{{border-bottom:0}}
.tid{{font-family:var(--mono);font-size:12.5px;white-space:nowrap;color:var(--text)}}
.tscroll{{overflow-x:auto;background:var(--surface);border:1px solid var(--border)}}
.pill{{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap;line-height:1.5}}
.pill.done{{background:var(--pill-done-bg);color:var(--success)}}
.pill.active{{background:var(--pill-active-bg);color:var(--warning)}}
.pill.todo{{background:var(--pill-todo-bg);color:var(--text-2)}}
.pill.blocked{{background:var(--pill-blocked-bg);color:var(--danger)}}
.pill.part{{background:var(--pill-active-bg);color:var(--warning)}}
.workers{{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}}
.worker{{background:var(--surface);border:1px solid var(--border);border-top:4px solid var(--accent);padding:14px 16px}}
.worker .tid{{font-size:13px;font-weight:500}}
.worker .pkg{{font-family:var(--mono);font-size:12px;color:var(--line);margin-left:8px}}
.worker p{{margin:6px 0 0;font-size:13.5px;color:var(--text)}}
.worker .st{{margin-top:8px;font-size:12.5px;color:var(--text-2)}}
.timeline{{list-style:none;margin:0;padding:0;border-left:2px solid var(--border);margin-left:6px}}
.timeline li{{position:relative;padding:0 0 12px 18px;font-size:13.5px}}
.timeline li::before{{content:"";position:absolute;left:-7px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--success);border:2px solid var(--bg)}}
.timeline .t{{font-family:var(--mono);font-size:12px;color:var(--text-2);margin-right:8px}}
.timeline .k{{font-family:var(--mono);font-size:12px;color:var(--line);margin-right:6px}}
.layers{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}}
.layer{{background:var(--surface);border:1px solid var(--border);padding:14px 16px}}
.layer h3{{margin:0;font-size:14px;font-weight:700}}
.layer h3 span{{font-family:var(--mono);font-weight:400;font-size:12px;color:var(--text-2);margin-left:8px}}
.layer ul{{margin:8px 0 0;padding-left:18px;font-size:13.5px}}
.layer li{{margin:2px 0}}
.layer .todo-list li{{color:var(--text-2)}}
.layer .cap{{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2);margin-top:10px;font-weight:500}}
.wave{{font-family:var(--mono);font-size:12px;color:var(--text-2)}}
.waverow td{{background:var(--surface-2);font-weight:600;font-size:13px;padding:6px 10px}}
.eta td:first-child{{white-space:nowrap;font-weight:600;width:1%}}
.dec{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}}
.dec div{{background:var(--surface);border:1px solid var(--border);padding:12px 14px;font-size:13.5px}}
.dec b{{display:block;margin-bottom:4px}}
footer{{margin-top:44px;font-size:12.5px;color:var(--text-2);border-top:1px solid var(--border);padding-top:14px}}
@media (prefers-reduced-motion:no-preference){{.bar>i{{transition:width .4s ease}}}}
</style>
<div class="wrap">
<header>
  <div>
    <p class="wordmark">OFFSIDE · 축구 커리어 시뮬레이터</p>
    <h1>개발 현황판</h1>
  </div>
  <div class="meta">갱신 <strong>{esc(updated)}</strong><br>정본 <a href="{GH}/blob/main/docs/tracking/board.md" target="_blank" rel="noopener">docs/tracking/board.md</a> · <a href="{GH}/pulls?q=is%3Apr" target="_blank" rel="noopener">PR 목록</a></div>
</header>
<p class="gate">{esc(gate)}</p>
""")
    # tiles
    total0 = len(phase0); total1 = len(phase1)
    prs_today = [m for m in merges if m["date"] == now.strftime("%Y-%m-%d")]
    def bar(c, total):
        d = c["done"] / total * 100 if total else 0; ac = c["active"] / total * 100 if total else 0; b = c["blocked"] / total * 100 if total else 0
        return f'<div class="bar"><i class="d" style="width:{d:.1f}%"></i><i class="a" style="left:{d:.1f}%;width:{ac:.1f}%"></i><i class="b" style="left:{d+ac:.1f}%;width:{b:.1f}%"></i></div>'
    a('<div class="tiles">')
    a(f'<div class="tile"><div class="label">Phase 0 · 기반</div><div class="num">{c0["done"]}<small>/ {total0} 완료</small></div>{bar(c0,total0)}<div class="sub">{c0["blocked"]}건 사용자 액션 대기(U-002)</div></div>')
    a(f'<div class="tile"><div class="label">Phase 1 · 첫 계약까지</div><div class="num">{c1["done"]}<small>/ {total1} 완료</small></div>{bar(c1,total1)}<div class="sub">{c1["active"]}건 진행 중 · {c1["todo"]}건 예정</div></div>')
    a(f'<div class="tile"><div class="label">지금 도는 워커</div><div class="num">{len(active)}<small>명</small></div><div class="sub">Sonnet 5 · Orca 워크트리 · 최대 4명 병렬</div></div>')
    a(f'<div class="tile"><div class="label">오늘 머지된 PR</div><div class="num">{len(prs_today)}<small>건</small></div><div class="sub">첫 머지 {prs_today[-1]["time"] if prs_today else "-"} · 최근 {prs_today[0]["time"] if prs_today else "-"}</div></div>')
    a('</div><div class="legend"><span><i style="background:var(--success)"></i>완료</span><span><i style="background:var(--accent)"></i>진행 중</span><span><i style="background:var(--danger);opacity:.6"></i>사용자 액션 대기</span><span><i style="background:var(--surface-2);border:1px solid var(--border)"></i>예정</span></div>')

    # workers + timeline
    a('<div class="cols"><section><h2>지금 돌고 있는 워커 <small>docs/tracking/board.md · 진행 중</small></h2>')
    if active:
        a('<div class="workers">')
        p1 = {r["id"]: r for r in phase1}
        for w in active:
            r = p1.get(w["id"], {})
            a(f'<div class="worker"><span class="tid">{esc(w["id"])}</span><span class="pkg">{esc(r.get("pkg",""))}</span><p>{esc(r.get("task",""))}</p><div class="st">{md_inline(w["status"])} · 시작 {esc(w["start"])}</div></div>')
        a('</div>')
    else:
        a('<p>지금은 도는 워커가 없습니다.</p>')
    a('</section><section><h2>오늘 머지 타임라인 <small>git log origin/main</small></h2><ul class="timeline">')
    for m in prs_today:
        link = f'<a href="{GH}/pull/{m["pr"]}" target="_blank" rel="noopener">#{m["pr"]}</a> ' if m["pr"] else ""
        a(f'<li><span class="t">{esc(m["time"])}</span><span class="k">{esc(m["task"])}</span>{link}{esc(m["title"])}</li>')
    a('</ul></section></div>')

    # screens + layers
    a('<section><h2>화면·기능 구현 현황 <small>무엇이 실제로 보이는가</small></h2><div class="cols">')
    a('<div class="tscroll"><table><thead><tr><th>화면</th><th>이름</th><th>상태</th><th>담당 작업</th></tr></thead><tbody>')
    SP = {"구현": "done", "부분": "part", "자리표시": "todo", "예정": "todo"}
    for sid, name, st, note in SCREENS:
        a(f'<tr><td class="tid">{esc(sid)}</td><td>{esc(name)}</td><td><span class="pill {SP[st]}">{esc(st)}</span></td><td style="color:var(--text-2);font-size:13px">{esc(note)}</td></tr>')
    a('</tbody></table></div>')
    a('<div class="layers">')
    for key, title, done, todo in LAYERS:
        a(f'<div class="layer"><h3>{esc(key)}<span>{esc(title)}</span></h3>')
        if done:
            a('<div class="cap">구현됨</div><ul>' + "".join(f"<li>{esc(x)}</li>" for x in done) + "</ul>")
        if todo:
            a('<div class="cap">다음</div><ul class="todo-list">' + "".join(f"<li>{esc(x)}</li>" for x in todo) + "</ul>")
        a('</div>')
    a('</div></div></section>')

    # phase 1 board
    a('<section><h2>Phase 1 작업 보드 <small>15건 · 4 Wave · 의존 순서</small></h2><div class="tscroll"><table><thead><tr><th>ID</th><th>패키지</th><th>작업</th><th>선행</th><th>상태</th><th>메모</th></tr></thead><tbody>')
    def wave_key(r):
        m = re.match(r"(\d)", r["wave"]); return int(m.group(1)) if m else 9
    cur = None
    for r in sorted(phase1, key=lambda r: (wave_key(r), r["id"])):
        wk = wave_key(r)
        if wk != cur:
            cur = wk
            a(f'<tr class="waverow"><td colspan="6">Wave {wk}</td></tr>')
        a(f'<tr><td class="tid">{esc(r["id"])}</td><td class="wave">{esc(r["pkg"])}</td><td>{md_inline(r["task"])}</td><td style="font-size:12.5px;color:var(--text-2)">{esc(r["deps"])}</td><td>{pill(r["status"])}</td><td style="font-size:12.5px">{md_inline(r["note"])}</td></tr>')
    a('</tbody></table></div></section>')

    # phase 0
    a('<section><h2>Phase 0 기반 작업 <small>15건</small></h2><div class="tscroll"><table><thead><tr><th>ID</th><th>작업</th><th>상태</th><th>결과</th></tr></thead><tbody>')
    for r in phase0:
        a(f'<tr><td class="tid">{esc(r["id"])}</td><td>{md_inline(r["task"])}</td><td>{pill(r["status"])}</td><td style="font-size:12.5px">{md_inline(r["note"])}</td></tr>')
    a('</tbody></table></div></section>')

    # user actions
    a('<section><h2>사용자 액션 <small>사용자만 할 수 있는 일</small></h2><div class="tscroll"><table><thead><tr><th>ID</th><th>내용</th><th>상태</th><th>메모</th></tr></thead><tbody>')
    for r in uacts:
        a(f'<tr><td class="tid">{esc(r["id"])}</td><td>{md_inline(r["task"])}</td><td>{pill(r["status"])}</td><td style="font-size:12.5px;color:var(--text-2)">{md_inline(r["note"])}</td></tr>')
    a('</tbody></table></div></section>')

    # eta + decisions
    a('<div class="cols"><section><h2>예상 일정 <small>2026-09-02 19시 기준</small></h2><div class="tscroll"><table class="eta"><tbody>')
    for t, d in ETA:
        a(f'<tr><td>{esc(t)}</td><td>{esc(d)}</td></tr>')
    a('</tbody></table></div><p style="font-size:12.5px;color:var(--text-2);margin-top:8px">변수: 리뷰 수정 라운드 수, T-1-009의 크기, 동기화 충돌 처리(T-1-011)의 난도, Google 로그인 실검증(U-003).</p></section>')
    a('<section><h2>주요 결정 <small>docs/tracking/decision-log.md</small></h2><div class="dec">')
    for t, d in DECISIONS:
        a(f'<div><b>{esc(t)}</b>{esc(d)}</div>')
    a('</div></section></div>')
    a(f'<footer>이 페이지는 <code>docs/tracking/board.md</code>와 git 로그에서 생성됩니다. 오케스트레이터가 머지·투입 때마다 다시 게시합니다. 마지막 갱신 {esc(updated)}.</footer></div>')
    return "\n".join(p)

open(OUT, "w", encoding="utf-8").write(render())
print(OUT, len(open(OUT).read()), "bytes; phase0", c0, "phase1", c1, "active", len(active), "merges today", len([m for m in merges if m['date']==now.strftime('%Y-%m-%d')]))
