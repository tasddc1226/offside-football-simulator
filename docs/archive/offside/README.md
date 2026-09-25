# 아카이브: 원작 OFFSIDE (결정론적 커리어 시뮬레이터)

이 디렉터리는 2026-09-24 **Phase 9 풀타임 전환**(T-9-001)에서 보존용으로 옮긴, 원작
OFFSIDE의 기획·개발·화면·콘텐츠·QA·디자인·트래킹 문서다. 코드는 이미 새 게임
**풀타임**(vanilla Vite + TypeScript, `apps/web/src/game/*`)으로 교체됐고, 이 문서들은
더 이상 정본이 아니다. 현재 정본은 `docs/adr/`(ADR-013이 이 전환을 기록한다)과
`docs/tracking/`(`board.md`, `decision-log.md`)이다.

## 무엇을, 왜

원작 OFFSIDE는 React 19 + TanStack 기반 SPA가 브라우저 Web Worker에서 결정론적
시뮬레이션(`seed + rulesetVersion + contentPackVersion + command`)을 실행하고
Dexie(IndexedDB)에 저장하며, 서버는 체크포인트 동기화·보관함·경쟁·서비스 시즌을
맡는 구조였다. 2026-09-06 `SEASON 1: KICKOFF`로 offside-lab.com에 출시돼 2026-09-23까지
운영됐다.

오너가 이 구조를 전면 교체하고 더 단순한 확률·이벤트 기반 커리어 시뮬레이터
"풀타임"으로 게임을 바꾸기로 결정했다(2026-09-23/24 KST, ADR-013 참조). 실제 운영
사용자 데이터가 없으므로 데이터 보존은 필요하지 않았고, 이 디렉터리는 오직
설계·의사결정 이력을 남기기 위한 것이다.

옮긴 것:

- `content/`, `phases/`, `screens/`, `development/`, `product/`, `research/`, `design/`, `qa/` — 원작의 기획·화면 계약·콘텐츠 저작·개발 명세·QA 기록 전체
- `offside-football-simulator-design.docx`/`.pdf` — 73페이지 통합 설계서(다른 서비스 화면 캡처가 많아 공개 저장소 정리 때 제거).
- `tracking/` — 원작 진행 보드(`board-pre-phase9.md`), 워커 브리프 118건, 결정 로그에 딸린 대량 시뮬레이션 증거, phase 계획·완료 감사, 레거시 위임 스크립트(`dispatch.sh`/`redispatch.sh`/`watch.py`), 현황판 생성기

옮기지 않고 제자리에 남긴 것: 여전히 유효한 브랜드·인프라·운영 문서(`docs/adr/`,
`docs/tracking/README.md`·`board.md`·`decision-log.md`, `docs/operations/`)와 새 게임에
그대로 재사용 가능한 일반 자산 문서.

## 마지막 커밋과 태그 제안

이 아카이브 직전, 원작 OFFSIDE의 마지막 main 커밋은 다음과 같다.

```
68865f9 fix: show annual decisions without unchanged report reload (#278)
2026-09-23 11:39:31 +0900
```

이 커밋을 `offside-final` 태그로 남겨 두길 권장한다. 태그 생성은 오너의 판단이며
이 작업에서는 만들지 않았다.

```bash
git tag -a offside-final 68865f9 -m "Last commit of original OFFSIDE before the 풀타임 replacement (T-9-001, ADR-013)"
git push origin offside-final
```

## 이 문서를 읽을 때 주의할 점

- 여기 담긴 문서 간의 상호 링크는 이동 후에도 일부 유효하지만, 새 정본 문서
  (`docs/adr/`, `docs/tracking/`)로 향하는 링크는 깨져 있을 수 있다. 링크 점검
  결과는 `docs/tracking/decision-log.md`의 T-9-001d 항목과 이 작업의 최종 보고서를
  참고한다.
- 여기 담긴 규칙(예: 콘텐츠 팩 불변성, ruleset 고정, Web Worker 결정론)은 새 게임에는
  적용되지 않는다. 새 게임의 규칙은 루트 `CLAUDE.md`/`AGENTS.md`와 `docs/adr/ADR-013-fulltime-replacement.md`를 따른다.
