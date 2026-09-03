# E2E (Playwright)

```bash
pnpm --filter @offside/web e2e:install   # Chromium 최초 1회
pnpm --filter @offside/web e2e           # 전체 스펙 실행(dev 서버 자동 기동, 스텁 API)
pnpm --filter @offside/web e2e:api       # 실제 apps/api(E2E_WITH_API=1) — 아래 "실제 API로 실행" 참조
pnpm --filter @offside/web e2e:perf      # 실제 빌드 대상 성능 측정(E2E_PREVIEW=1) — perf.spec.ts만
```

`playwright.config.ts`가 기본적으로 `vite dev --port 5174`를 `webServer`로 자동 기동한다(이미 떠 있으면 재사용). Chromium 1개 프로젝트, 기본 뷰포트 360×780, 실패 시 trace `retain-on-failure`. `E2E_PREVIEW=1`이면 대신 `pnpm build && vite preview --port 5175`를 띄운다(dev 서버는 HMR·미압축 번들이라 LCP·CLS가 실제 배포본과 다르게 나온다).

워크트리를 여러 개 병행 투입해 e2e를 동시에 돌릴 때는 기본 포트(5174/5173/5175)가 충돌할 수 있다 — `E2E_PORT=<port>`로 웹 서버 포트를, `E2E_API_URL=<url>`로 `E2E_WITH_API=1`일 때의 API 주소를 각각 오버라이드한다(예: `E2E_PORT=5184 pnpm --filter @offside/web e2e`).

## 스펙

- `hub.spec.ts`: 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT 생성 → 허브 카드(새로고침 뒤 IndexedDB 영속 확인) → 삭제.
- `create.spec.ts`: 온보딩 KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정 → 복구 코드 발급(`page.route`로 `/v1/profile`·`/v1/profile/recovery-code` 스텁, 성공·실패 각각 한 번씩) → SCR-007 계열 라우트(`path`·`tryout`·`event`) 도착. 이름 길이 오류 시 입력·포커스 보존, SCR-002 새로고침 시 draft 유지도 함께 확인한다. ADVANCE 직후 이벤트 선택은 도메인 가중 랜덤이라 도착 라우트를 하나로 고정하지 않는다.
- `legal.spec.ts`: `/legal/privacy`·`/legal/terms` 200 + 제목.
- `settings-data.spec.ts`(T-1-012): SCR-030 "데이터" 섹션. 복구 코드 재발급(확인 대화상자 → 코드 대화상자 → 복사 → 닫힘, 발급일 갱신), 프로필 복구(형식 오류는 요청 없이 필드 오류, `RECOVERY_CODE_INVALID`, `RATE_LIMITED`, `RECOVERY_CONFLICT`면 선택 대화상자 후 `mergeChoice`를 붙여 재전송), 프로필 삭제(1단계→확인 대화상자→2단계→온보딩 이동), 이 기기 데이터 삭제(확인→온보딩→허브가 빈 상태로 복귀)를 모두 `page.route` 스텁으로 검사한다.
- `recovery-api.spec.ts`(T-1-012, D-18): `E2E_WITH_API=1`일 때만 실행되며 스텁 없이 실제 `apps/api`(`wrangler dev --local`, 로컬 D1)에 붙는다. 서로 다른 브라우저 컨텍스트(별도 쿠키 = 별도 익명 프로필) A에서 발급한 복구 코드로 컨텍스트 B가 같은 커리어를 되찾는 왕복을 검사한다. 로컬 D1은 `pnpm --filter @offside/api db:migrate`와 `db:seed`(career 저장에 필요한 `service_seasons` 시드)를 먼저 실행해 둬야 한다. 앞부분(코드 발급→복구)은 `helpers/recovery.ts`를 `recovery-conflict.spec.ts`와 공유한다.
- `recovery-conflict.spec.ts`(T-1-014, TEST-E2E-008, D-19): `E2E_WITH_API=1`일 때만 실행. `recovery-api.spec.ts`와 같은 왕복 뒤, 두 컨텍스트가 같은 대기 중 이벤트를 서로 다른 선택지로 한 단계씩 진행시켜(같은 선택이면 stateHash가 같아 재생될 뿐 충돌이 안 난다) 진짜 409 충돌을 만들고, "다른 기기 진행 가져오기"(로컬을 서버에 맞춤)·"이 기기 진행 유지"(포크해 카드 2장)를 각각 검사한다.
- `google-link.spec.ts`(T-1-013, D-21): (a) `E2E_WITH_API=1`일 때만 도는 실제 api 왕복 — Google 연결(가짜 OIDC, `GOOGLE_FAKE=1`) → 콜백 → "연결됨" → 다른 컨텍스트가 커리어를 만든 뒤 같은 가짜 sub로 연결 → 병합 대화상자 → "옮기기" → 그 커리어가 남는다. (b) 스텁(`page.route`)으로 `?google=merge_required` 진입 → 대화상자 → `POST /auth/merge`에 `mergeChoice`가 실리는지 확인(기본 모드에서도 실행).
- `resilience.spec.ts`(T-1-014, TEST-E2E-007, 스텁 API): (a) SCR-002 입력 도중 새로고침 → draft 복원, SCR-004 확정 뒤 새로고침 → 이벤트 화면 그대로. (b) 확정 버튼을 `Promise.all`로 동시에 두 번 클릭해도 revision이 정확히 2(CONFIRM_PLAYER+ADVANCE)만 증가하고 카드가 1장(`data-testid="career-card" data-revision`으로 화면 값 확인). (c) `PUT /careers/{id}` 첫 요청만 `route.abort()`로 유실 → "저장 다시 시도 중" → 같은 `Idempotency-Key`로 재시도해 "저장됨". (d) 명령 응답 대기(COMMITTING) 중 뒤로 가기 — 06 문서가 요구하는 경고 대화상자는 실제로 구현돼 있지 않아(`platform.lifecycle.onBackPressed`가 죽은 코드), 이 테스트는 실제 동작(경고 없이, 재진입 시 확정 결과가 보임)을 특성화한다. CDP `Emulation.setCPUThrottlingRate`로 COMMITTING 창을 넓혀 결정론적으로 만든다.
- `session-length.spec.ts`(T-1-014, TEST-E2E-009 + 11 "세션 길이 목표", 스텁 API): 온보딩 "건너뛰기" → 선수 만들기 → 진로 → 입단 테스트 → 제안 → 계약까지. `performance.now()` 자동화 시간과, 지나간 화면·선택·텍스트 입력·확정 횟수로 계산한 "최소 조작 시간"(D-22 단가)을 함께 `test-results/session-length.json`에 기록한다(assert는 5분 미만).
- `keyboard.spec.ts`(T-1-014): `first-contract.spec.ts`와 같은 여정을 `page.keyboard`(Tab·Shift+Tab·Enter·Space·화살표)만으로 완주한다(`click()` 금지, `toBeFocused`로 포커스 확인). SCR-002의 포지션 구분 탭(TabsList)이 `RadioGroup`에 중첩돼 Tab으로 도달 불가능한 버그(고치지 않음, `docs/tracking/phase-1-completion.md` 참조)가 있어 기본(골키퍼) 그룹으로 우회한다. 대화상자 포커스 트랩·복귀는 허브의 삭제 확인 대화상자로 확인한다.
- `a11y.spec.ts`: `/legal/privacy`·`/legal/terms`·`/onboarding`·`/settings`·빈 허브·카드 있는 허브·SCR-002~004·007/008/013/014·009·010·029(기본·휴대폰 탭)·**SCR-031(T-2-008: 판단 확정 화면·경기 결과 화면)**·T-1-011 충돌 대화상자·T-1-012/T-1-013 설정의 대화상자(재발급 확인·복구 코드 결과·복구 충돌 선택·이 기기 데이터 삭제 확인·프로필 삭제 확인·Google 연결 해제·Google 병합 선택·로그아웃 확인)에서 axe `serious`·`critical` 위반 0건(콘솔에 요약 출력). 추가로 텍스트 크기 150%+360px 가로 스크롤 없음, 모션 감소 시 입단 테스트 결과 즉시 표시(카운트업 없음), 결과 확정 시 `aria-live` 갱신 횟수(`MutationObserver`로 세어 그대로 보고 — 현재 0건, 범위 밖 발견 사항)도 검사한다.
- `chapter.spec.ts`(T-2-008, TEST-E2E-010): CHAPTER 모드로 시즌을 시작해 SCR-031(핵심 경기 챕터)에 도달 → 경기 전 맥락(고정 헤더) → 판단 확정(`RESOLVE_CHAPTER`) → 경기 결과 → 대시보드까지 이동한다. 확정 전 mid-flow 새로고침·뒤로 가기가 이미 확정된 판단을 다시 묻지 않고(roll을 다시 소비하지 않고) 같은 스코어·평점을 재생하는지 `career-card`의 `data-revision`으로 확인한다(뒤로 가기·새로고침 2회가 명령을 하나도 만들지 않아야 한다). SCR-029 도착 헬퍼(`planPreseasonChapterMode`·`resolveRoleProposal`·`advanceToChapter`)는 `helpers/chapter.ts`로 뽑혀 `a11y.spec.ts`와 공유한다.
- `hash-probe.spec.ts`: dev 전용 라우트 `/__dev/hash-probe`(브라우저 Web Worker에서 `@offside/fixtures`의 career-01을 재생)가 렌더한 `revision`·`stateHash`가 golden과 같은지 확인한다. 이 라우트는 `import.meta.env.DEV`일 때만 등록되며 프로덕션 빌드에는 포함되지 않는다(`apps/web/src/main.tsx`, `apps/web/src/dev/hash-probe.tsx`).
- `first-contract.spec.ts`: 온보딩 → SCR-002~004 → KICKOFF → 이벤트 화면(SCR-007/008/013, 반복) → SCR-014 → SCR-009 → SCR-010 → SCR-029 전 구간. `test.use({ contextOptions: { reducedMotion: 'reduce' } })`로 SCR-008 진행 연출을 건너뛴다. CONFIRM_PLAYER 직후 FAST 모드는 SETTLEMENT 단계에서 몇 차례의 서사 이벤트(도메인 가중 랜덤)를 소진한 뒤에야 제안이 열리므로, 어떤 이벤트·화면이 몇 번 뜨는지는 고정하지 않고 offers 도착까지 반복한다(안전 상한 10회). `create.spec.ts`와 함께 `helpers/player-creation.ts`의 온보딩→SCR-002~004→이벤트 도착 헬퍼를 공유한다.
- `sync.spec.ts`(T-1-011): 배경 동기화 상태 배지(SyncBadge) 전이 — 생성 즉시 저장, "다른 기기 진행 가져오기"·"이 기기 진행 유지" 충돌 해소, 오프라인→온라인 복귀, PUT 401 시 "로컬 전용" 안내.
- `perf.spec.ts`(T-1-014, `E2E_PREVIEW=1`일 때만): 커리어 카드 3장이 있는 허브를 실제 빌드(`vite preview`) 대상으로, CDP `Network.emulateNetworkConditions`(4G: 다운 4Mbps·RTT 150ms)에서 LCP·CLS를 3회 측정해 중앙값을 콘솔·`docs/tracking/phase-1-completion.md`에 기록한다(목표값은 assert하지 않는다, D-22). 커리어는 실제 UI로 만들어 로컬 IndexedDB에만 쓴다 — 이 모드는 `apps/api`를 띄우지 않으므로 실 네트워크 접근이 없다.

## 실제 API로 실행(E2E_WITH_API=1)

```bash
pnpm --filter @offside/api db:migrate
pnpm --filter @offside/api db:seed
E2E_WITH_API=1 pnpm --filter @offside/web e2e
```

`apps/api/wrangler.jsonc`의 `ALLOWED_ORIGINS`가 `5173`만 허용하므로, 이 모드에서는 웹 dev 서버도 `5174` 대신 `5173`(vite 기본 포트)으로 뜬다. 기본(스텁 API) 모드는 그대로 `5174`를 써 개발자가 따로 띄워 둔 `pnpm dev`(5173)와 충돌하지 않는다.

Vitest는 `src/**/*.test.{ts,tsx}`만 본다. `e2e/`는 Vitest 대상이 아니다.
