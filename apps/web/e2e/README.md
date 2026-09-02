# E2E (Playwright)

```bash
pnpm --filter @offside/web e2e:install   # Chromium 최초 1회
pnpm --filter @offside/web e2e           # 전체 스펙 실행(dev 서버 자동 기동)
```

`playwright.config.ts`가 `vite dev --port 5174`를 `webServer`로 자동 기동한다(이미 떠 있으면 재사용). Chromium 1개 프로젝트, 기본 뷰포트 360×780, 실패 시 trace `retain-on-failure`.

## 스펙

- `hub.spec.ts`: 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT 생성 → 허브 카드(새로고침 뒤 IndexedDB 영속 확인) → 삭제.
- `create.spec.ts`: 온보딩 KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정 → 복구 코드 발급(`page.route`로 `/v1/profile`·`/v1/profile/recovery-code` 스텁, 성공·실패 각각 한 번씩) → SCR-007 계열 라우트(`path`·`tryout`·`event`) 도착. 이름 길이 오류 시 입력·포커스 보존, SCR-002 새로고침 시 draft 유지도 함께 확인한다. ADVANCE 직후 이벤트 선택은 도메인 가중 랜덤이라 도착 라우트를 하나로 고정하지 않는다.
- `legal.spec.ts`: `/legal/privacy`·`/legal/terms` 200 + 제목.
- `a11y.spec.ts`: `/legal/privacy`·`/legal/terms`·`/onboarding`·`/settings`·빈 허브·카드 있는 허브·SCR-002·SCR-003·SCR-004에서 axe `serious`·`critical` 위반 0건(콘솔에 요약 출력).
- `hash-probe.spec.ts`: dev 전용 라우트 `/__dev/hash-probe`(브라우저 Web Worker에서 `@offside/fixtures`의 career-01을 재생)가 렌더한 `revision`·`stateHash`가 golden과 같은지 확인한다. 이 라우트는 `import.meta.env.DEV`일 때만 등록되며 프로덕션 빌드에는 포함되지 않는다(`apps/web/src/main.tsx`, `apps/web/src/dev/hash-probe.tsx`).
- `first-contract.spec.ts`: 온보딩 → SCR-002~004 → KICKOFF → 이벤트 화면(SCR-007/008/013, 반복) → SCR-014 → SCR-009 → SCR-010 → SCR-029 전 구간. `test.use({ contextOptions: { reducedMotion: 'reduce' } })`로 SCR-008 진행 연출을 건너뛴다. CONFIRM_PLAYER 직후 FAST 모드는 SETTLEMENT 단계에서 몇 차례의 서사 이벤트(도메인 가중 랜덤)를 소진한 뒤에야 제안이 열리므로, 어떤 이벤트·화면이 몇 번 뜨는지는 고정하지 않고 offers 도착까지 반복한다(안전 상한 10회).

Vitest는 `src/**/*.test.{ts,tsx}`만 본다. `e2e/`는 Vitest 대상이 아니다.
