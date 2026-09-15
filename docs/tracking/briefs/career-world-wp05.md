# Career World WP-05: 현재 리그 맥락 읽기 전용 연결

## 목표

PR #222가 제공하는 현재 활성 시즌 리그 원장을 사용해, 다음 결정과 계약/구단 면담을 해석하는 데 필요한 현재 팀 상황을 간결하게 보여준다.

## 참조 명세

- 요구사항: FR-CW-002/003/005/012, TEST-CW-005
- 최초 검토 기준: PR #222 `d6b7a205d64fdd8677b7b56eb939ec403bd835de`
- 최종 반영 부모: PR #222 `f229f0f6bb57a258a601af7e503199535604ba60`
- 최종 반영 main: `bd4e83fa6bd9b454fb0390b70be85c78b33580e2`
- 검토 문서: `career-world-prd.md`, `ADR-011-league-ledger-and-career-feedback.md`, `20-career-world-plan.md`
- stacked base: `tasddc1226/T-7-022-league-ledger`

## 범위와 의미

- `apps/web`에서만 기존 `assertSeasonLeagueLedgerInvariant`와 `standingsFromLedger`를 사용해 순수 현재 리그 맥락 view model을 만든다.
- 현재 활성 시즌의 마지막 확정 라운드, 내 팀 순위/참가팀 수/경기 수, 바로 위 팀과의 승점 차를 표시한다. 선두는 2위와의 차를 표시하며 같은 승점이면 단독 선두로 표현하지 않고 `승점 동률`로 말한다.
- 첫 확정 라운드 전에는 순위를 경기 결과처럼 강조하지 않고 `아직 확정된 경기 없음`과 내 팀 0경기를 표시한다. 홀수 팀 리그의 BYE로 내 팀만 0경기인 경우에는 다른 팀의 확정 결과를 숨기지 않고 실제 순위와 승점 차를 표시한다.
- 다음 결정 카드와 이번 시즌 구단 면담 목표 사이, 커리어 탭의 기존 계약 정보 앞에 같은 compact summary를 장착하고 현재 시즌 탭의 순위표로 연결한다.
- 현재 확정 결과만 현재 팀 상황으로 설명한다. 면담 당시 순위나 감독 응답의 역사적 원인으로 소급하지 않는다.

## 제외와 호환 경계

- 룰셋 정책, 시즌, 팀, 리그, roster, schedule, competition projection의 canonical binding이 모두 맞을 때만 노출한다. 미지원 구버전, 원장 누락/손상, 과거 시즌은 값을 합성하지 않는다.
- title/relegation 확정, 실제 승강격, 사건 확률, 사기/신뢰 효과, 제안 origin, 임대 복귀 역할 snapshot을 만들지 않는다.
- domain/contracts/content, active/fallback service season, 은퇴 UI, PR #221 후속 영수증, 공유 board/decision-log/index, 새 route/state/command/motion package를 바꾸지 않는다.
- PR #221의 `recentChronicleItems` 아래와 계약 요약 뒤 후속 영수증 삽입 지점을 보존한다. 부모의 final table tuple adapter는 이 작업에서 수정하지 않는다.

## 검증

- D-61: 새 테스트 파일이나 독립 `it`/`test`/golden을 추가하지 않는다. 기존 대시보드 케이스에 1.7/0.6.3 실제 명령 진행, 무확정 상태, 동률/선두/승점 차/BYE 표, 손상·identity mismatch, 시즌/커리어 mount와 canonical 시즌 순위표 링크 assertion을 합친다. 옛 `?view=schedule` 북마크는 부모 router의 `schedule → season` 매핑을 그대로 유지한다.
- `f229f0f` 통합 정적 검사 통과: scoped Prettier와 `git diff --check`.
- `f229f0f` 통합 후 focused Vitest는 공유 CPU 할당 후 재실행한다.
- 이전 `fc00e50` 기준 통과: `pnpm --filter @offside/web exec vitest run 'src/routes/career.$careerId.index.test.tsx'` — 27/27, 기준과 테스트 수 동일.
- 이전 `fc00e50` 기준 통과: `pnpm --filter @offside/web lint`, `pnpm --filter @offside/web typecheck`, `git diff --check`.
- 목록 확인: `pnpm --filter @offside/web exec playwright test e2e/mobile-refresh.spec.ts e2e/a11y.spec.ts --list --workers=1` — 39개를 나열했다.
- 통과: `E2E_PORT=5525 pnpm --filter @offside/web exec playwright test e2e/mobile-refresh.spec.ts:286 e2e/a11y.spec.ts:288 --workers=1` — 직접 관련 2개만 실행, 2/2 통과. 대시보드/계약 탭 axe serious·critical 위반 0건과 모바일 프레임을 확인했다.
- 통과: `pnpm --filter @offside/web build` 및 `pnpm --filter @offside/web check:bundle` — production build 성공, 초기 JS 102.43 KB gzip/300 KB 예산.

## 브라우저와 의존성

- 지원 1.7.0/0.6.2 자연 브라우저 검증을 이 작업의 할당 web/API 포트 5425/8825에서 수행했다. 자연 생성·계약·프리시즌·시즌 시작 뒤 0라운드 홈/계약 mount와 순위표 링크를 확인하고, UI 진행으로 결과를 확정한 뒤 `4라운드 종료 기준 · 2위/16팀 · 4경기 · 1위와 승점 2점 차`를 확인했다. reload와 360×800에서도 같은 맥락이 유지됐다. IDB나 게임 state를 주입하지 않았다.
- 5179에서 수행한 초기 자연 생성 시도는 할당 서버 provenance가 확인되지 않아 이 변경의 브라우저 증거에서 제외한다.
- 부모 PR #222의 final table tuple 압축과 의미/완결성 guard, 1.7.0의 1.6.1 성장·은퇴 계승, 신규 호환 팩 0.6.3, 최신 main 동기화를 포함한 `f229f0f6bb57a258a601af7e503199535604ba60`을 반영했다. 기존 0.6.2는 수정하지 않았고 merge/deploy는 이 작업 범위가 아니다.
