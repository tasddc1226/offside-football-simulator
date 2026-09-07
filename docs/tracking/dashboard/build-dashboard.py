#!/usr/bin/env python3
"""docs/tracking/board.md + git log -> dashboard.html (OFFSIDE 개발 현황판).

읽는 사람: 프로젝트 소유자(사용자). 위에서 아래로 "지금 어디까지 왔나 → 지금 무슨 일이 돌고 있나 → 내가 할 일 →
다음에 올 일 → 오늘 한 일 → (펼쳐 보기) 작업 보드·구현 현황·기록·결정·용어" 순서로 읽히게 만든다.
"""
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

def parse_table(text):
    """헤더 이름으로 열을 찾아 dict 목록으로. ID·작업/내용·상태·비고류 열을 표준 키로 맞춘다."""
    header = None; rows = []
    for line in text.splitlines():
        if not line.startswith("|") or re.match(r"^\|\s*-", line):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            header = cells; continue
        if len(cells) < len(header):
            cells += [""] * (len(header) - len(cells))
        d = dict(zip(header, cells))
        row = dict(
            id=d.get("ID", ""),
            task=d.get("작업") or d.get("내용") or "",
            status=d.get("상태", ""),
            note=d.get("비고") or d.get("메모") or d.get("워크트리") or d.get("결과") or "",
            area=d.get("패키지") or d.get("영역") or "",
            track=d.get("트랙", ""), deps=d.get("선행", ""), wave=d.get("Wave") or d.get("슬라이스") or "",
        )
        if row["id"] and row["id"] != "(없음)":
            rows.append(row)
    return rows

def md_inline(s):
    """markdown links/code -> html (escape the rest)."""
    out = ""; i = 0
    pat = re.compile(r"\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|PR #(\d+)|\*\*([^*]+)\*\*")
    for m in pat.finditer(s):
        out += html.escape(s[i:m.start()])
        if m.group(1):
            href = m.group(2)
            if not href.startswith("http"):
                href = f"{GH}/blob/main/docs/tracking/{href}"
            out += f'<a href="{html.escape(href)}" target="_blank" rel="noopener">{html.escape(m.group(1))}</a>'
        elif m.group(3):
            out += f"<code>{html.escape(m.group(3))}</code>"
        elif m.group(4):
            n = m.group(4)
            out += f'<a href="{GH}/pull/{n}" target="_blank" rel="noopener">PR #{n}</a>'
        else:
            out += f"<strong>{html.escape(m.group(5))}</strong>"
        i = m.end()
    return out + html.escape(s[i:])

def plain(s):
    s = re.sub(r"\*\*(.*?)\*\*", r"\1", s)
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)

gate = plain(section("현재 게이트").strip())

# Phase 로드맵: (표시 이름, 설명, board.md 섹션 제목 또는 None, 한 줄 의미)
PHASES = [
    ("Phase 0", "기술 기반", "Phase 0 백로그", "저장소·CI·배포·데이터 계약"),
    ("Phase 1", "첫 계약까지", "Phase 1 백로그", "온보딩 → 선수 만들기 → 진로 → 첫 계약 → 대시보드"),
    ("Phase 2", "한 시즌", "Phase 2 백로그", "12 step 시즌 · 경기 · 핵심 경기 챕터 · 결산·성장"),
    ("Phase 3·4", "계약·이적 + 부상·관계", "Phase 3·4 백로그", "트랙 A 계약·임대·이적, 트랙 B 부상·관계·평판 (병렬)"),
    ("Phase 5", "장기 성장·은퇴·Legacy", "Phase 5 백로그", "노쇠·은퇴·Legacy 점수·엔딩"),
    ("Phase 6", "SEASON 1: KICKOFF", "Phase 6 출시 항목", "첫 서비스 시즌 출시"),
    ("Phase 7", "운영·밸런스", "Phase 7 운영 항목", "라이브 운영·밸런스 조정·확장"),
    ("Phase 8", "WORLD STAGE", "Phase 8 WORLD STAGE 백로그", "해외 이적·가상 해외 리그·대륙대회 (Phase 3~7 뒤)"),
]
# board.md 표가 없거나 표만으로 상태를 정하기 어려운 Phase는 여기서 손으로 고정한다. 값: "done" | "active" | "todo" | None(표 집계)
PHASE_OVERRIDE = {
    "Phase 2": "done",      # 코드 종료(9/4). 잔여 T-2-010(콘텐츠 팩 0.2.0)은 0.3.0~0.5.0 팩이 대체해 사실상 종료
    "Phase 3·4": "done",    # 9/5 21:55 D-65 출시 게이트 종결
    "Phase 5": "done",      # 9/6 PR #103 통합·staging 인수, 9/6 12:33 운영 배포에 포함
    "Phase 6": "done",      # 9/6 12:33 운영 시즌 1 출시(svc_season_1), 9/6 저녁 offside-lab.com·Google 로그인
    "Phase 7": "active",    # 운영 3회 평가 → 게임성 개선(PR #115) → UI/UX 개편(#120~#139) 진행 중
}
STATUS = {
    "done": ("완료", "done"), "completed": ("완료", "done"), "in-progress": ("진행 중", "active"),
    "todo": ("예정", "todo"), "blocked": ("대기", "blocked"), "deferred": ("보류", "todo"), "in-review": ("리뷰 중", "active"),
}
def pill(status):
    label, cls = STATUS.get(status, (status, "todo"))
    return f'<span class="pill {cls}">{label}</span>'

def counts(rows):
    c = dict(done=0, active=0, todo=0, blocked=0)
    for r in rows:
        c[STATUS.get(r["status"], ("", "todo"))[1]] += 1
    return c

phase_rows = {name: (parse_table(section(sec)) if sec else []) for name, _, sec, _ in PHASES}
release_rows = parse_table(section("미니앱 출시 준비 백로그"))
active = [dict(id=r["id"], worker=r["task"], start=r["status"], status=r["note"]) for r in
          [dict(zip(["id", "task", "status", "note"], [c.strip() for c in l.strip().strip("|").split("|")])) for l in section("진행 중").splitlines() if l.startswith("| T-")]]
uacts = parse_table(section("사용자 액션"))
all_rows = {r["id"]: r for rows in phase_rows.values() for r in rows}
all_rows.update({r["id"]: r for r in release_rows})

log = subprocess.run(["git", "-C", ROOT, "log", "origin/main", "--format=%h|%ci|%s", "-n", "120"], capture_output=True, text=True).stdout
merges = []
for line in log.splitlines():
    h, ts, subj = line.split("|", 2)
    pr_m = re.search(r"\(#(\d+)\)$", subj)
    if pr_m and not subj.startswith("docs"):  # PR 머지 커밋(워커 T-x-xxx: 와 사용자 세션 feat/fix/UX-xxx 모두), docs 커밋 제외
        task_m = re.match(r"^(T-\d-\d{3}|UX-\d{3})", subj)
        merges.append(dict(sha=h, time=ts[11:16], date=ts[:10], task=task_m.group(1) if task_m else subj.split(":")[0], title=re.sub(r"\s*\(#\d+\)$", "", subj.split(":", 1)[-1]).strip(), pr=pr_m.group(1)))

now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
updated = now.strftime("%Y-%m-%d %H:%M KST")
today_md = f"{now.month}/{now.day}"

# 한 줄 현황(오케스트레이터가 머지·투입마다 손으로 갱신)
NOW = ("운영 서비스가 열렸습니다. 9/6 12:33 사용자 세션이 수동 Production Release 워크플로로 첫 운영 배포를 마쳤고(run 34009144236, 82a46fc, 기록 PR #111), web offside-lab.com·api api.offside-lab.com에서 시즌 1(svc_season_1, 테스트 시즌 아님, 종료일 미정)이 ACTIVE입니다. 운영 활성 룰셋 1.3.0·콘텐츠 팩 0.5.0. "
       "Phase 5(장기 성장·은퇴·Legacy)는 9/6 09:46 통합 PR #103(#77 대체, 선수 생성·게임 연출·Legacy 1.1·한국 모듈)으로 main에 들어갔고 10:01 PR #106 배포 후 인수 검증까지 끝나 T-5-001~008 전부 완료입니다(후속 이슈 #104·#105). Phase 6(SEASON 1: KICKOFF)은 운영 릴리스 워크플로(#107)·시즌 1 무기한(#108)·D1 릴리스 검사 수정(#109·#110)·출시 기록(#111)·Google 로그인 운영 연결(#112·#114, U-003 완료)·offside-lab.com 도메인(#118, U-001 완료)·공개 가이드·검색(#117·#119)·두 환경 정리(#122·#127)로 닫혔습니다. "
       "Phase 7(운영·밸런스)이 진행 중입니다. Luna의 운영 3회 플레이 QA(커리어 A/B/C — 실패 뒤 회복·성인 진로 전환이 약함)를 받아 17:46 PR #115(19세 시작·성인 진로 개선, 룰셋 1.3.0·팩 0.5.0)를 냈고, 밤사이 UI/UX 개편 #120·홈 허브 소식/피드백 #121·UX-001~005(#123~#126·#128)·FOUC #129·플래그 브랜드 #130, 9/7 새벽 앱 셸 UX-006(#131)·커리어 홈 UX-007(#134)·TeamBadge UX-008(#133)·시네마틱 인트로 UX-009(#135)·트레이딩 카드 UX-011(#138)·결과 연출 UX-010(#139)·수정 #132·#136·#137까지 머지해 01:51~01:52 운영 재배포(939fe48)를 마쳤습니다. "
       "9/5 밤 이후 코드 PR은 전부 사용자 세션(Codex·Sol·Luna)이 열고 머지했고, 이 Claude 세션은 문서·현황판·CI 검토만 맡습니다(코드 수정 없음). CI는 PR quick checks → main 최소 검사·staging 배포·스모크 → 수동 Production Release(#102) 구조로 Mac self-hosted runner(U-017 완료) 위에서 돕니다. staging은 아직 svc_line_test(룰셋 1.0.0·팩 0.1.0)라 승격이 남았습니다. "
       "남은 것: 이슈 #104(GK 관계 이벤트·NPC 이름 충돌)·#105(챕터 제목 내부 TAG 노출), Google 브랜딩 인증, Search Console·네이버 등록, staging 룰셋·팩 승격(1.3.0/0.5.0), 실사용자 플레이 시간 측정(D1), U-014(Workers Paid)·U-004(Sentry)·U-005(종이 플레이테스트). U-015 LINE TEST 테스터 모집은 시즌 1 공개 출시로 대체됐습니다. "
       "9/7 오후에는 사용자 요청으로 Sonnet 서브에이전트 3명이 ego-browser로 운영 사이트를 3관점(디자인·게임성·기능)에서 플레이했습니다(3커리어 9시즌): 핵심 루프·저장·복원은 오류 없이 돌고 성인 진로 전환은 개선됐지만, 무출전에서 벗어날 수단이 없는 문제(P1 2건)와 하단 고정 버튼 가림·라디오 키보드 무반응·대표팀 결과 공백·enum 노출 등 P2 7건이 남았습니다(docs/qa/2026-09-07-production-three-perspectives). "
       "이어서 13:47까지 Sonnet 서브에이전트 6명이 서로 겹치지 않는 6개 프로필(GK·CB·WG·CM·ST·DM × 성별·국적·출발 카드·전략, 선수 생성은 잠금으로 직렬화)로 57시즌을 플레이했습니다: 핵심 루프 6/6 완주, DM 케이스는 17시즌·36세 자연 은퇴·Legacy 78·보관함까지 정합. 무출전 고착은 5/6 케이스(57시즌 중 20시즌)에서 재현돼 '원소속에 머무는 한 어떤 선택도 출전을 만들지 못하고 임대·이적으로만 회복'으로 조건이 좁혀졌고, 협상 버튼 무결과 4/6·enum 노출 4/6·#105 3/6, 결산 표 모순과 승격 기록 대비 리그 표기 불변이 새로 잡혔습니다(docs/qa/2026-09-07-production-six-cases, P1 2·P2 8·P3 10). "
       "14:10 두 리뷰의 개선 포인트 33건을 이슈 #140~#172로 등록했고, 14:50 우선순위 순으로 1차 웨이브 브리프 T-7-001~010을 썼습니다: 룰셋 1.4.0(0분 1시즌 뒤 회복 제안, 약속 미이행 무벌점, 역할 제안 수락이 계약에 남음, 하향 거절 무벌점 — D-67, 1.3.0 재생 불변)·도메인·로컬 QA 시즌 seed, 협상 결과 배너·불가 사유(D-69), 관계 사유·챕터 TAG·결산 표 라벨, 액션 독 페이드, 서명 프리필·제안 카드, Enter 선택, 대표팀 결과 요약, 승격권 문구(D-68). 14:51 사용자 승인으로 그중 독립적인 6건(T-7-001·004·005·006·008·009)에 Sonnet 5 워커를 투입했고, 17:05 여섯 명 모두 끝나 PR #173~#178을 열었습니다. 그런데 여섯 워커가 한목소리로 \"전체 e2e가 main에서도 60건 실패\"라고 보고했고, 조용한 머신에서 재현해 보니 사실이었습니다(9/6 UX 개편 이후 테스트가 앱을 따라가지 못했고 CI는 스모크만 돌림). 그래서 17:20 핫픽스 3건(T-7-011 e2e 정합, T-7-012 캡션 색 대비, T-7-013 제안 비교 dl 구조)을 추가 투입했고, 그동안 PR 검증은 baseline 대비 새 실패 없음 + 화면 확인으로 판정합니다(D-70). "
       "17:20 PR #173(T-7-001 룰셋 1.4.0 회복 규칙 데이터)을 머지했고 곧바로 T-7-002(도메인)·T-7-003(로컬 QA 시즌 seed) 워커를 투입했습니다(1차 웨이브 b — 부하를 줄이려 워커는 lint·typecheck·패키지 테스트까지만 돌리고 전체 체인은 오케스트레이터가 순차로 돌립니다). 17:32 PR #177(T-7-008 RadioGroup Enter 선택)을 머지했습니다: 체인은 녹색, e2e는 baseline 대비 새 실패 1건(선수 생성 URL 대기 타임아웃, load 111)이 키보드를 쓰지 않는 흐름이라 부하 플레이크로 판정했고 실제 브라우저에서 Enter·Space·화살표 선택을 확인했습니다. 17:35 PR #176(T-7-006 액션 독 어포던스)도 머지했습니다(e2e 새 실패 0, 360px에서 불투명 배경·페이드·그림자 확인). 17:58 T-7-002(도메인 회복 규칙, 골든·해시 불변)·T-7-003(로컬 QA 시즌 seed) 워커가 끝나 PR #181·#182를 열었습니다. #175는 체인 녹색·e2e 새 실패 0에 360px 시즌 완주로 결산 표를 확인했고, #174는 주석의 '이슈 #141'이 hex 리터럴 검사에 걸려 수정(c04c925) 뒤 체인을 다시 돌립니다. 18:03 #175(T-7-005 라벨 정합)를 머지하고 T-7-010(승격권 문구)을 투입했습니다. #174는 360px 임대 제안에서 역할 협상 → 결과 패널·포커스 이동까지 확인했고 체인 재실행만 남았습니다. 18:11 #178(T-7-009 대표팀 결과 요약)도 재실행 체인 녹색·e2e 새 실패 0으로 머지했습니다(1차 웨이브 6건 중 #174만 남음). 18:13 T-7-010 워커가 끝나 PR #184를 열었고 T-7-012 워커는 PR #183을 직접 열었습니다. 18:15 #174 체인이 단위 테스트의 부하 플레이크(대표팀 시드 탐색 120s 타임아웃, load 90+)로 멈춰 기존 워크트리에서 남은 단계(해당 테스트 파일 단독 재실행·build·bundle·contrast·e2e)만 재개했습니다. 18:28 #174(T-7-004 협상 결과 표시)를 머지했습니다: 재개 체인 녹색, e2e 새 실패 2건(/legal/privacy·/settings 정적 화면 axe)은 현재 main에서도 똑같이 재현돼 main 자체 결함으로 이슈 #180에 넘겼고, 360px 실제 플레이로 잔류·임대 협상 화면을 확인했습니다. 곧바로 T-7-007(서명 이름 프리필·제안 카드 기한 셀) 워커를 투입했습니다. 18:32 #181(T-7-002 도메인 회복 규칙)도 체인 녹색·e2e 새 실패 0으로 머지했습니다(630637b). #182(T-7-003 QA seed) 체인은 check:contrast까지 녹색이었지만 e2e 서버가 30초 안에 뜨지 못해(머신 load 200+, 다른 세션 다수) e2e만 뒤로 미뤘고, 19:5x T-7-013 워커가 PR #185(제안 비교 dl 구조)를 열었습니다. 20:07 #184(T-7-010 승격권 문구)를 머지했습니다(16e0a98, 부하 타임아웃 2파일 단독 재실행 통과·e2e 새 실패 0, 이슈 #144는 리그 이동 보류 메모와 함께 닫음). 20:09 T-7-007 워커가 끝나 PR #186(서명 이름 프리필·제안 카드 결정 기한 셀)을 열었습니다. #183(eyebrow 대비)은 360px 측정으로 라이트 4.40:1 → 10.66:1 개선을 확인했고 체인이 돌고 있습니다. 20:12 #183(T-7-012 eyebrow 대비)을 머지했습니다(5e5e2c4): e2e에서 color-contrast 실패 9건이 사라졌고 새 실패는 없습니다. #186은 리뷰에서 결정 기한 셀의 만료 문구 후속 1건을 찾아 같은 브랜치에 수정 워커를 넣었습니다. 20:18 #182(T-7-003 로컬 QA 시즌 seed)도 e2e 재실행 새 실패 0으로 머지했습니다(323adad) — 룰셋 1.4.0 회복 규칙 3종(데이터·도메인·QA seed)이 모두 main에 들어갔고, 이슈 #140은 로컬 QA 시즌 플레이 확인 뒤 닫습니다. 20:26 #185(T-7-013 제안 비교 dl 구조)도 머지했습니다(2074303): e2e 새 실패 0, SCR-009 axe 통과, 360px 카드 레이아웃은 이전과 동일. 이슈 #180에는 정적 화면 2건만 남았습니다. 20:33 #186(T-7-007 서명 프리필·결정 기한 셀)도 머지했습니다(241d275) — 이로써 1차 웨이브 T-7-001~010이 전부 main에 들어갔고 이슈 #151·#152를 닫았습니다(잔여 UI 2건은 #188). 남은 것은 핫픽스 T-7-011(워커가 spec별 재검증 중)과, 사용자 지시(20:30)에 따른 운영 배포(코드만, 시즌 룰셋은 1.3.0 유지)입니다. "
       "14시 사용자 지시로 두 리뷰의 개선 포인트를 같은 원인끼리 합쳐 이슈 #140~#172(33건: P1 #140 무출전 고착·#141 협상 버튼, P2 #142~#152, P3 #153~#172)로 등록하고 #104·#105에 QA 코멘트를 남겼습니다. 워커 배정은 사용자 결정입니다.")


GLOSSARY = [
    ("T-3-002", "작업 번호. T-<Phase>-<순번>. 워커 한 명이 브리프 하나를 받아 PR 하나로 끝낸다"),
    ("U-014", "사용자 액션. 계정·결제·도메인·승인처럼 사용자만 할 수 있는 일"),
    ("D-44 / ADR-010", "설계 결정 번호 / 아키텍처 결정 기록. 결정 로그·ADR 문서에 원문"),
    ("PR #48", "GitHub Pull Request. 워커가 열고 오케스트레이터가 검증 뒤 squash 머지"),
    ("워커", "Claude Code Workflow로 띄우는 Sonnet 5 에이전트(격리 worktree). 브리프대로 구현·PR. 동시 수 상한 없음 — 파일 소유권으로만 제한(D-59, 9/5 낮). 9/4~9/5 오전은 Orca gpt-5.6-luna max, 9/5 밤~9/7은 사용자 세션의 Codex·Sol·Luna가 직접 PR을 열고 머지"),
    ("브리프", "워커에게 주는 작업 지시서(docs/tracking/briefs). 범위·파일·테스트·금지 사항"),
    ("골든", "결정론 검증용 고정 결과(golden fixture). 같은 시드면 같은 결과가 나와야 함"),
    ("트랙 A / B", "Phase 3(계약·이적) / Phase 4(부상·관계·평판). 파일 소유권을 나눠 병렬 진행"),
    ("LINE TEST", "원래 계획한 첫 외부 테스트 시즌(svc_line_test). 9/6 시즌 1 공개 출시로 대체돼 지금은 staging에만 남음"),
    ("시즌 1", "운영 서비스 시즌 svc_season_1. 2026-09-06 12:33 출시, 테스트 시즌 아님, 종료일 미정, 룰셋 1.3.0·팩 0.5.0"),
    ("UX-007", "사용자 세션(Codex·Sol·Luna)의 UI/UX 개편 작업 번호(9/6~9/7). PR 제목·브랜치에만 쓰고 보드 표에는 PR 번호로 기록"),
    ("Production Release", "운영 배포는 main 자동 배포가 아니라 사용자가 수동 실행하는 GitHub Actions 워크플로(가드·D1 검사)"),
]

# --- 손으로 유지하는 데이터 ---
SCREENS = [
    ("SCR-034", "온보딩", "구현", "3장, 건너뛰기·KICKOFF (T-1-007)"),
    ("SCR-001", "허브(홈)", "구현", "카드·이어하기·삭제 2단계·새 커리어 (T-1-007)"),
    ("SCR-002", "선수 만들기 1단계", "구현", "T-1-008, 성별·선호 포지션 T-1-016"),
    ("SCR-003", "선수 만들기 2단계", "구현", "T-1-008"),
    ("SCR-004", "확정·복구 코드 발급", "구현", "T-1-008, 성별·선호 포지션 요약 T-1-016"),
    ("SCR-007", "진로 선택", "구현", "T-1-009"),
    ("SCR-008", "입단 테스트", "구현", "T-1-009"),
    ("SCR-013·014", "범용 이벤트·결과 카드", "구현", "T-1-009"),
    ("SCR-009", "제안 비교", "구현", "T-1-009"),
    ("SCR-010", "계약 확정", "구현", "T-1-009"),
    ("SCR-029", "대시보드(5탭·다음 결정 카드)", "구현", "T-1-009"),
    ("SCR-030", "설정·데이터(복구·삭제)", "구현", "테마·모션·글자 크기·기본 모드·버전 (T-1-007), 동기화 행 (T-1-011), 복구 코드·프로필 복구·삭제·기기 데이터 삭제 (T-1-012), Google 연결·병합·해제·로그아웃 (T-1-013, 실계정은 U-003 뒤)"),
    ("법적 문서", "개인정보·약관", "구현", "본문 초안 (T-1-012). 운영자 OFFSIDE 운영팀·문의 이메일·시행일 확정 (PR #108, U-010 완료)"),
    ("시즌 화면", "프리시즌 계획·시즌 준비·역할 제안·일정표·전술실·능력치 상세", "구현", "T-2-007 (대시보드 시즌화)"),
    ("SCR-031", "핵심 경기 챕터", "구현", "T-2-008. 제목 내부 TAG 노출은 이슈 #105"),
    ("SCR-015 (+006)", "시즌 결산·연대기", "구현", "T-2-009. 결산 원인 설명 보강 PR #92, 서사 헤드라인·선수 배너 UX-010 (PR #139)"),
    ("제안 협상", "PRE_NEGOTIATION 제안 비교·상세·협상·거절·수락, LOAN_RETURN 결정", "구현", "T-3-005"),
    ("SCR-020", "이적·임대 결과", "구현", "T-3-005, STAY 카드 T-4-011, RETURN 문구 T-4-016"),
    ("SCR-016·018·021·022·024·032", "Phase 4 맥락 화면(부상·관계·감독·평판·대표팀)", "구현", "T-4-005a/b/c·T-4-018 (PR #85), SCR-032 문구·캡처 T-4-028·T-4-023"),
    ("SCR-025~028", "은퇴(FULL TIME)·Legacy·연대기·최종 프로필·보관함→새 커리어", "구현", "T-5-006 (PR #103, Legacy 1.1)"),
    ("선수 생성·계약 연출", "선수 생성·게임 연출(PR #103), 트레이딩 카드 UX-011", "구현", "PR #103·#138"),
    ("홈 허브 개편", "소식·피드백(#121), 커리어 홈 탭 정보형 대시보드 UX-007(#134), 홈 탭 정리(#136)", "구현", "UI/UX 개편 PR #120 위. 설계 docs/design/app-experience-redesign.md"),
    ("앱 셸·브랜드", "100dvh 고정 프레임 앱 셸 UX-006(#131), 플래그 브랜드(#130), TeamBadge UX-008(#133), FOUC 제거(#129)", "구현", "9/6 밤~9/7 새벽 사용자 세션"),
    ("시네마틱 인트로", "SCR-034 온보딩 시네마틱 인트로 UX-009", "구현", "PR #135"),
    ("공개 가이드·SEO", "공개 가이드 페이지·opt-in SEO·공개 검색 허용", "구현", "PR #117·#119, offside-lab.com (#118)"),
]
LAYERS = [
    ("domain", "결정론 시뮬레이터", ["시드 RNG·canonical hash·golden fixture", "CREATE_CAREER·RESOLVE_EVENT·ADVANCE", "효과 5종·태그·지연 효과", "선수 모델·Base OVR 59·DRAFT→확정·이벤트 제시 (T-1-001)", "제안 생성·계약 확정, golden 첫 계약까지 (T-1-005)", "선수 성별(결과 불변)·선호/현재 포지션 분리·golden 갱신 (T-1-016)", "시즌 구조·12 step·START/SETTLE_SEASON·ADVANCE 재정의·결정 예산 (T-2-001)", "전술 스타일·경쟁자 8×2·Tactical Fit·선발 순위·step-1 역할 제안 RESOLVE_ROLE, golden underdog (T-2-002)", "경기 계산: 일정·팀 결과·출전 시간·통계·평점·카드·부상·시즌 집계, 경기 전용 RNG (T-2-003)", "시즌 결산 SeasonResult·성장식(D-39)·폼/체력/사기·출전 약속·DEFERRED 시즌 적용 (T-2-005)", "핵심 경기 챕터: 후보 선택·RESOLVE_CHAPTER·ChapterRecord, golden career-05-chapter (T-2-004)", "Effect 중첩·만료·복원(D-40)·시장가치 지수(D-41)·CareerTag 16종·결산 훅(D-42), ADR-010 (T-2-014)", "Phase 3·4 타입 슬라이스: Offer/Contract v2·clubHistory·MarketSummary·pending 5종·타임라인 kind 15종·제안 상태기계·CMD-CON payload·DSL contract.* (T-3-001)", "이적시장 생성기: 사유 판정·후보 구단·제안 4종·안전 잔류·유효기간·step 7 재계약 제안·transferRules·시장 골든 3종 (T-3-002)", "이적시장 명령 처리기 4종·결산 배선·임대·약속 위반·태그 5종·골든 career-10·11 (T-3-003)", "트랙 B 타입 슬라이스: health·relationshipLog·reputation·season.manager·HEALTH Effect·RESOLVE_EVENT INJURY/NATIONAL_TEAM·훅 골격 3개 (T-4-001)", "결정론적 부상·재활·재발·후유증 상태기계, INJURY forced pending, career-12-injury (T-4-002)", "관계 감사 로그·memory tag LRU·결산 평판·주장단·감독 교체 예약·Phase 4 태그 5종·SLUMP/LOCKER_ROOM/ETHICS/MEDIA 이벤트 (T-4-003)", "대표팀 차출 자격 판정(tier OVR·평점+인기)·step 8 NATIONAL_TEAM pending·callUp 3종 체력/관계 delta·부상 자동 사양·NATIONAL_DEBUT MAJOR 챕터 예약·nationalityRuleState 기본 모듈 (T-4-004)", "3시즌 통합 fixture career-13·불변 property 200 seed·결정 예산·Snapshot 크기 (T-4-006 domain, PR #72)", "감사 domain 수정 §1 RNG·§2 시장/계약·§3 임대 복귀 (T-4-012, Codex 통합 PR #85)", "통산 기록 projection·정규화 Legacy 가중합·밴드·엔딩 우선순위 (T-5-001, PR #70)", "불변 Archive·통산/업적 정본·Legacy 1.1 저장 계약·버전/checksum (T-5-002, PR #71→#103)", "다년 성장·노쇠·은퇴 압력·마지막 선택·RETIRE/terminal 명령 거부 (T-5-003)", "기록→Legacy 5축 정규화·source 연결·동일 품질 4포지션 공정성 (T-5-004)", "14종 엔딩 eligibility·폴백·최고 순간·미선택 에필로그 (T-5-005)", "4포지션 20시즌 완주·원자성·복구·변조·중복 요청 회귀 (T-5-007)", "한국 복무/휴식/U23/특례/멘토링 규칙 모듈·Archive 연결 (T-5-008)", "성인 진로 진행 개선·19세 시작 (PR #115, 룰셋 1.3.0)"], []),
    ("content", "이벤트·룰셋 데이터", ["프로토타입 팩 0.1.0(이벤트 10개)", "조건 DSL·효과 스키마·검증 CLI", "룰셋 1.0.0(아키타입 24·배경 3·팀 8·제안·계약 규칙)", "조건 컨텍스트·적격 이벤트 선택기·브라우저 팩 로더 (T-1-015)", "룰셋 leagueCalendar 12 step·seasonBoundaryReset (T-2-001)", "리그 4·FA컵·전술 스타일 3종·선발 상수·경쟁자 이름 40 (T-2-002)", "matchRules·결과표·통계표·징계·부상 (T-2-003)", "growthRules·conditionRules·promiseMinutesShareBp (T-2-005)", "팩 chapters 3종(CHP-MATCH-001/002/004)·챕터 스키마·리그 라이벌/승격·강등 정보 (T-2-004)", "marketValueRules·EffectSchema 확장(ONCE_PER_SEASON·AT_SEASON_END·SEASONS_AFTER·reasonTag) (T-2-014)", "팩 0.2.0 등록(활성 0.1.0 유지)·PRO 이벤트 5종 PROTOTYPE·authoring 스키마·agent 토큰·룰셋 팀 12 (T-3-006)", "트랙 B 룰셋 섹션 5종(injury·manager·relationship·reputation·nationalTeam)·INJURY/NATIONAL_TEAM 이벤트 스키마·DSL health/manager/reputation 토큰 (T-4-001)", "EVT-NAT-001·CHP-NAT-001(0.1.0·0.2.0)·nationalTeamRules event/minRatingTenths·presentation 이벤트 분리 테스트 (T-4-004)", "콘텐츠 팩 0.3.0: Phase 4 이벤트 12종·포지션 챕터 3종·500 seed 도달성 (T-4-008, PR #75)", "감사 content: season.stats 파생·슬럼프 게이트·EVT-CON-010 phase·INJURY previewEffects 검증기 (T-4-015, PR #82→#85)", "RUMOUR 이적 창 진입 경로 D-63 (T-4-022, PR #85)", "룰셋 1.1.0~1.3.0·팩 0.4.0·0.5.0 등록 (Phase 5 통합 #103 → 시즌 1 게임성 개선 #115), 운영 활성 1.3.0/0.5.0", "GK 관계 이벤트·NPC 이름 충돌은 이슈 #104"], []),
    ("contracts", "API·명령 스키마(Zod)", ["요청·응답 봉투·오류 코드·프로필 설정", "커리어 동기화 GET/PUT·Snapshot 봉투", "Phase 1 명령 payload 판별 유니온·CareerState·PlayerPublic(잠재력 비노출)·복구·삭제 스키마 (T-1-006)", "api 복구·삭제 라우트가 contracts 스키마로 검증 (T-1-012)", "선수 성별·선호/현재 포지션 스키마 (T-1-016)", "Google 병합·pendingMerge 스키마 (T-1-013)", "RESOLVE_ROLE·ROLE_PROPOSAL·경쟁자·선발 순위 스키마 (T-2-002)", "golden 순회 strict 정합·목록 가드·Snapshot 크기 15.3 KB(예산 6%) (T-2-006)", "분석 이벤트 12종 strict props·service-season current·오류 코드 SERVICE_SEASON_UNAVAILABLE/CLOSED (T-2-012)", "career-10·11 strict 명령·snapshot 불변 검증 (T-3-004)", "analytics props elapsedSec(int 0~7200, optional) (T-4-024, PR #94)", "Legacy 1.1 Archive·owner GET·버전/checksum 스키마 (T-5-002, PR #103)"], []),
    ("engine-client", "브라우저 실행기", ["명령 실행기·멱등성·Snapshot 복구", "Web Worker 시뮬레이터", "동기화 클라이언트(재시도·409 처리)", "룰셋 배선 (T-1-001)", "포크(fork-by-replay)·Worker 실패 처리 (T-1-011)", "서버 커리어 가져오기 importCareerFromServer (T-1-012)", "시즌 명령 replay·fork·import golden, 로컬 저장 시즌 checkpoint 계약 (T-2-006)", "replay/fork/import 회귀·브라우저 Worker hash probe (T-3-004)"], []),
    ("platform", "저장소 추상화", ["Dexie(IndexedDB) LocalStore", "KV LocalStore(토스 채널용 스텁)", "features.googleLink 채널 기능 플래그 (T-1-013)", "웹 분석 클라이언트: 배치 20건/10초/pagehide, sendBeacon→fetch keepalive, 익명 clientId (T-2-012)"], []),
    ("api", "Cloudflare Workers + D1", ["D1 스키마·migration", "세션(쿠키·Bearer)·익명 프로필·설정", "커리어 동기화 GET/PUT·If-Match·멱등", "복구 코드·프로필 복구·삭제·로그아웃·커리어 삭제 (T-1-004)", "Google OIDC start/callback/merge/unlink·가짜 OIDC (T-1-013)", "시즌 3경로 동기화·Miniflare golden 순회 (T-2-006)", "서비스 시즌 포인터 ACTIVE_SERVICE_SEASON_ID·GET /service-seasons/current·생성 시 시즌 상태 검사(409)·analytics_events 수집(화이트리스트·rate limit)·svc_line_test 시드·마이그레이션 0003 (T-2-012)", "analytics_events 삽입 14행 청크(D1 변수 100개 상한, 예행 503)·unknown error 응답 고정 문구·원문은 로그로만 (T-2-015)", "PUT 3경로·멱등·요청 크기 probe 회귀 (T-3-004)", "api 100회 병렬 테스트 타임아웃 60초 (T-4-013, PR #73)", "해시 probe career-12 부상·career-13 통합 추가, Node·workerd·golden 일치 (T-4-017, PR #90)", "Archive+Legacy 원자 저장·D1 owner GET·복구·삭제 (T-5-002, PR #103)", "시즌 1 무기한 운영 시즌 svc_season_1·문의 이메일 (PR #108)", "릴리스 검사 D1 compound select 상한·독립 count 쿼리 (PR #109·#110)", "Google 로그인 운영 연결(개인 GCP offside-football-prod)·재인증 중 미동기화 진행 보존 (PR #112·#114, U-003)", "테스트 환경 cors env 참조 health 503 수정 (PR #137)"], ["staging 룰셋·팩 승격 1.0.0/0.1.0 → 1.3.0/0.5.0", "Google 브랜딩 인증(외부 절차)"]),
    ("web · ui", "React 화면", ["라우터·디자인 토큰·허브 빈 상태", "Pretendard 동적 서브셋(2109KB→269KB)", "Button·Card 등 기본 부품", "Radix RadioGroup·Dialog·Tabs, ChoiceCard·CompareCards 등 부품 10종", "Playwright + axe E2E, 브라우저 Worker 해시 검증 (T-1-010)", "엔진 배선(Worker·IndexedDB)·허브·온보딩·설정 영속화 (T-1-007)", "선수 만들기 SCR-002~004·복구 코드 발급·API 클라이언트 (T-1-008)", "동기화 배선·저장 배지·충돌 대화상자·오프라인 (T-1-011)", "진로·입단 테스트·이벤트·결과·제안·계약·대시보드 화면, first-contract e2e (T-1-009)", "설정 데이터 섹션(복구·삭제·대조)·법적 문서·실제 api 복구 e2e (T-1-012)", "선수 성별 RadioGroup·선호 포지션 라벨·확인 요약 (T-1-016)", "Google 연결 행·병합 선택·로그아웃, google-link e2e (T-1-013)", "resilience·recovery-conflict·keyboard·session-length·perf e2e, 완료 조건 표 15행 (T-1-014)", "포지션 탭 키보드 도달·선호/주포지션 표시·국외 이전 표·결과 aria-live·이탈 경고 (T-1-017)", "브라우저 Worker 시즌 리플레이 hash·9.6~15 ms (T-2-006)", "프리시즌 계획·시즌 준비·역할 제안·대시보드 시즌화·능력치 상세, season/a11y e2e, E2E_PORT (T-2-007)", "핵심 경기 챕터 화면 SCR-031·chapterCandidates·RESOLVE_CHAPTER·재생, chapter e2e·DEV 시드 오버라이드 (T-2-008)", "시즌 결산 화면 SCR-015(+SCR-006)·변화 원인 분리·CompareCards·CountUp·응답 유실 복구·다이어리 연대기 (T-2-009)", "Phase 2 완료 조건 검증: 포지션군 fixture 3종·결정론·집계·B > A·시즌 완주 세션 측정·rngState.draws e2e·68건 3회 무결점 (T-2-011)", "LINE TEST 준비: useServiceSeason(kv 캐시·폴백)·허브 LINE TEST 배너·테스트 시즌 배지·LOCKED 시 생성 비활성·퍼널/결산/이탈 분석 이벤트·service-season e2e 4종 (T-2-012)", "온보딩 첫 슬라이드 LINE TEST 안내 (T-2-015)", "PRE_NEGOTIATION 제안 비교·상세·협상·거절·수락, LOAN_RETURN 결정, SCR-020 이적·임대 결과 (T-3-005)", "로컬 QA 표시 오류 4건 수정: 컵 코드·출전 집계·진로 서사·입단 테스트 ID (PR #63)", "narrative.ts agent 토큰 (T-3-005)", "NATIONAL_TEAM pending → SCR-013 라우팅·callUp 어댑터·데뷔 챕터 맥락 격리 (T-4-004)", "디자인 PR #66 재통합(T-4-007): 19개 화면 모바일 개편 + T-3-005·T-4-004 화면 정합, SCR-020 디자인 정합 — 사용자 머지 7bd3d84", "staging 리허설 자동화 config·spec·e2e:staging (T-2-016, PR #69)", "e2e 간헐 실패 안정화·CI 실패 아티팩트·INTEREST 시드 케이스 (T-4-010, PR #74)", "SCR-020 잔류 결과 STAY 카드·loader redirect 튕김 제거 (T-4-011, PR #76)", "[핫픽스] e2e 헬퍼 `&interested=` 허용·season.spec 프리시즌 단언 — main 회귀 해소 (T-4-019, PR #81)", "[핫픽스] injury.spec poll textContent 타임아웃 — 반복 플레이크 원인 제거 (T-4-020, PR #80)", "DEV 팩 오버라이드·라벨 함수·phase4-seeds (T-4-009, PR #84→#85)", "step 7 전부 거절 문구·휴대폰 탭 시장 사유 (T-4-014, PR #78→#85)", "SCR-020 RETURN 문구·{manager} 토큰 (T-4-016, PR #79→#85)", "season.spec:17 프리시즌 도착 허용 (T-4-021, PR #83→#85)", "Phase 4 화면 SCR-016·018·021·022·024·032 맥락 패널·점진 공개·실제 적용량 결과 카드 D-64 (T-4-005a/b/c·T-4-018, Codex 통합 PR #85)", "season_settled·step_passed 초 단위 elapsedSec, 호출부 careerId 배선 (T-4-024, PR #94)", "대표팀 agent 축 문구 정합: SCR-032 안내·SCR-014 결과 맥락 (T-4-028, PR #98, D-66)", "SCR-032 대표팀 자연 플레이 seed(0.3.0 시즌 20)·reachability·360px 캡처 2장 (T-4-023, PR #100)", "스테이징 UI 이슈 #86~#89 수정 (PR #91)", "Phase 3 잔여 진행 안내·결산 원인 설명 보강 (PR #92)", "Phase 5 화면 SCR-025~028 FULL TIME→Legacy→연대기→최종 프로필·보관 UX, 선수 생성·게임 연출 (T-5-006, PR #103)", "성인 진로 개선·시즌 1 게임성 갱신 (PR #115), 스모크 온보딩 대기 (PR #116)", "공개 가이드·opt-in SEO (PR #117), 공개 검색 허용 (PR #119)", "밝고 정돈된 스포츠 앱 UI/UX 개편 (PR #120), 홈 허브 소식·피드백 (PR #121)", "설정 푸터(UX-002 #123)·앱 버전(UX-005 #124)·접이식 설정(UX-003 #125)·포인트 색상 프리셋(UX-004 #126)·구단 이름 커스터마이즈·팀 플레이버(UX-001 #128)", "FOUC 제거 (PR #129), 플래그 브랜드 (PR #130)", "앱 셸 100dvh 고정 프레임·내부 스크롤 (UX-006, PR #131)", "커리어 홈 탭 정보형 대시보드 (UX-007, PR #134), 홈 탭 태그 노출·진행 바 접근성·소식 필터 (PR #136)", "TeamBadge 구단 이니셜·컬러 배지 (UX-008, PR #133), 결과 화면 내부 태그 ID 노출 제거 (PR #132)", "SCR-034 시네마틱 인트로 (UX-009, PR #135)", "경기·시즌 결과 서사 헤드라인·선수 배너 (UX-010, PR #139), 선수 생성·계약 완료 트레이딩 카드 (UX-011, PR #138)"], []),
    ("CI · 배포", "GitHub Actions · Pages · Workers", ["main 푸시 staging 자동 배포 (T-0-010, PR #46)", "Mac self-hosted runner 전환 (PR #96, U-017)", "expanded QA staging 격리 (T-4-027, PR #95), preview cleanup 오류 보고 (PR #99)", "PR은 quick checks만, staging 배포는 main에서만 (PR #102)", "수동 Production Release 워크플로·가드·D1 검사 (PR #107) → 첫 운영 배포 9/6 12:33 (PR #111), 재배포 9/7 01:51", "staging·production 두 환경(expanded 제거, PR #122·#127)", "offside-lab.com 커스텀 도메인·legacy workers.dev 로그인 호환 (PR #118)"], ["U-014 Workers Paid 플랜", "U-004 Sentry DSN"]),
]


ETA = [
    ("9/2 20:50", "Wave 1·2 전부 머지(도메인 제안·계약, 이벤트 선택기, contracts 스키마). 웹 엔진 배선(T-1-007) 진행 중"),
    ("9/2 22:05", "웹 엔진 배선 머지: 온보딩→커리어 생성→허브 카드가 브라우저에서 동작. 선수 만들기(T-1-008)·진로~계약·대시보드(T-1-009) 동시 투입"),
    ("9/2 23:42", "선수 만들기(T-1-008) 머지: 이름·포지션·스타일 → KICKOFF → 복구 코드까지 브라우저에서 동작. 동기화 배선(T-1-011) 투입"),
    ("9/3 01:55", "동기화 배선(T-1-011) 머지: 저장 배지·충돌 해소·오프라인·실브라우저 CORS 수정. 설정 데이터 섹션(T-1-012) 투입"),
    ("9/3 08:57", "진로~계약·대시보드(T-1-009) 머지: 온보딩부터 첫 계약·대시보드까지 브라우저에서 동작(e2e 전 구간 3.4~5.5초). 선수 성별·선호 포지션(T-1-016) 투입"),
    ("9/3 09:25", "설정 데이터 섹션·법적 문서(T-1-012) 머지: 복구 코드 재발급·프로필 복구·삭제가 실제 api로 동작. Google 연결(T-1-013) 투입"),
    ("9/3 09:55", "성별·선호 포지션(T-1-016) 머지: 선수 생성에 성별·선호 포지션, 결과 불변 확인(golden stateHash만 변경). E2E 완료 조건(T-1-014) 투입"),
    ("9/3 10:50", "Google 연결·로그아웃(T-1-013) 머지: 가짜 OIDC로 연결·병합·해제 동작. 남은 Phase 1은 T-1-014 하나"),
    ("9/3 11:15", "E2E 완료 조건(T-1-014) 머지: 최소 조작 58초, 허브 LCP 1.1초(4G), 완료 조건 표 15행. 미구현 5건(포지션 탭 키보드 도달 불가 등) → T-1-017 투입"),
    ("9/3 12:12", "완료 조건 보완(T-1-017) 머지 → Phase 1 종료(완료 조건 15행 중 14 ✅, Google 실계정만 U-003 대기). Phase 2 Wave 1 T-2-001(시즌 구조) 투입"),
    ("9/3 14:25", "시즌 구조(T-2-001) 머지(PR #36): START_SEASON→ADVANCE→SETTLE_SEASON이 12 step 캘린더 위에서 결정론적으로 돈다(golden FAST·CHAPTER). 리뷰 수정 4건. T-2-002(팀 전술·경쟁자·선발) 투입"),
    ("9/3 17:00", "팀 전술·경쟁자·선발(T-2-002) 머지(PR #37): 전술 스타일 3종·리그·컵·경쟁자 16명·Selection Score·step-1 역할 제안이 골든으로 고정(OVR 58 선수가 전술 적합도로 선발). 리뷰 수정 3건. Wave 2 T-2-003(경기 계산)·T-2-006(계약·동기화·크기) 병행 투입"),
    ("9/3 18:50", "계약·동기화 검증(T-2-006) 머지(PR #38): 시즌 상태가 contracts strict 스키마·서버 동기화 3경로·Miniflare·브라우저 Worker를 그대로 통과, Snapshot 최대 15.3 KB. 리뷰 수정 2건"),
    ("9/3 19:05", "경기 계산(T-2-003) 머지(PR #39): 일정·경기 결과·출전·통계·평점·카드·부상·시즌 집계가 골든으로 고정, 경기 전용 RNG 스트림(D-37), FAST 시즌 domain 7.4 ms. 리뷰 수정 2건 + PR #38 후속. Wave 2 종료"),
    ("9/3 20:55", "Wave 3 T-2-004(핵심 경기 챕터)·T-2-005(결산·성장) 병행 투입. 사용자 '속도 올리자'로 T-2-007(시즌 화면)을 3번째 워커로 투입, T-2-008·009·014 브리프 선작성"),
    ("9/3 21:20", "시즌 결산·성장(T-2-005) 머지(PR #40): SeasonResult·성장식(D-39)·폼/체력/사기·출전 약속·DEFERRED 효과의 시즌 단위 적용, 밸런스 표 통과(200 seed×3 연령). 리뷰 수정 2건(DEFERRED 유실 버그 포함)"),
    ("9/3 22:03", "핵심 경기 챕터(T-2-004) 머지(PR #41): 데뷔전·더비·승격 결정전 챕터가 경기 직후 열리고 판단마다 roll 1회, golden career-05-chapter. 리뷰 수정 1건 + main 머지. Wave 3 종료. T-2-014(Phase 3+ 공유 계약) 투입"),
    ("9/3 23:15", "시즌 화면(T-2-007) 머지(PR #42): 계약→프리시즌 계획→시즌 준비→역할 제안→대시보드(일정표·전술실)→결산까지 브라우저에서 돈다(e2e 60 통과). 리뷰 수정 0건. T-2-008(챕터 화면)·T-2-009(결산 화면) 투입"),
    ("9/3 23:32", "공유 계약(T-2-014) 머지(PR #43): Effect 만료·중첩·복원, 시장가치 지수, CareerTag 16종·결산 훅, ADR-010(사용자 승인 대기 U-012). 리뷰 수정 2건"),
    ("9/4 01:20", "PR #44(챕터 화면)·#45(결산 화면) 리뷰 통과(수정 0건). #44 검증 체인 e2e 2건 실패(season.spec 이중 클릭 TOCTOU·chapter.spec 0분 시즌 데뷔 미발생) → 수정 요청. T-2-011(Phase 2 완료 조건 검증) 3번째 워커 투입"),
    ("9/4 01:56", "핵심 경기 챕터 화면(T-2-008) 머지(PR #44): 챕터가 브라우저에서 열리고 판단 확정→경기 결과→재생까지, e2e 결정론 시드 훅. 리뷰 수정 0건 + 검증 e2e 결함 2건 수정. T-2-009 main 머지·재검증 중"),
    ("9/4 02:08", "시즌 결산 화면(T-2-009) 머지(PR #45): OVR 변화와 경기 예상치 변화 분리, CompareCards·CountUp, 결산 응답 유실 복구, 다이어리 연대기. Phase 2 화면 3종 완료 — 계약→시즌→챕터→결산→다음 시즌이 브라우저에서 이어짐(e2e 66). 리뷰 수정 0건"),
    ("9/4 02:18", "Phase 3·4 병렬 계획 초안(D-43~D-53): 트랙 A 계약·임대·이적 T-3-001~006, 트랙 B 부상·관계·평판 T-4-001~006. 투입은 Phase 2 종료·ADR-010 승인(U-012) 뒤, U-013(워커 PROTOTYPE 문구) 확인 요청"),
    ("9/4 03:41", "Phase 2 완료 조건 검증(T-2-011) 머지(PR #47): 완료 조건 9행 전부 자동 검증(fixture 3종·결정론·집계·B > A·세션 측정·e2e 68건 3회 무결점), 후속 a·b·d 정리. Phase 2 코드 작업 종료 — 잔여 T-2-010(U-005)·T-2-012(U-002)는 사용자 게이트. 리뷰 수정 0건"),
    ("9/4 03:46", "T-3-001(계약·제안 v2 타입 슬라이스) 브리프 선작성 — Offer/Contract v2·clubHistory·제안 상태기계 함수·타임라인/pending 예약·DSL contract.*·CMD-CON payload 스키마"),
    ("9/4 10:07", "사용자 결정 4건: PR #46(Cloudflare 배포 파이프라인, T-0-010) 머지 승인 → abf9bfa, ADR-010 설계 승인(U-012), 이벤트 문구 PROTOTYPE 허용(U-013 A), 가상 구단 12개. T-2-012(LINE TEST 준비)·T-3-001(Phase 3·4 타입 슬라이스) 나란히 투입"),
    ("9/4 10:40", "T-0-010 completed: main 푸시 staging 자동 배포 성공(Quality·Browser·Deploy staging), api health·web 200. Phase 0 전 항목 종료. 후속: docs/** paths-ignore"),
    ("9/4 11:43", "Phase 3·4 타입 슬라이스(T-3-001) 머지(PR #48): Offer/Contract v2·clubHistory·pending/타임라인 예약·DSL contract.*·CMD-CON payload 스키마. 리뷰 수정 1건(contract.isLastSeason 의미 — 브리프 오류 정정), 골든 9종 draws 불변"),
    ("9/4 11:46", "T-4-001(트랙 B 타입 슬라이스)·T-3-002(이적시장 생성기) 투입 — Phase 3·4 병렬 시작. 브리프 3종 작성(T-4-001·T-3-002·T-3-006). T-3-006(팩 0.2.0·팀 12)은 T-2-012 머지 뒤"),
    ("9/4 12:18", "LINE TEST 준비(T-2-012) 머지(PR #49): 서비스 시즌 포인터·GET /service-seasons/current·svc_line_test 테스트 시즌·분석 이벤트 수집(12종 화이트리스트)·허브 배너/배지·퍼널 이벤트. 리뷰 수정 0건, 실 api e2e 7건. Orca PR 게이트가 gh pr create를 막아 GitHub API로 PR 개설"),
    ("9/4 12:21", "T-3-006(팩 0.2.0·PRO 이벤트 5·팀 12) 투입 — 동시 워커 3개"),
    ("9/4 12:26", "T-2-013 완료: LINE TEST 운영 계획(일정 09-08~09-21 제안, D1 측정 쿼리 7종, 기준선 양식, 게이트 7행). 새 사용자 액션 U-015(테스터 모집·안내문)"),
    ("9/4 12:56", "staging svc_line_test 확인·예행 통과(온보딩→계약→FAST·CHAPTER 시즌 39초). 결함 3건 발견: 분석 이벤트 20건 배치 503(D1 변수 100개 상한, 유실), 오류 본문 SQL 노출, 온보딩 안내 없음 → T-2-015 브리프(12:36). 기준선 D1 조회는 wrangler 로그인 필요(U-016)"),
    ("9/4 13:01", "콘텐츠 팩 0.2.0(T-3-006) 머지(PR #51): PRO 이벤트 5종 PROTOTYPE·팀 12·authoring 스키마·agent 토큰. 활성 팩은 0.1.0 유지. 리뷰 수정 0건, 브리프 정정 2건(phases PRO·골든 재기록 불필요). PR #50(이적시장)은 수정 요청 1건(결산 뒤 STARTER 판정 도달 불가)"),
    ("9/4 13:02", "T-2-015(분석 이벤트 D1 청크·오류 메시지·온보딩 안내) 투입 — LINE TEST 전 머지 필수"),
    ("9/4 13:20", "T-3-003 브리프 선작성(명령 처리기 4종·결산 배선·임대·약속 위반·태그 5종·골든 2종). parentContract 필드로 골든 9종 hash 갱신"),
    ("9/4 13:32", "staging 재예행 통과(5462dc7): 완주 40초, 분석 POST 전부 202, 20·50건 배치 202, 온보딩 LINE TEST 안내 확인. LINE TEST 준비 체크리스트 코드 항목 완료 — 남은 것은 U-014·U-015·U-016"),
    ("9/4 13:21", "PR #52 머지(T-2-015) — LINE TEST 결함 3건 수정, 리뷰 수정 0건, 실 api e2e 8건 포함 녹색. 투입→머지 19분"),
    ("9/4 13:33", "PR #50 머지(T-3-002 이적시장 생성기) — 리뷰 수정 1건(결산 뒤 도달 불가 분기) 반영, 체인 녹색"),
    ("9/4 13:34", "T-3-003(명령 처리기·결산 배선·임대·약속 위반·태그·골든 2종) 투입 — Phase 3 도메인 마지막 조각"),
    ("9/4 14:56", "U-016 완료(wrangler 로그인) → staging D1 확인: funnel 5단계·season_settled FAST/CHAPTER 도달, 배치 70건 도달 뒤 삭제. LINE TEST 준비 체크리스트 코드·운영 항목 전부 ✅, 남은 것은 U-014·U-015"),
    ("9/4 13:57", "PR #53 머지(T-4-001 트랙 B 타입 슬라이스) — 리뷰 수정 0건. PR #50 충돌 재머지·미커밋 골든(PLACEHOLDER)을 체인이 잡아 보완"),
    ("9/4 16:47", "T-3-003 머지(PR #54): 시장 명령 4종·결산 배선·임대·약속 위반·태그 5종. Luna Max 독립 리뷰가 P1 3건을 찾아 수정했고 새 head CI와 전체 pnpm test가 통과"),
    ("9/4 인계", "기존 Claude 세션은 T-3-003 뒤 정지. Codex가 오케스트레이터를 인계하고 이후 구현·테스트 코드는 Orca gpt-5.6-luna reasoning max 워커에게만 위임"),
    ("9/4 17:04", "T-3-004(계약·api·동기화), T-4-002(부상), T-4-003(관계·감독·평판) Luna Max 워커 3개 병렬 투입. T-3-005는 T-3-004 뒤, T-4-004는 T-4-002·003 뒤"),
    ("9/4 17:11", "후속 브리프 T-3-005·T-4-004 선작성. 현재 step 7 RUMOUR 전용 생성 경로가 없음을 확인해 T-3-005 시작 시 도달성 결정 게이트로 분리"),
    ("9/4 21:42", "PR #55 머지(T-3-004 계약·이적 strict 검증·동기화 회귀, Luna Max). 제품 동작 변경 없음"),
    ("9/4 22:35", "PR #63 머지(로컬 QA 화면 표시 오류 4건 — 사용자 이슈 #57~#60)"),
    ("9/5 01:36", "PR #64 머지(T-4-002 결정론적 부상·재활·재발 모델, career-12-injury)"),
    ("9/5 02:25", "PR #65 머지(T-3-005 계약·협상·이적 UI) — Phase 3 코드 종료"),
    ("9/5 04:17", "PR #67 머지(T-4-003 관계 감사 로그·평판·주장단·감독 교체·Phase 4 태그 5종·이벤트 4종)"),
    ("9/5 09:07", "PR #68 생성(T-4-004 대표팀 차출·데뷔 예약), CI 녹색. Codex 리뷰 지적 2건(웹 라우팅·이벤트 화면·데뷔 챕터) 워커가 수정 중"),
    ("9/5 10:50", "오케스트레이션 Claude 복귀·Sonnet 5 워크플로 전환(사용자 지시). 브리프 T-4-007·T-4-005·T-4-006, 결정 D-56~D-58, README 워크플로 갱신. Codex 세션은 PR #68까지만 마무리"),
    ("9/5 11:07", "PR #68 머지(T-4-004 대표팀 차출·데뷔 예약, Codex). Phase 4 domain·content 완료. 직후 T-4-007(디자인 PR #66 재통합) ‖ T-4-006 domain을 Sonnet 5 워크플로로 투입"),
    ("9/5 11:50", "병렬 상한 해제(D-59, 사용자 지시). T-4-008(팩 0.3.0)·T-4-009(Phase 4 화면 준비)·T-2-016(staging 리허설) Sonnet 5 추가 투입 — 워커 5명 병행. Phase 3·4 코드 감사 워크플로(읽기 전용)·CI e2e 간헐 실패 조사 병행"),
    ("9/5 12:35", "PR #69 머지(T-2-016 staging 리허설 자동화). 12:30 무렵 세션 한도로 워커 4개·감사 검증 중단"),
    ("9/5 14:59", "사용자가 디자인 PR #66(T-4-007 재통합 포함) 머지 — Phase 3·4 화면이 새 디자인 계약 위에 올라감. Phase 5 PR #70·#71도 사용자 세션에서 머지"),
    ("9/5 15:20", "한도 초기화. 중단 워커 WIP 보존 → T-4-006·008·009·010 재개 + T-4-011 투입. 감사 1차 확인 14건(P1 비호환 보고는 정정·반박), 11건 재검증. T-4-013·T-4-014 투입"),
    ("9/5 15:51", "PR #72(T-4-006 domain: career-13 3시즌 fixture·불변 property 200 seed·결정 예산·Snapshot 크기)·PR #73(T-4-013) 도착, 검증 체인 병렬 시작. 감사 재검증 종결(확인 22건·반박 9건), D-60 정정, 브리프 T-4-012·015·016·017"),
    ("9/5 16:30", "PR #72 머지(T-4-006 domain: career-13 3시즌 fixture·불변 property·결정 예산·Snapshot 크기). T-4-012(감사 domain 수정, D-60) 투입. 16:02 D-61(새 테스트 작성 보류)"),
    ("9/5 16:38", "PR #73 머지(T-4-013). T-4-010→PR #74, T-4-008→PR #75(REST 개설), T-4-011→PR #76(워커 중단분 오케스트레이터 커밋). 검증은 load 40 미만 게이트 순차 큐"),
    ("9/5 16:45", "PR #75 머지(T-4-008 콘텐츠 팩 0.3.0: Phase 4 이벤트 12종·포지션 챕터 3종·500 seed 도달성). T-4-015(content 감사 수정) 투입"),
    ("9/5 16:48", "PR #74 머지(T-4-010 e2e 간헐 실패 안정화·INTEREST 고정 seed·CI 실패 아티팩트)"),
    ("9/5 16:50", "PR #76 머지(T-4-011 SCR-020 잔류 결과 STAY 카드·redirect 튕김 제거). T-4-016(web 문구 C8·F5) 투입. 검증 큐 3건 종료"),
    ("9/5 16:56", "T-4-014 워커 완료 PR #78(step 7 전부 거절 문구·휴대폰 탭 시장 사유) 검증 큐. 360px 스크린샷 검토 중 offers eyebrow 고정 문구 발견 → T-4-018 브리프"),
    ("9/5 17:00", "main 통합 회귀 발견: #74 e2e 헬퍼 정규식 × #76 STAY URL `&interested=` → season.spec:121 결정적 실패. 핫픽스 T-4-019 투입, PR #78·#79 검증 큐 보류. T-4-016 완료 PR #79"),
    ("9/5 17:18", "PR #81(T-4-019 핫픽스) 머지 → main 회귀 해소. T-4-020 완료 PR #80. 검증 큐에 앞 PR 머지 대기 게이트 추가, #80→#78→#79 순차 검증"),
    ("9/5 17:28", "PR #80(T-4-020 injury.spec 레이스 핫픽스) 머지. 검증 큐 #78→#79 진행"),
    ("9/5 17:35", "PR #78 2차 체인: season.spec:17(랜덤 seed) STAY→프리시즌 잔여 실패 → 핫픽스 T-4-021 투입, 큐 정지"),
    ("9/5 17:40", "T-4-015(content 감사) 완료 PR #82. SLUMP-011 임계 60 통일 수용, EVT-CON-010 RUMOUR 미도달은 D-52 백로그"),
    ("9/5 17:43", "T-4-021 완료 PR #83. 검증 큐 재시작 #83→#82→#78→#79. main CI·staging 배포 복구(01be661)"),
    ("9/5 19:01", "사용자·Codex 통합 PR #85(T-4-022) 머지: PR #78·#79·#82·#83·#84 통합 + T-4-012·T-4-018·T-4-005a/b/c 구현 + QA 기록·캡처 6장. main CI 성공, staging 배포"),
    ("9/5 19:50", "오케스트레이터 일시 중지(사용자 지시). 검증 큐 종료, T-4-012 워커 중단(커밋 보존), 워크트리 정리. 남은 것은 D-62 출시 게이트(사용자 결정)"),
    ("9/5 20:10", "PR #90(T-4-017 해시 probe career-12·13) 머지 `84709ec` — D-62 출시 게이트 1/3 종료"),
    ("9/5 20:25", "GitHub Actions 결제 한도로 main CI·staging 배포 중단(잡이 시작 안 됨) → 사용자 액션 U-017(한도 상향 또는 저장소 공개). 로컬 체인·워커는 계속"),
    ("9/5 20:40", "PR #94(T-4-024 elapsedSec 측정 준비) 머지 `232bc83` — 리뷰 후속 3건 반영. 출시 게이트 2/3 종료, 남은 것은 T-4-023 SCR-032 캡처"),
    ("9/5 21:36", "T-4-023 캡처로 P4-7 문구 게이트 확인(SCR-032 협회 관계 vs SCR-014 에이전트 관계) → D-66, T-4-028 문구 2줄 워커 투입(사용자 세션 T-4-025~027과 번호 충돌로 재번호)"),
    ("9/5 21:47", "PR #98(T-4-028 대표팀 agent 축 문구) 머지 `452d32d`. T-4-023(캡처 PR)은 마무리 워커가 체인·PR 진행 중"),
    ("9/5 21:55", "PR #100(T-4-023 대표팀 자연 플레이 캡처) 머지 `42046ef` — D-65 출시 게이트 3/3 종료, Phase 3·4 게이트 종결. 남은 것은 사용자 항목(U-017 runner·U-014·U-015·U-005)과 Phase 5 PR #77"),
    ("9/5 23:07", "사용자 PR #92(Phase 3 잔여 진행 안내·결산 원인 설명)·#99(preview cleanup 오류 보고) 머지. 21:58 #91(스테이징 UI 이슈 #86~#89)"),
    ("9/5 23:22", "PR #102 CI 정리: PR은 quick checks만, staging 배포는 main에서만 — self-hosted runner(PR #96) 위. 이 시점부터 코드 PR은 전부 사용자 세션(Codex·Sol·Luna)"),
    ("9/6 09:46", "PR #103 Phase 5 통합 머지(#77 대체): 선수 생성·게임 연출·Legacy 1.1·한국 모듈, T-5-001~008 종결. 10:01 PR #106 배포 후 인수 검증(staging·expanded 실제 은퇴·보관·재로드). 후속 이슈 #104·#105"),
    ("9/6 11:57", "PR #107 수동 Production Release 워크플로(가드·D1 검사) 준비 → 12:14 #108 시즌 1 무기한 운영 시즌(svc_season_1, isTest=false, 종료일 없음)·문의 이메일(U-010 해소) → #109·#110 D1 릴리스 검사 수정"),
    ("9/6 12:33", "첫 운영 배포 성공(Production Release run 34009144236, 82a46fc) — SEASON 1: KICKOFF 출시. 12:40 PR #111 출시 기록"),
    ("9/6 13:11", "PR #112 Google 로그인 운영 연결(개인 GCP offside-football-prod, U-003 완료) → 13:15 운영 배포(run 34010879775). 13:29 #114 재인증 시 미동기화 진행 보존"),
    ("9/6 17:46", "운영 3회 플레이 QA(Luna, 커리어 A/B/C: 실패 뒤 회복·성인 진로 전환 약함) → PR #115 시즌 1 게임성 개선(19세 시작·성인 진로, 룰셋 1.3.0·팩 0.5.0 운영 활성). 17:52 #116 스모크 안정화"),
    ("9/6 19:49", "PR #117 공개 가이드·opt-in SEO → 19:53 #118 offside-lab.com 도메인 연결(U-001 완료, legacy workers.dev 로그인 호환) → 20:02 #119 공개 검색 허용"),
    ("9/6 21:51", "PR #120 밝고 정돈된 스포츠 앱 UI/UX 개편. 22:10 #121 홈 허브 소식·피드백, 22:25 #122 staging·production 두 환경으로 정리(expanded 제거)"),
    ("9/6 23:09", "UX 묶음 머지: #127 expanded 참조 정리, #123 설정 푸터(UX-002), #124 앱 버전(UX-005), #128 구단 이름(UX-001), #129 FOUC 제거, #125 접이식 설정(UX-003), #126 포인트 색상(UX-004). 23:32 #130 플래그 브랜드"),
    ("9/7 00:10", "PR #131 앱 셸 전환(UX-006, 100dvh 고정 프레임·내부 스크롤)"),
    ("9/7 01:11", "PR #134 커리어 홈 탭 정보형 대시보드(UX-007). 01:15 #132 결과 화면 태그 ID 노출 제거·#133 TeamBadge(UX-008)·#135 시네마틱 인트로(UX-009)"),
    ("9/7 01:45", "#136 홈 탭 정리·#137 api health CORS 수정·#138 트레이딩 카드(UX-011)·#139 결과 서사 헤드라인(UX-010) 머지 → 01:51~01:52 Production Release 2회 성공(939fe48)"),
    ("9/7 오전", "Claude 세션 복귀(문서 전담): 9/5 밤~9/7 새벽 사용자 세션 출시 기록을 보드·결정 로그·현황판에 반영. Phase 5·6 완료, Phase 7 진행 중으로 표기"),
    ("9/7 12:48", "운영 3관점 플레이 리뷰 완료(Sonnet 서브에이전트 3명 + ego-browser, 디자인 1시즌·게임성 6시즌·기능 2시즌): 성인 진로 전환 개선 확인, 무출전 회복 P1 2건·P2 7건·P3 7건. 이슈 등록은 사용자 결정"),
    ("9/7 13:47", "운영 6케이스 플레이 리뷰 완료(Sonnet 서브에이전트 6명 + ego-browser, GK·CB·WG·CM·ST 8시즌 ×5 + DM 자연 은퇴 17시즌): 무출전 고착 5/6·협상 버튼 무결과 4/6·enum 4/6·#105 3/6 재확인, 결산 표 모순·승격 표기 불변 신규, 노쇠·은퇴·Legacy 정상. P1 2·P2 8·P3 10"),
    ("9/7 14:10", "두 리뷰의 개선 포인트 33건을 이슈 #140~#172로 등록(P1 #140·#141, P2 #142~#152, P3 #153~#172), #104·#105 QA 코멘트. 배정은 사용자 결정"),
    ("9/7 14:50", "1차 웨이브 브리프 T-7-001~010 작성(P1 #140·#141 + P2 #142·#143·#105·#144·#146·#149·#150·#151·#152). D-67 룰셋 1.4.0 회복 규칙·D-68 승격권 문구·D-69 협상 결과 표시. 투입은 사용자 승인 뒤"),
    ("9/7 14:51", "사용자 승인 → 1차 웨이브 Sonnet 5 워커 6명 투입(T-7-001 룰셋 1.4.0, T-7-004 협상 결과, T-7-005 라벨, T-7-006 액션 독, T-7-008 Enter 선택, T-7-009 대표팀 결과). 검증·머지는 오케스트레이터"),
    ("9/7 17:05", "1차 웨이브 워커 6명 완료 → PR #173(T-7-001)·#174(T-7-004)·#175(T-7-005)·#176(T-7-006)·#177(T-7-008)·#178(T-7-009). 훅이 gh pr create를 막아 오케스트레이터가 REST로 개설"),
    ("9/7 17:11", "origin/main 전체 e2e baseline 60/110 실패 확인(9/6 UX 개편 이후 드리프트 + axe 위반 12건) → 이슈 #179·#180, D-70 과도기 판정 규칙"),
    ("9/7 17:20", "핫픽스 T-7-011(e2e 정합)·T-7-012(eyebrow 대비)·T-7-013(제안 비교 dl) 투입. PR #173·#177·#176·#178 체인 순차 검증, #174·#175 리뷰 후속 워커"),
    ("9/7 17:21", "PR #173 머지(ab8a88b, 룰셋 1.4.0 데이터, e2e 실패 집합 baseline과 동일) → T-7-002 도메인·T-7-003 QA seed 워커 투입(1차 웨이브 b, 포트 5262·5263, 워커는 단위 검증까지만)"),
    ("9/7 17:32", "PR #177 머지(58ab25a, RadioGroup Enter 선택). 체인 녹색, e2e 새 실패 1건은 부하 플레이크 판정(D-70), 실제 브라우저에서 Enter·Space·화살표 확인. 이슈 #149 닫힘"),
    ("9/7 17:35", "PR #176 머지(1da6a50, 액션 독 페이드·그림자·불투명 배경·scroll-padding). e2e 새 실패 0, 360px before/after 관찰. 이슈 #146"),
    ("9/7 17:58", "1차 웨이브 b 워커 완료 → PR #181(T-7-002 도메인 회복 규칙, 골든 불변)·#182(T-7-003 QA 시즌 seed). #175 체인 녹색, #174는 주석 hex 검사 위반 수정(c04c925) 뒤 재실행, #178 부하 타임아웃 재실행"),
    ("9/7 18:03", "PR #175 머지(a194efa, 관계 사유·챕터 TAG·결산 표 라벨). 이슈 #105·#142·#143 닫힘. 360px 시즌 완주로 결산 표 4행·라커룸 확인 → T-7-010(승격권 문구) 투입"),
    ("9/7 18:11", "PR #178 머지(3101d6c, 대표팀 챕터 결과 요약). 재실행 체인 녹색, e2e 새 실패 0, jsdom 독립 렌더 확인. 이슈 #150 닫힘"),
    ("9/7 18:15", "T-7-010 완료 → PR #184, T-7-012 워커가 PR #183 개설. #174 체인은 단위 테스트 부하 플레이크(대표팀 시드 120s 타임아웃)로 중단 → 남은 단계만 재개, 체인 큐 #174→#181→#182→#184→#183"),
    ("9/7 18:28", "PR #174 머지(b76104a, 협상 결과 배너·사유 캡션·결과 패널 포커스, D-69). e2e 새 실패 2건은 main 재현으로 이슈 #180. 이슈 #141 닫힘 → T-7-007(서명 프리필·제안 카드) 투입"),
    ("9/7 18:32", "PR #181 머지(630637b, 룰셋 1.4.0 회복 규칙 도메인: 역할 수락 계약 반영·하향 거절 무벌점·미이행 로그 보존, 1.3.0 재생 불변). e2e 새 실패 0"),
    ("9/7 19:56", "T-7-013 완료 → PR #185(워커 개설). #182 체인 e2e 기동 타임아웃(load 200+) → e2e만 재큐. 체인 큐 #184→#183→#182→#185, T-7-007·T-7-011 워커 진행 중"),
    ("9/7 20:07", "PR #184 머지(16e0a98, 승격→승격권 문구 정합, D-68). 이슈 #144 닫힘(리그 이동은 Phase 8 후보로 보류)"),
    ("9/7 20:09", "T-7-007 완료 → PR #186(REST 개설). #183 eyebrow 대비 360px 측정(라이트 4.40→10.66:1). 체인 큐 #183→#182→#185→#186"),
    ("9/7 20:12", "PR #183 머지(5e5e2c4, eyebrow 캡션 --os-accent, check:contrast 쌍 추가). e2e color-contrast 실패 9건 해소, 새 실패 0. #186 리뷰 후속 워커 투입"),
    ("9/7 20:18", "PR #182 머지(323adad, 로컬 QA 시즌 seed svc_recovery_rules_qa). 1.4.0 회복 규칙 데이터·도메인·seed 모두 main. #140은 QA 플레이 확인 뒤 닫음"),
    ("9/7 20:26", "PR #185 머지(2074303, SCR-009 dl 구조). e2e 새 실패 0·a11y:303 통과. 남은 체인 #186, 워커 T-7-011"),
    ("9/7 20:33", "PR #186 머지(241d275, 서명 프리필·결정 기한 셀). 1차 웨이브 T-7-001~010 전부 머지. 이슈 #151·#152 닫힘, 잔여 UI → #20:33 #186(T-7-007 서명 프리필·결정 기한 셀)도 머지했습니다(241d275) — 이로써 1차 웨이브 T-7-001~010이 전부 main에 들어갔고 이슈 #151·#152를 닫았습니다(잔여 UI 2건은 #188). 남은 것은 핫픽스 T-7-011(워커가 spec별 재검증 중)과, 사용자 지시(20:30)에 따른 운영 배포(코드만, 시즌 룰셋은 1.3.0 유지)입니다. . 남은 P1: T-7-011 → 운영 배포(사용자 지시)"),
    ("9/7~", "Phase 7 운영·밸런스: 1차 웨이브 T-7-001~010 투입(사용자 승인) → 검증·머지 → 로컬 QA 시즌에서 1.4.0 회복 규칙 플레이 확인 → 운영 시즌 1.4.0 승격은 사용자 결정. 2차 웨이브 #145·#147·#148, P3 #153~#172, 이슈 #104, Google 브랜딩 인증, Search Console·네이버 등록, staging 룰셋·팩 승격(1.3.0/0.5.0), 실사용자 플레이 시간 측정(D1), U-014 Workers Paid·U-004 Sentry·U-005 종이 플레이테스트. Phase 8 WORLD STAGE는 그 뒤"),
]
DECISIONS = [
    ("D-71 P1 마무리 뒤 운영 배포, 코드만(9/7 20:30, 사용자 지시)", "남은 P1 #179(T-7-011) 머지·게이트 복원 뒤 최종 main SHA로 preflight → DEPLOY_PRODUCTION(입력은 9/7 01:52 배포와 동일: 시즌 시작 2026-09-05T15:00:00Z, 종료 비움, cs_season_1). 릴리스 워크플로가 시즌 manifest 1.3.0/0.5.0을 하드코딩 검사하므로 코드만 올리고 운영 룰셋은 1.3.0 유지 — 1.4.0 승격은 별도 작업·사용자 승인. 20:34 main 5086ad0 preflight 실행."),
    ("D-70 e2e 드리프트 핫픽스·과도기 판정(9/7 17:15)", "전체 e2e가 origin/main에서 60/110 실패(9/6 UX 개편 이후 헬퍼·기대 드리프트 ~48건 + axe 위반 12건, CI는 스모크만). 핫픽스 T-7-011(e2e 정합, 완화 금지)·T-7-012(eyebrow 대비)·T-7-013(dl 구조) 투입. 머지 전까지 PR 체인은 baseline 대비 새 실패 없음 + 단위 테스트 + 화면 확인으로 판정, 이후 전체 그린 게이트 복원. CI에 전체 e2e를 넣을지는 사용자 결정(#179)."),
    ("리뷰 후속 1차 웨이브 브리프 T-7-001~010(9/7 14:50, 사용자 지시)", "D-67 룰셋 1.4.0: 무출전 고착의 코드 원인 4가지(회복 제안 2시즌 조건, 미이행 시 선수 신뢰 -8, 역할 수락이 계약에 안 남음, 하향 거절 -8)를 1.3.0 복사본 + 선택 키로 고치고 도메인은 키 존재로 가드(1.3.0 재생 불변). 운영 승격은 사용자 결정. D-68 승격은 순위 기록 — 문구를 승격권으로, 리그 이동은 Phase 8 보류. D-69 협상 결과는 항상 패널로, 비활성 버튼은 사유 표시. P2 #145·#147·#148은 도메인 파일 충돌로 2차 웨이브."),
    ("운영 6케이스 플레이 리뷰(9/7 오후, 사용자 요청)", "Sonnet 서브에이전트 6명이 포지션·성별·국적·출발 카드·전략을 직교로 배치한 6개 프로필로 offside-lab.com을 플레이(QA2*0907 커리어 6건, 선수 생성은 mkdir 잠금으로 직렬화, 기존 기록 미접촉). 결론: 핵심 루프 6/6 완주, 자연 은퇴·Legacy 정합. 무출전 고착 5/6은 '원소속 잔류 중에는 회복 수단 없음, 임대·이적으로만 회복'으로 좁혀짐. 판정 조정: 팀명 중복은 innerText 아티팩트, 계약 기간 불일치는 마지막 시즌 사전 갱신 설계, enum P1은 P2 유지. 이슈화는 사용자 결정."),
    ("운영 3관점 플레이 리뷰(9/7 오후, 사용자 요청)", "Sonnet 서브에이전트 3명이 각자 ego-browser 작업공간에서 offside-lab.com을 플레이(QA*0907 커리어 3건, 기존 기록 미접촉). 결론: 핵심 루프 정상·콘솔 오류 0, PR #115 성인 전환 개선, 무출전 회복 부재는 여전(P1 2건). 디자인 P1 CTA 가림은 P2로 조정, 다른 세션 데이터 노출은 같은 프로필 공유에 따른 환경 충돌로 분류. 이슈화는 사용자 결정."),
    ("Phase 5·6 종결·Phase 7 진행 표기(9/7 오전, 이 세션)", "보드에 Phase 5 백로그(T-5-001~008 완료)·Phase 6 출시 항목·Phase 7 운영 항목 표를 추가. 사용자 세션 작업은 새 T- 번호를 만들지 않고 PR 번호(UX-xxx)로 기록해 번호 충돌을 피한다. Phase 2~7 상태는 표 집계 대신 출시·운영 기록으로 고정(생성기 PHASE_OVERRIDE)."),
    ("LINE TEST 대신 시즌 1 공개 출시(9/6, 사용자)", "별도 테스트 시즌 없이 svc_season_1을 isTest=false·종료일 미정으로 운영에 열었다(PR #108). U-015 테스터 모집은 대체되고 line-test-plan은 staging 예행·측정 쿼리 절차로만 남는다. staging은 아직 svc_line_test(1.0.0/0.1.0)."),
    ("운영 릴리스는 수동 워크플로(9/6, PR #107)", "main 푸시는 최소 검사→staging 배포→스모크까지만. 운영은 Production Release 워크플로를 사용자가 수동 실행(가드·D1 검사 #109·#110). 첫 배포 9/6 12:33, 재배포 9/7 01:51~01:52. docs-only 푸시는 검사·배포 생략."),
    ("두 환경만 유지(9/6, PR #122·#127)", "expanded 환경 삭제. staging(offside-staging D1)·production(offside-production D1)만 남기고 참조 정리. T-4-027 expanded QA 격리(PR #95)는 역할을 마침."),
    ("도메인 offside-lab.com(9/6, PR #118, U-001)", "web offside-lab.com·api api.offside-lab.com. legacy workers.dev 로그인 호환을 유지하고, 공개 검색은 커스텀 도메인 로그인 검증 뒤 허용(PR #119). Search Console·네이버 등록은 후속."),
    ("Google 로그인 운영(9/6, PR #112·#114, U-003)", "개인 GCP 프로젝트 offside-football-prod OAuth로 운영 연결. 실제 최초 연결·재로그인·기존 기록 보존 확인. 재인증 중 미동기화 진행은 보존(#114). 브랜딩 인증은 후속."),
    ("시즌 1 게임성 개선 1.3.0(9/6, PR #115)", "운영 3회 플레이 QA(커리어 A/B/C) 결론 — 실패 뒤 회복·성인 진로 전환이 약함 — 에 따라 19세 시작·성인 진로 진행을 개선하고 룰셋 1.3.0·팩 0.5.0을 운영 활성. 시즌 1 진행 중 룰셋 교체를 허용한 사용자 결정."),
    ("Phase 5 통합 PR #103(9/6 09:46, 사용자)", "PR #77 보류를 풀고 선수 생성·게임 연출·Legacy 1.1·한국 모듈을 한 PR로 통합. 합성 grade 비율은 관찰 목표(hard gate 아님), 저장 호환성·포지션 공정성·Archive 고득점 도달성·population 무결성은 필수. 후속 이슈 #104·#105."),
    ("CI 최소화(9/5 23:22, PR #102)", "PR은 quick checks만 돌리고 staging 배포는 main에서만. Mac self-hosted runner(PR #96, U-017 완료) 위에서 돈다. 9/5 밤부터 코드 PR은 사용자 세션이 열고 머지하며 Claude는 문서·CI 검토만."),
    ("오케스트레이터 인계·Luna Max 전용", "Claude 세션 ec0b55e0…은 T-3-003 뒤 정지. Codex는 docs·배정·리뷰·검증·머지만 담당하고 구현·테스트 코드는 Orca gpt-5.6-luna reasoning max 워커에게만 맡긴다."),
    ("PR #54 리뷰: 이적·임대 P1 세 건", "태그 제거 전 배신 판정, LOAN의 약속 위반 이동 페널티 제외, 임대 만료 자동 FA의 원소속 상태 복원을 수정. golden revision/draw 변화와 career-11 계약 3시즌은 기능 요구로 수용하고 transferFee 표시는 T-3-005로 이관."),
    ("PR #48 리뷰: contract.isLastSeason 정정", "ADR-010 유도식에서 진행 중 마지막 시즌의 잔여는 0이므로 season !== null && remaining === 0일 때만 1(브리프의 <= 1은 오류). stepSummaries 11개 유지, followUp도 presentation 제외, 골든 멀티라인 수용."),
    ("T-3-002·T-4-001·T-3-006 브리프 결정", "T-3-002는 생성기까지(결산 배선·명령은 T-3-003, step 7 제안은 미응답 만료 임시), 안전 잔류는 현 구단, 관계 이월 값은 transferRules.relationshipCarry. T-4-001 HEALTH Effect는 SUM·즉시·만료 없음, 기본 감독은 rng 없이, 훅 골격 선배치. T-3-006 팩 0.2.0은 등록만(활성 0.1.0 유지), PROTOTYPE authoring 필드, 팀 4개 추가."),
    ("ADR-010 승인·LINE TEST 준비(U-012·U-013, D-54·D-55)", "사용자가 ADR-010 설계를 승인하고 이벤트 문구 PROTOTYPE 작성(A)·가상 구단 12개를 결정. 서비스 시즌 포인터는 API 환경 변수, 테스트 시즌은 is_test, 분석 이벤트는 platform 큐 → D1 화이트리스트."),
    ("PR #47 리뷰: Phase 2 완료 조건 9/9", "리뷰 수정 0건. truePotential ≥ baseOvr+1 불변식(roll 순서 불변, golden 2종 갱신), 워커 타임아웃 요청당 예산, career-03 비교 대상을 2-slot 구조상 COMP-W-2로 고정, 세션 자동화 수 초 — 사람 기준 6/12분 판정은 U-005와 합쳐 오케스트레이터 몫."),
    ("Phase 순서 준수", "Phase 0을 닫은 뒤 Phase 1 워커 투입. 브리프는 미리 작성."),
    ("머지 위임", "리뷰 통과 시 오케스트레이터가 바로 squash 머지."),
    ("Phase 1 설계 결정 D-1~D-18", "포지션 8종·아키타입 24·배경 3·Base OVR golden 59·복구 코드 형식·이벤트 제시 방식."),
    ("동기화 충돌·설정 데이터 D-19·D-20", "'이 기기 진행 유지'는 명령 로그를 새 커리어로 재실행(fork-by-replay). 복구 뒤 서버 목록으로 로컬 대조. 복구 코드 다시 보기는 없음(해시만 저장)."),
    ("Google 연결·완료 판정 D-21·D-22", "arctic + 가짜 OIDC로 U-003 전에도 E2E. 완료 조건 13행 표, 5분 세션은 자동화 시간으로 판정, LCP·CLS는 기록만."),
    ("브리프 15개 전부 작성", "투입 순서: T-1-007 → 008·009 → 011 → 012 → 013·014."),
    ("PR #25 리뷰: 복구 코드 발급 400", "apiFetch가 body 없는 POST에 Content-Type을 안 붙여 서버 bodyGuard가 거부. 워커의 '일시적 400' 설명을 재현으로 반박하고 수정 후 머지."),
    ("PR #39 리뷰: 경기 계산·D-37", "matchRngState를 결정 스트림 복사 대신 해시 파생 시드로, yellowSuspensionAt 5 복원(강제 카운트 테스트), PR #38 후속으로 career-04-gk를 contracts·api 검증에 추가해 머지. 수용: 부상 1~4경기, 리그 순위 기대 승점 근사, 컵 무승부 진출."),
    ("Wave 3 브리프 D-38·D-39", "챕터: 경기 계산 직후 훅, chapterCandidates·trigger 5종, RESOLVE_CHAPTER 판단당 roll 1회, 평점 delta·CURRENT/RELATION만. 결산: SeasonResult hash, 연령대 예산×잠재력 gap×출전 계수+경험, 훈련 초점, carry centi, 잠재력 cap, 시즌 중 폼·체력·사기 갱신, 밸런스 테스트로 상수 조정."),
    ("Wave 3 리뷰: DEFERRED 시즌 적용", "미룬 효과는 START_SEASON에서 season.scheduledEffects로 옮겨 그 시즌 step에 적용(유실·같은 시즌 오적용 방지). 성장 상수 75/65/8 확정, player.ts 잠재력 불변식은 T-2-011."),
    ("Phase 3·4 계획 D-43~D-53", "팀 변경은 결산 뒤 시장에서만, Offer v2·협상 1회·안전 잔류, ACCEPT_OFFER 원자 전환, 임대 1시즌, 부상 심각도·재활·재발·후유증 확정 시점, 관계 로그·감독 교체·평판, 대표팀 기본 모듈, 새 명령은 CMD-CON-001~004뿐, 트랙별 파일 소유권."),
    ("PR #44 검증: e2e 결함 2건", "리뷰는 통과했으나 부하 아래 e2e 실패를 trace로 확정 — 공용 locator의 이중 클릭이 결산하기로 새는 TOCTOU, 시드에 따라 0분 시즌이면 데뷔 챕터가 안 열림. 수정(exact locator·step 변화 대기, DEV 전용 e2e 시드 훅) 뒤 머지."),
    ("D-38 확정: 챕터", "후보는 ADVANCE.chapterCandidates로, 출전한 경기만, FAST는 MAJOR만. CHAPTER pending은 RESOLVE_CHAPTER로만 닫힘. tier1~3 리그 라이벌/승격 상수는 임시값, DEBUT는 첫 시즌만(후속)."),
    ("D-40~D-42 공유 계약(ADR-010)", "Effect kind→타깃 소유권·ONCE_PER_SEASON·시즌 만료·REPLACE 복원, 시장가치 입력 소유권(truePotential 배제), CareerTag 16종 ownerPhase. 워커 작성본이라 사용자 승인 대기(U-012)."),
    ("PR #37 리뷰: 역할 제안 도달성·D-36 정수 상태", "POSITION_CHANGE 후보 필터가 실제 룰셋에서 항상 false였던 것(브리프 모호), RESOLVE_ROLE 뒤 squadRole·selection 불일치, fixtures export 누락을 고쳐 머지. 저장 상태는 정수만(D-36), 아키타입 +40의 밸런스 리스크는 T-2-011 측정 항목."),
    ("PR #36 리뷰: 시즌 구조·D-34·D-35", "FAST 예산이 모드가 열지 않는 슬롯까지 세어 MAJOR 챕터를 잘랐던 것, 시즌 walk 효과 만료 누락, 결산 뒤 nextAction, engine-client 최소 수정을 고쳐 머지. T-2-002(전술·역할 제안·경쟁자)·T-2-003(경기 계산 순서) 상세를 D-34·D-35로 확정."),
    ("Phase 3 이후 병렬화 D-32", "Phase 2까지 순차. 공유 계약(Effect·시장가치·태그) 확정 뒤 Phase 3·4 병렬, 그 위에 5·6 병렬. Phase 2 계획 T-2-001~014 초안."),
    ("Phase 1 종료·D-33", "PR #35로 완료 조건 미구현 5건 해소, #12는 오케스트레이터 수동 점검(폐기 어휘·hex 리터럴 0건). Phase 2 열린 질문은 계획의 제안대로 확정(리그 2회전·컵 4라운드·경쟁자 60/40·Snapshot 크기 T-2-006 측정)."),
    ("PR #34 리뷰: 완료 조건 표 15행, Phase 1 종료 보류", "키보드 완주가 조건부(SCR-002 포지션 탭이 RadioGroup 중첩으로 Tab 도달 불가 — 출시 차단 기준), 선호 포지션 미표시, 국외 이전 표 미기재, 결과 aria-live·COMMITTING 이탈 경고 없음. T-1-017로 묶어 투입, 머지 뒤 Phase 1 종료."),
    ("PR #33 리뷰: Google 연결 수정 요청 0건", "state·PKCE 쿠키, 병합 대기 TTL·재검증, 삭제 시 sub 비움, 채널 기능 플래그를 확인. 실 api recovery-api 스펙이 PR #32 성별 필수화로 깨진 것을 발견해 T-1-014에 배정. 로그아웃 뒤 커리어 소유자 불일치는 T-2-011 후속."),
    ("PR #32 리뷰: 성별 불변식·golden", "성별이 RNG·능력·이벤트·계약을 바꾸지 않음을 golden(stateHash만 변경)과 content 불변식 테스트로 확인. gender는 분석·로그·오류 details에 없음. 수정 요청 0건."),
    ("PR #31 리뷰: 대조 부분 실패·캐시 갱신", "복구 뒤 서버 커리어 대조가 일부 실패해도 성공 토스트가 뜨던 것을 실패 집계로, 목록 조회 실패 시 프로필 캐시 미갱신을 수정. 워커 질문(리뷰 지적 처리 방식)에 문구 수정 + '다시 연결' 대조 확장으로 답함."),
    ("PR #26 리뷰: 실패 표시·아키타입 한글명·중복 정리", "진행·다음의 실패를 조용히 삼키던 곳 2군데를 ErrorState로, 룰셋 이중 파싱·능력치 라벨 3중 정의를 통합. 재검증에서 e2e 타입 오류·시드 의존 플레이키 추가 수정."),
    ("PR #30 리뷰: 저장 배지·401 삭제·CORS", "새로고침 뒤 '아직 저장 안 됨' 오표시를 로컬 레코드로 보정, 세션 없는 삭제는 큐에 유지, X-Request-Id preflight 허용(범위 확장). 워커의 대체 typecheck 명령 보고는 재검증에서 되돌려 보냄."),
    ("콘텐츠 정본 PR #24", "사용자가 docs/content/kickoff/ 6종을 머지. SHIPPABLE 전에는 개발 작업을 만들지 않는다(Phase 2 입력)."),
    ("룰셋은 데이터", "packages/content/rulesets/1.0.0, 도메인은 입력으로 받고 해시에는 넣지 않음."),
]

def esc(s): return html.escape(s)

CSS = """
:root{
  --bg:#F4F5EF;--surface:#FFFFFF;--surface-2:#ECEDE4;--border:#D5D7CB;--text:#141A17;--text-2:#57625C;
  --accent:#F5C400;--on-accent:#0B1410;--line:#0E7C8A;--success:#1E7B45;--warning:#8A5A00;--danger:#B3261E;
  --pill-done-bg:#DCEFE3;--pill-active-bg:#FFF3B8;--pill-todo-bg:#ECEDE4;--pill-blocked-bg:#F6DEDC;
  --font:'Pretendard Variable',Pretendard,'Noto Sans KR',-apple-system,'Apple SD Gothic Neo',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0B1410;--surface:#121C17;--surface-2:#1A2620;--border:#2A3A32;--text:#EDEFEA;--text-2:#A6B0AA;
  --line:#3FB8C6;--success:#5CC080;--warning:#E0A93A;--danger:#EF7A72;
  --pill-done-bg:#173A27;--pill-active-bg:#4A3B00;--pill-todo-bg:#1A2620;--pill-blocked-bg:#4A1F1C;
}}
:root[data-theme="dark"]{
  --bg:#0B1410;--surface:#121C17;--surface-2:#1A2620;--border:#2A3A32;--text:#EDEFEA;--text-2:#A6B0AA;
  --line:#3FB8C6;--success:#5CC080;--warning:#E0A93A;--danger:#EF7A72;
  --pill-done-bg:#173A27;--pill-active-bg:#4A3B00;--pill-todo-bg:#1A2620;--pill-blocked-bg:#4A1F1C;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--line);text-decoration:none;border-bottom:1px solid transparent}
a:hover,a:focus-visible{border-bottom-color:currentColor;outline:none}
:focus-visible{outline:2px solid var(--line);outline-offset:2px}
code{font-family:var(--mono);font-size:.85em;background:var(--surface-2);padding:1px 5px;border-radius:3px}
.wrap{max-width:1120px;margin:0 auto;padding:28px 20px 64px}
header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:3px solid var(--line)}
.wordmark{font-weight:900;letter-spacing:.12em;font-size:13px;color:var(--text-2);margin:0 0 6px}
h1{font-size:30px;line-height:1.2;margin:0;font-weight:800;text-wrap:balance}
.meta{font-family:var(--mono);font-size:12.5px;color:var(--text-2);text-align:right;line-height:1.7}
.meta strong{color:var(--text);font-weight:500}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);padding:5px 12px;font-size:14px;border-radius:999px}
.chip b{font-variant-numeric:tabular-nums}
.chip.warn{border-color:var(--danger);color:var(--danger)}
.now{margin:16px 0 0;padding:16px 20px;background:var(--surface);border-left:5px solid var(--accent);font-size:17px;line-height:1.65;max-width:78ch;text-wrap:pretty}
h2{font-size:20px;margin:0 0 4px;font-weight:800;text-wrap:balance}
.sub{font-size:14px;color:var(--text-2);margin:0 0 14px}
section{margin-top:40px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px}
@media (max-width:860px){.cols{grid-template-columns:1fr}}
/* 로드맵 */
.road{display:grid;grid-template-columns:repeat(8,minmax(128px,1fr));gap:8px;overflow-x:auto;padding-bottom:6px}
@media (max-width:1000px){.road{grid-template-columns:repeat(4,minmax(150px,1fr))}}
@media (max-width:640px){.road{grid-template-columns:repeat(2,minmax(140px,1fr))}}
.ph{background:var(--surface);border:1px solid var(--border);border-top:4px solid var(--border);padding:12px 12px 10px;min-width:0}
.ph.done{border-top-color:var(--success)}
.ph.active{border-top-color:var(--accent)}
.ph .n{font-family:var(--mono);font-size:12px;color:var(--text-2);letter-spacing:.04em}
.ph .t{font-weight:800;font-size:15px;line-height:1.3;margin:2px 0 6px;text-wrap:balance}
.ph .m{font-size:12.5px;color:var(--text-2);line-height:1.45;margin-top:6px;min-height:2.8em}
.ph .c{font-family:var(--mono);font-size:12px;color:var(--text-2);margin-top:6px;font-variant-numeric:tabular-nums}
.bar{position:relative;height:8px;background:var(--surface-2);border:1px solid var(--border);margin-top:8px;overflow:hidden}
.bar > i{display:block;position:absolute;top:0;bottom:0;left:0}
.bar .d{background:var(--success)}
.bar .a{background:var(--accent)}
.bar .b{background:var(--danger);opacity:.6}
.legend{display:flex;gap:16px;font-size:13px;color:var(--text-2);margin-top:8px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;vertical-align:-1px;margin-right:5px}
/* 워커 */
.workers{display:grid;gap:12px}
.worker{background:var(--surface);border:1px solid var(--border);border-left:5px solid var(--accent);padding:14px 16px}
.worker .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px}
.worker .tid{font-family:var(--mono);font-size:14px;font-weight:600}
.worker .pkg{font-family:var(--mono);font-size:12px;color:var(--line)}
.worker p{margin:6px 0 0;font-size:15px}
.worker .st{margin-top:8px;font-size:13.5px;color:var(--text-2)}
/* 할 일 */
.todo{display:grid;gap:10px}
.todo .item{background:var(--surface);border:1px solid var(--border);border-left:5px solid var(--danger);padding:12px 16px}
.todo .item .head{display:flex;align-items:baseline;gap:10px}
.todo .item .tid{font-family:var(--mono);font-size:13px;color:var(--danger);font-weight:600}
.todo .item p{margin:4px 0 0;font-size:15px}
.todo .item .why{font-size:13.5px;color:var(--text-2);margin-top:4px}
.empty{color:var(--text-2);font-size:15px}
/* 다음·오늘 */
.next{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.next li{background:var(--surface);border:1px solid var(--border);padding:10px 14px;font-size:15px;position:relative;padding-left:38px}
.next li::before{content:"→";position:absolute;left:14px;top:9px;color:var(--line);font-weight:700}
.timeline{list-style:none;margin:0;padding:0;border-left:2px solid var(--border);margin-left:6px}
.timeline li{position:relative;padding:0 0 14px 18px;font-size:14.5px}
.timeline li::before{content:"";position:absolute;left:-7px;top:8px;width:10px;height:10px;border-radius:50%;background:var(--success);border:2px solid var(--bg)}
.timeline li.future::before{background:var(--accent)}
.timeline .t{font-family:var(--mono);font-size:12.5px;color:var(--text-2);margin-right:8px}
.timeline .lead{font-weight:700}
.timeline .rest{color:var(--text-2);font-size:13.5px;display:block;margin-top:2px}
.prs{margin:0 0 12px;font-size:14px;color:var(--text-2)}
.prs a{font-family:var(--mono);margin-right:6px}
/* 펼쳐 보기 */
details{background:var(--surface);border:1px solid var(--border);margin-top:12px}
details > summary{cursor:pointer;padding:14px 18px;font-weight:700;font-size:16px;list-style:none;display:flex;align-items:baseline;gap:10px}
details > summary::-webkit-details-marker{display:none}
details > summary::before{content:"▸";color:var(--line);font-size:14px}
details[open] > summary::before{content:"▾"}
details > summary small{font-weight:400;font-size:13px;color:var(--text-2)}
details > .body{padding:0 18px 18px}
details.inner{border:0;border-top:1px solid var(--border);margin:0}
details.inner > summary{font-size:15px;padding:12px 0}
details.inner > .body{padding:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:12.5px;letter-spacing:.04em;color:var(--text-2);font-weight:500;padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}
tr:last-child td{border-bottom:0}
.tid{font-family:var(--mono);font-size:12.5px;white-space:nowrap}
.muted{color:var(--text-2);font-size:13px}
.tscroll{overflow-x:auto}
.pill{display:inline-block;font-size:12.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap;line-height:1.5}
.pill.done{background:var(--pill-done-bg);color:var(--success)}
.pill.active{background:var(--pill-active-bg);color:var(--warning)}
.pill.todo{background:var(--pill-todo-bg);color:var(--text-2)}
.pill.blocked{background:var(--pill-blocked-bg);color:var(--danger)}
.pill.part{background:var(--pill-active-bg);color:var(--warning)}
.layers{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.layer{border:1px solid var(--border);padding:12px 14px}
.layer h3{margin:0;font-size:14.5px;font-weight:700}
.layer h3 span{font-family:var(--mono);font-weight:400;font-size:12px;color:var(--text-2);margin-left:8px}
.layer ul{margin:8px 0 0;padding-left:18px;font-size:13.5px}
.layer li{margin:2px 0}
.layer .todo-list li{color:var(--text-2)}
.layer .cap{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2);margin-top:10px;font-weight:500}
.dec{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.dec div{border:1px solid var(--border);padding:12px 14px;font-size:13.5px}
.dec b{display:block;margin-bottom:4px;font-size:14px}
.gloss{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:6px 24px;margin:0;font-size:14px}
.gloss div{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)}
.gloss dt{font-family:var(--mono);font-size:13px;font-weight:600;margin:0}
.gloss dd{margin:0;color:var(--text-2)}
.gate{font-size:14px;color:var(--text-2);white-space:pre-wrap;line-height:1.7}
footer{margin-top:44px;font-size:13px;color:var(--text-2);border-top:1px solid var(--border);padding-top:14px}
@media (prefers-reduced-motion:no-preference){.bar>i{transition:width .4s ease}}
"""

def bar(c, total):
    d = c["done"] / total * 100 if total else 0; ac = c["active"] / total * 100 if total else 0; b = c["blocked"] / total * 100 if total else 0
    return f'<div class="bar"><i class="d" style="width:{d:.1f}%"></i><i class="a" style="left:{d:.1f}%;width:{ac:.1f}%"></i><i class="b" style="left:{d+ac:.1f}%;width:{b:.1f}%"></i></div>'

def phase_state(rows, name=None):
    if name and PHASE_OVERRIDE.get(name): return PHASE_OVERRIDE[name]
    if not rows: return "todo"
    c = counts(rows)
    if c["done"] == len(rows): return "done"
    if c["active"] or c["done"]: return "active"
    return "todo"

def lead_split(text):
    """타임라인 문장을 '굵은 앞부분 + 나머지'로 나눈다(첫 ':' 또는 첫 마침표 기준)."""
    m = re.search(r"[:：]\s", text)
    if m and m.start() < 70:
        return text[:m.start()], text[m.end():]
    m = re.search(r"\.\s", text)
    if m and m.start() < 70:
        return text[:m.start() + 1], text[m.end():]
    return text, ""

def render():
    p = []; a = p.append
    prs_today = [m for m in merges if m["date"] == now.strftime("%Y-%m-%d")]
    open_u = [u for u in uacts if u["status"] == "todo"]
    deferred_u = [u for u in uacts if u["status"] == "deferred"]
    done_u = [u for u in uacts if u["status"] in ("completed", "done")]
    cur_phase = next((n for n, _, sec, _ in PHASES if phase_state(phase_rows[n], n) == "active"), None)

    a(f"""<title>OFFSIDE 개발 현황판</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>{CSS}</style>
<div class="wrap">
<header>
  <div>
    <p class="wordmark">OFFSIDE · 축구 커리어 시뮬레이터</p>
    <h1>개발 현황판</h1>
  </div>
  <div class="meta">갱신 <strong>{esc(updated)}</strong><br>정본 <a href="{GH}/blob/main/docs/tracking/board.md" target="_blank" rel="noopener">board.md</a> · <a href="{GH}/blob/main/docs/tracking/decision-log.md" target="_blank" rel="noopener">결정 로그</a> · <a href="{GH}/pulls?q=is%3Apr" target="_blank" rel="noopener">PR 목록</a></div>
</header>
<div class="chips">
  <span class="chip">현재 <b>{esc(cur_phase or "-")}</b> 진행 중</span>
  <span class="chip">워커 <b>{len(active)}</b>명 작업 중</span>
  <span class="chip">오늘 머지 <b>{len(prs_today)}</b>건</span>
  <span class="chip{' warn' if open_u else ''}">사용자 할 일 <b>{len(open_u)}</b>건</span>
</div>
<p class="now">{esc(NOW)}</p>
""")

    # 1. 로드맵
    a('<section><h2>어디까지 왔나</h2><p class="sub">Phase 8단계 로드맵. 막대는 각 Phase 작업의 완료·진행·사용자 대기 비율입니다. 표가 없는 Phase는 출시·운영 기록으로 상태를 정합니다.</p><div class="road">')
    for name, title, sec, meaning in PHASES:
        rows = phase_rows[name]; st = phase_state(rows, name); c = counts(rows) if rows else None
        label = {"done": "완료", "active": "진행 중", "todo": "예정"}[st]
        a(f'<div class="ph {st}"><div class="n">{esc(name)}</div><div class="t">{esc(title)}</div>{pill({"done":"done","active":"in-progress","todo":"todo"}[st])}')
        if rows:
            a(f'{bar(c, len(rows))}<div class="c">{c["done"]}/{len(rows)} 완료' + (f' · {c["active"]} 진행' if c["active"] else '') + (f' · {c["blocked"]} 대기' if c["blocked"] else '') + '</div>')
        a(f'<div class="m">{esc(meaning)}</div></div>')
    a('</div><div class="legend"><span><i style="background:var(--success)"></i>완료</span><span><i style="background:var(--accent)"></i>진행 중</span><span><i style="background:var(--danger);opacity:.6"></i>사용자 액션 대기</span><span><i style="background:var(--surface-2);border:1px solid var(--border)"></i>예정</span></div></section>')

    # 2. 워커 + 사용자 할 일
    a('<div class="cols"><section><h2>지금 돌고 있는 워커</h2><p class="sub">브리프를 받은 구현 에이전트(Claude Code Workflow Sonnet 5, 또는 사용자 세션의 Codex·Sol·Luna)가 워크트리 하나씩 맡아 PR을 엽니다.</p>')
    if active:
        a('<div class="workers">')
        for w in active:
            r = all_rows.get(w["id"], {})
            a(f'<div class="worker"><div class="head"><span class="tid">{esc(w["id"])}</span><span class="pkg">{esc(r.get("area",""))}</span>{pill("in-progress")}</div><p>{md_inline(r.get("task",""))}</p><div class="st">{md_inline(w["status"])}<br>시작 {esc(w["start"])} · {esc(w["worker"])}</div></div>')
        a('</div>')
    else:
        a('<p class="empty">지금은 도는 워커가 없습니다.</p>')
    a('</section><section><h2>사용자가 해야 할 일</h2><p class="sub">계정·결제·승인처럼 사용자만 할 수 있는 일입니다. 위에 있을수록 급합니다.</p>')
    if open_u:
        a('<div class="todo">')
        for u in open_u:
            a(f'<div class="item"><div class="head"><span class="tid">{esc(u["id"])}</span>{pill("blocked")}</div><p>{md_inline(u["task"])}</p><div class="why">{md_inline(u["note"])}</div></div>')
        a('</div>')
    else:
        a('<p class="empty">지금 기다리는 사용자 액션이 없습니다.</p>')
    if deferred_u:
        a(f'<details class="inner" style="margin-top:12px"><summary>보류 중 {len(deferred_u)}건 <small>출시 준비 단계에서 다시 봅니다</small></summary><div class="body"><div class="tscroll"><table><tbody>')
        for u in deferred_u:
            a(f'<tr><td class="tid">{esc(u["id"])}</td><td>{md_inline(u["task"])}</td><td class="muted">{md_inline(u["note"])}</td></tr>')
        a('</tbody></table></div></div></details>')
    if done_u:
        a(f'<details class="inner"><summary>끝난 사용자 액션 {len(done_u)}건</summary><div class="body"><div class="tscroll"><table><tbody>')
        for u in done_u:
            a(f'<tr><td class="tid">{esc(u["id"])}</td><td>{md_inline(u["task"])}</td><td class="muted">{md_inline(u["note"])}</td></tr>')
        a('</tbody></table></div></div></details>')
    a('</section></div>')

    # 3. 다음 + 오늘
    future = [d for t, d in ETA if t.endswith("~")]
    today_entries = [(t, d) for t, d in ETA if t.startswith(today_md + " ")]
    a('<div class="cols"><section><h2>다음에 올 일</h2><p class="sub">지금 워커가 끝나면 이어서 투입할 작업입니다.</p><ul class="next">')
    for chunk in future:
        for item in re.split(r"\.\s+", chunk.strip().rstrip(".")):
            if item.strip(): a(f'<li>{md_inline(item.strip())}</li>')
    a('</ul></section><section><h2>오늘 한 일</h2><p class="sub">머지된 PR과 주요 사건, 시간순.</p>')
    if prs_today:
        a('<p class="prs">머지된 PR: ' + " ".join(f'<a href="{GH}/pull/{m["pr"]}" target="_blank" rel="noopener">#{m["pr"]}</a>' for m in reversed(prs_today) if m["pr"]) + '</p>')
    a('<ul class="timeline">')
    for t, d in today_entries:
        lead, rest = lead_split(d)
        a(f'<li><span class="t">{esc(t)}</span><span class="lead">{md_inline(lead)}</span>' + (f'<span class="rest">{md_inline(rest)}</span>' if rest else '') + '</li>')
    a('</ul></section></div>')

    # 4. 펼쳐 보기: 작업 보드
    a('<section><h2>더 보기</h2><p class="sub">자세한 표는 접어 두었습니다. 제목을 누르면 펼쳐집니다.</p>')
    a(f'<details open><summary>작업 보드 <small>Phase별 작업 목록과 상태. 지금 진행 중인 Phase가 펼쳐져 있습니다</small></summary><div class="body">')
    for name, title, sec, meaning in PHASES:
        rows = phase_rows[name]
        if not rows: continue
        st = phase_state(rows, name); c = counts(rows)
        a(f'<details class="inner"{" open" if st == "active" else ""}><summary>{esc(name)} · {esc(title)} <small>{c["done"]}/{len(rows)} 완료</small></summary><div class="body"><div class="tscroll"><table><thead><tr><th>ID</th><th>영역</th><th>작업</th><th>상태</th><th>메모</th></tr></thead><tbody>')
        for r in rows:
            area = " · ".join(x for x in [r["track"] and f"트랙 {r['track']}", r["area"], r["wave"] and f"Wave {r['wave']}"] if x)
            a(f'<tr><td class="tid">{esc(r["id"])}</td><td class="muted">{esc(area)}</td><td>{md_inline(r["task"])}</td><td>{pill(r["status"])}</td><td class="muted">{md_inline(r["note"])}</td></tr>')
        a('</tbody></table></div></div></details>')
    if release_rows:
        c = counts(release_rows)
        a(f'<details class="inner"><summary>미니앱 출시 준비 <small>{c["done"]}/{len(release_rows)} 완료 · 사용자 결정 시 착수</small></summary><div class="body"><div class="tscroll"><table><thead><tr><th>ID</th><th>작업</th><th>상태</th></tr></thead><tbody>')
        for r in release_rows:
            a(f'<tr><td class="tid">{esc(r["id"])}</td><td>{md_inline(r["task"])}</td><td>{pill(r["status"])}</td></tr>')
        a('</tbody></table></div></div></details>')
    a('</div></details>')

    # 화면·패키지
    a('<details><summary>무엇이 실제로 보이나 <small>화면 구현 현황과 패키지별 구현 내용</small></summary><div class="body">')
    a('<div class="tscroll"><table><thead><tr><th>화면</th><th>이름</th><th>상태</th><th>담당 작업</th></tr></thead><tbody>')
    SP = {"구현": "done", "부분": "part", "자리표시": "todo", "예정": "todo"}
    for sid, name, st, note in SCREENS:
        a(f'<tr><td class="tid">{esc(sid)}</td><td>{esc(name)}</td><td><span class="pill {SP[st]}">{esc(st)}</span></td><td class="muted">{esc(note)}</td></tr>')
    a('</tbody></table></div><div class="layers" style="margin-top:16px">')
    for key, title, done, todo in LAYERS:
        a(f'<div class="layer"><h3>{esc(key)}<span>{esc(title)}</span></h3>')
        if done:
            a('<div class="cap">구현됨</div><ul>' + "".join(f"<li>{esc(x)}</li>" for x in done) + "</ul>")
        if todo:
            a('<div class="cap">진행 중·다음</div><ul class="todo-list">' + "".join(f"<li>{esc(x)}</li>" for x in todo) + "</ul>")
        a('</div>')
    a('</div></div></details>')

    # 진행 기록(지난 날)
    days = []
    for t, d in ETA:
        if t.endswith("~"): continue
        day = t.split(" ")[0]
        if not days or days[-1][0] != day: days.append((day, []))
        days[-1][1].append((t, d))
    a('<details><summary>진행 기록 <small>날짜별 머지·투입·결정, 시간순</small></summary><div class="body">')
    for day, items in days:
        a(f'<details class="inner"{" open" if day == today_md else ""}><summary>{esc(day)} <small>{len(items)}건</small></summary><div class="body"><ul class="timeline">')
        for t, d in items:
            lead, rest = lead_split(d)
            a(f'<li><span class="t">{esc(t.split(" ",1)[1] if " " in t else t)}</span><span class="lead">{md_inline(lead)}</span>' + (f'<span class="rest">{md_inline(rest)}</span>' if rest else '') + '</li>')
        a('</ul></div></details>')
    a('</div></details>')

    # 결정
    a(f'<details><summary>주요 결정 <small>{len(DECISIONS)}건 · 최근 것이 위 · 원문은 결정 로그</small></summary><div class="body"><div class="dec">')
    for t, d in DECISIONS:
        a(f'<div><b>{esc(t)}</b>{esc(d)}</div>')
    a('</div></div></details>')

    # 현재 게이트 원문
    a('<details><summary>현재 게이트 원문 <small>board.md의 "현재 게이트" 문단 그대로</small></summary><div class="body"><p class="gate">' + esc(gate) + '</p></div></details>')

    # 용어
    a('<details><summary>용어 안내 <small>이 페이지에 나오는 번호와 말</small></summary><div class="body"><dl class="gloss">')
    for k, v in GLOSSARY:
        a(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>')
    a('</dl></div></details></section>')

    a(f'<footer>이 페이지는 <code>docs/tracking/board.md</code>와 git 로그에서 생성됩니다. 오케스트레이터가 머지·투입 때마다 다시 게시합니다. 마지막 갱신 {esc(updated)}.</footer></div>')
    return "\n".join(p)

open(OUT, "w", encoding="utf-8").write(render())
print(OUT, len(open(OUT).read()), "bytes; phases", {n: counts(phase_rows[n]) for n in phase_rows if phase_rows[n]}, "active", len(active), "merges today", len([m for m in merges if m['date']==now.strftime('%Y-%m-%d')]))
