# E2E (Playwright)

```bash
pnpm --filter @offside/web e2e:install   # Chromium 최초 1회
pnpm --filter @offside/web e2e           # 전체 스펙 실행(dev 서버 자동 기동)
```

`playwright.config.ts`가 기본적으로 `vite dev --port 5174`를 `webServer`로 자동 기동한다(이미 떠 있으면 재사용). Chromium 1개 프로젝트, 기본 뷰포트 360×780, 실패 시 trace `retain-on-failure`.

## 스펙

- `hub.spec.ts`: 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT 생성 → 허브 카드(새로고침 뒤 IndexedDB 영속 확인) → 삭제.
- `create.spec.ts`: 온보딩 KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정 → 복구 코드 발급(`page.route`로 `/v1/profile`·`/v1/profile/recovery-code` 스텁, 성공·실패 각각 한 번씩) → SCR-007 계열 라우트(`path`·`tryout`·`event`) 도착. 이름 길이 오류 시 입력·포커스 보존, SCR-002 새로고침 시 draft 유지도 함께 확인한다. ADVANCE 직후 이벤트 선택은 도메인 가중 랜덤이라 도착 라우트를 하나로 고정하지 않는다.
- `legal.spec.ts`: `/legal/privacy`·`/legal/terms` 200 + 제목.
- `settings-data.spec.ts`(T-1-012): SCR-030 "데이터" 섹션. 복구 코드 재발급(확인 대화상자 → 코드 대화상자 → 복사 → 닫힘, 발급일 갱신), 프로필 복구(형식 오류는 요청 없이 필드 오류, `RECOVERY_CODE_INVALID`, `RATE_LIMITED`, `RECOVERY_CONFLICT`면 선택 대화상자 후 `mergeChoice`를 붙여 재전송), 프로필 삭제(1단계→확인 대화상자→2단계→온보딩 이동), 이 기기 데이터 삭제(확인→온보딩→허브가 빈 상태로 복귀)를 모두 `page.route` 스텁으로 검사한다.
- `recovery-api.spec.ts`(T-1-012, D-18): `E2E_WITH_API=1`일 때만 실행되며 스텁 없이 실제 `apps/api`(`wrangler dev --local`, 로컬 D1)에 붙는다. 서로 다른 브라우저 컨텍스트(별도 쿠키 = 별도 익명 프로필) A에서 발급한 복구 코드로 컨텍스트 B가 같은 커리어를 되찾는 왕복을 검사한다. 로컬 D1은 `pnpm --filter @offside/api db:migrate`와 `db:seed`(career 저장에 필요한 `service_seasons` 시드)를 먼저 실행해 둬야 한다.
- `a11y.spec.ts`: `/legal/privacy`·`/legal/terms`·`/onboarding`·`/settings`·빈 허브·카드 있는 허브·SCR-002·SCR-003·SCR-004·T-1-011 충돌 대화상자·T-1-012 설정의 새 대화상자(재발급 확인·복구 코드 결과·복구 충돌 선택·이 기기 데이터 삭제 확인·프로필 삭제 확인)에서 axe `serious`·`critical` 위반 0건(콘솔에 요약 출력).
- `hash-probe.spec.ts`: dev 전용 라우트 `/__dev/hash-probe`(브라우저 Web Worker에서 `@offside/fixtures`의 career-01을 재생)가 렌더한 `revision`·`stateHash`가 golden과 같은지 확인한다. 이 라우트는 `import.meta.env.DEV`일 때만 등록되며 프로덕션 빌드에는 포함되지 않는다(`apps/web/src/main.tsx`, `apps/web/src/dev/hash-probe.tsx`).

## 실제 API로 실행(E2E_WITH_API=1)

```bash
pnpm --filter @offside/api db:migrate
pnpm --filter @offside/api db:seed
E2E_WITH_API=1 pnpm --filter @offside/web e2e
```

`apps/api/wrangler.jsonc`의 `ALLOWED_ORIGINS`가 `5173`만 허용하므로, 이 모드에서는 웹 dev 서버도 `5174` 대신 `5173`(vite 기본 포트)으로 뜬다. 기본(스텁 API) 모드는 그대로 `5174`를 써 개발자가 따로 띄워 둔 `pnpm dev`(5173)와 충돌하지 않는다.

Vitest는 `src/**/*.test.{ts,tsx}`만 본다. `e2e/`는 Vitest 대상이 아니다.
