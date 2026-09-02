# E2E (Playwright)

```bash
pnpm --filter @offside/web e2e:install   # Chromium 최초 1회
pnpm --filter @offside/web e2e           # 전체 스펙 실행(dev 서버 자동 기동)
```

`playwright.config.ts`가 `vite dev --port 5174`를 `webServer`로 자동 기동한다(이미 떠 있으면 재사용). Chromium 1개 프로젝트, 기본 뷰포트 360×780, 실패 시 trace `retain-on-failure`.

## 스펙

- `hub.spec.ts`: 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT 생성 → 허브 카드(새로고침 뒤 IndexedDB 영속 확인) → 삭제.
- `legal.spec.ts`: `/legal/privacy`·`/legal/terms` 200 + 제목.
- `a11y.spec.ts`: `/legal/privacy`·`/legal/terms`·`/onboarding`·`/settings`·빈 허브·카드 있는 허브에서 axe `serious`·`critical` 위반 0건(콘솔에 요약 출력).
- `hash-probe.spec.ts`: dev 전용 라우트 `/__dev/hash-probe`(브라우저 Web Worker에서 `@offside/fixtures`의 career-01을 재생)가 렌더한 `revision`·`stateHash`가 golden과 같은지 확인한다. 이 라우트는 `import.meta.env.DEV`일 때만 등록되며 프로덕션 빌드에는 포함되지 않는다(`apps/web/src/main.tsx`, `apps/web/src/dev/hash-probe.tsx`).

Vitest는 `src/**/*.test.{ts,tsx}`만 본다. `e2e/`는 Vitest 대상이 아니다.

## 보류: T-1-009(커리어 화면) E2E

`first-contract.spec.ts`(온보딩→생성→이벤트→오퍼→계약→대시보드 전 구간)와 `a11y.spec.ts`의 이벤트·결과·제안·계약·대시보드 화면 추가는 T-1-008(선수 생성 SCR-002~004)이 아직 병합되지 않아 보류한다. 이 스펙들은 ACTIVE 상태의 커리어에 도달해야 하는데, 그 경로가 T-1-008의 스코프라 지금은 자리표시 화면만 있다. T-1-008 병합 뒤 추가한다.
