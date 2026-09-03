# Phase 1 완료 조건 표

T-1-014 산출물. `docs/phases/phase-01-career-vertical-slice.md` "완료 조건"을 하나씩 측정한다.

**행 수에 대해**: `docs/tracking/phase-1-plan.md` D-22는 "phase-01 완료 조건 11개 + ADR-008 국외
이전 명시 1개 + Google 실검증(U-003 대기) 1개 = 13행"이라 적었다. 그런데 T-1-016(PR #32)이 성별·
포지션 조건 2개를 phase-01 문서에 추가해, 실제 `완료 조건`은 지금 13개다(D-22가 쓰인 뒤 늘었다).
브리프의 정본 우선순위("D-22 > phase-01 완료 조건 > 08 > 11")를 따라 D-22의 숫자가 아니라 D-22가
가리키는 **phase-01 완료 조건 문서의 현재 내용**을 정본으로 삼았다 — 그래서 이 표는 13(phase-01) +
1(ADR-008) + 1(Google U-003) = **15행**이다. 이 불일치 자체를 여기 기록해 둔다.

| # | 조건 | 측정값 | 통과 | 근거 | 비고 |
|---|------|--------|------|------|------|
| 1 | 360px 모바일과 키보드로 첫 계약까지 완료한다. | 뷰포트 360×780(playwright.config.ts 전역), 키보드 전용 완주 1건 통과(3회 연속) | ✅ (조건부) | `e2e/keyboard.spec.ts` | SCR-002 포지션 구분 탭(TabsList)이 `<RadioGroup>`에 중첩돼 Tab으로 도달 불가(버그, 아래 "범위 밖 발견 사항"). 이 스펙은 기본(골키퍼) 그룹으로 우회해 완주를 증명했다 — 탭 전환이 필요한 실제 사용자는 막힌다. |
| 2 | 새로고침 후 DRAFT와 확정 단계가 각각 복원된다. | 2개 시나리오(SCR-002 draft, SCR-004 확정 뒤) 통과 | ✅ | `e2e/resilience.spec.ts`("(a) 새로고침"), `e2e/create.spec.ts`("저장한 뒤 새로고침해도 draft가 그대로 보인다") | |
| 3 | 포지션별 아키타입과 OVR 기대값이 golden test와 일치한다. | golden 상태 hash 일치 | ✅ | `e2e/hash-probe.spec.ts`, `packages/fixtures/src/career-01.test.ts`(단위) | E2E 범위 밖(단위 테스트) — 이번 작업이 새로 만들지 않고 기존 통과를 확인만 함. |
| 4 | 같은 seed·나머지 입력에서 성별만 달리한 선수의 능력·잠재력·계약 결과가 같다. | 성별 불변성 단위 테스트 통과 | ✅ | `packages/content/src/gender-invariant.test.ts` | T-1-016 산출물, E2E 범위 밖(단위 테스트). |
| 5 | 포지션 전환 뒤에도 최초 선호 포지션과 현재 주포지션을 구분해 표시한다. | UI에 `preferredPosition` 노출 0곳(grep: `apps/web/src` 전체) | ❌ | 코드 검토: `career.$careerId.index.tsx:210`·`event-screen.tsx:83`가 `primaryPosition`만 읽는다. `preferredPosition`은 계약(`packages/contracts`)엔 있지만 어떤 화면에도 렌더링되지 않는다. | 미구현. 버그라기보다 계약만 있고 화면이 못 따라간 상태 — 범위 밖 발견 사항 참조. |
| 6 | 중복 확정으로 선수·계약이 복제되지 않는다. | 확정 버튼 동시 클릭 2회 → revision 정확히 2 증가(CONFIRM_PLAYER+ADVANCE), 카드 1장 | ✅ | `e2e/resilience.spec.ts`("(b) 확정 버튼을 두 번 클릭") | `data-testid="career-card" data-revision`으로 화면 값 확인(이 작업의 유일한 화면 코드 변경). |
| 7 | 실패 결과도 안전한 계약 또는 재도전 경로를 제공한다. | 이벤트 반복(최대 10회 상한) 여러 스펙에서 매번 offers까지 도달, 막다른 상태 0건 | ✅ (간접) | `e2e/first-contract.spec.ts`, `e2e/session-length.spec.ts`, `e2e/a11y.spec.ts`, `e2e/keyboard.spec.ts` — 전부 도메인 가중 랜덤으로 서로 다른 이벤트 조합을 거치지만 항상 제안까지 도달 | 전용 스펙은 아니고, 여러 스펙이 반복 실행되며 쌓은 간접 증거. |
| 8 | 생성된 Career에 서비스 시즌·규칙·콘텐츠 버전이 고정된다. | 허브 카드에 `rulesetVersion`/`contentPackVersion` 표시 | ✅ | `apps/web/src/routes/index.tsx`(CareerCard "규칙·콘텐츠 팩" dl), `e2e/hub.spec.ts` | |
| 9 | 복구 코드로 다른 브라우저에서 같은 Career를 연다. | 컨텍스트 A 발급 → B 복구 통과(스텁 3회, 실 api 3회 연속) | ✅ | `e2e/settings-data.spec.ts`(스텁), `e2e/recovery-api.spec.ts`·`e2e/recovery-conflict.spec.ts`(E2E_WITH_API=1, TEST-E2E-008 충돌 포함) | |
| 10 | 온보딩을 건너뛰어도 첫 프로 계약까지 5분 이내다. | 자동화 시간 `automationMs`, 최소 조작 시간 `minimalHandlingSec` — 아래 측정값 표 | ✅ | `e2e/session-length.spec.ts`(TEST-E2E-009 + 11) | |
| 11 | 대시보드에서 어떤 명령도 확정되지 않는다. | 코드 검토: `career.$careerId.index.tsx` 마운트 시 뮤테이션 호출 없음(`screen_viewed` 분석 이벤트만) | ✅ (간접) | 코드 검토 + `e2e/sync.spec.ts`(대시보드 진입이 revision을 바꾸면 실패했을 시나리오들이 전부 통과) | 대시보드 진입만으로 명령이 확정되지 않는다는 것을 직접 assert하는 전용 스펙은 없다. |
| 12 | 모든 화면이 시각 토큰만 쓰고 UI 문자열에 폐기 어휘가 없다. | 자동 검사 도구 없음 | ⚠️ 미확인 | — | 이 조건을 검사하는 lint·스크립트를 찾지 못했다(grep으로 확인). 수동 디자인 리뷰가 필요해 이번 작업 범위 밖으로 남긴다. |
| 13 | 화면·엔진 코드에 `@apps-in-toss/*` import와 채널 분기가 없다(lint로 확인). | `pnpm lint && pnpm lint:deps` 통과 | ✅ | 루트 검증 체인(아래) | |
| 14 | ADR-008: 개인정보 처리방침에 국외 이전 항목(이전받는 자·국가·항목·목적·보유기간) 명시. | 본문에 "처리 위탁"(Cloudflare 언급)은 있으나 ADR-008이 요구하는 5개 항목별 표는 없음 | ❌ | 코드 검토: `apps/web/src/legal/privacy.tsx`(전체 읽음, "국외"·"해외"·"이전받는" 0건) | T-1-012가 초안을 만들었으나 국외 이전 세부 항목은 아직 없다. `apps/web/src/legal/**`는 이 작업의 허용 범위 밖(화면 코드, data-testid 외 수정 금지)이라 고치지 않았다. |
| 15 | Google 실계정 검증(U-003). | 대기 | ⏳ U-003 대기 | `docs/tracking/decision-log.md`(T-1-013), ADR-008 | 로컬은 `GOOGLE_FAKE=1` 가짜 OIDC로만 검증됨(`e2e/google-link.spec.ts`). 실계정 자격 증명은 U-003이 아직 채우지 않았다. |

## 측정값(TEST-E2E-009 + 11 "세션 길이 목표")

`test-results/session-length.json`(스텁 API, `e2e/session-length.spec.ts`):

```json
{"automationMs":2302.8,"minimalHandlingSec":58,"counts":{"screens":13,"selections":10,"textInputs":1,"confirmations":14}}
```

- 자동화 시간(브라우저 조작 자체): 약 2.3초(5분 미만).
- 최소 조작 시간(D-22 단가: 화면 1.0초·선택 2.0초·텍스트 입력 4.0초·확정 1.5초, 애니메이션 대기는 건너뛰어 0) = 13×1.0 + 10×2.0 + 1×4.0 + 14×1.5 = **58초**(5분 미만).
- 실행마다 값이 100% 동일함을 5회 연속 확인(도메인 가중 랜덤이지만 스텁 seed가 고정이라 결정론적).

## 측정값(허브 LCP·폰트 CLS, `E2E_PREVIEW=1`)

`e2e/perf.spec.ts`, 커리어 카드 3장, 4G 스로틀링(다운 4Mbps·RTT 150ms), 3회 측정 중앙값:

| 지표 | T-0-013 기준선(빈 Phase 0 껍데기, decision-log.md) | 이번 측정(Phase 1 허브, 카드 3장) |
|------|------|------|
| LCP | 2519ms | 1136ms |
| CLS | 0 | ~0.0001(사실상 0) |

목표(LCP 2.5초·CLS 0.1)는 D-22 지시대로 assert하지 않았다 — Phase 1 허브가 T-0-013 빈 껍데기보다도
빠르게 나왔다(로컬 IndexedDB만 읽어 네트워크 왕복이 없다). 3회 실행 모두 재시도 0으로 통과했다.

## 루트 검증 체인

```
pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle && pnpm --filter @offside/web e2e
```

결과는 PR 본문에 스펙 수·시간과 함께 적는다.

## 범위 밖 발견 사항(고치지 않음)

1. **SCR-002 포지션 구분 탭 키보드 도달 불가(가장 심각, 출시 차단 기준 해당 가능)**: `TabsList`(골키퍼/수비수/미드필더/공격수)가 `<RadioGroup>` 안에 중첩돼(`career.$careerId.create.tsx:330-360`) Radix의 두 roving-tabindex 관리자가 충돌한다. 트리거 4개 전부 `tabindex="-1"`(선택된 것 포함)이라 Tab으로 절대 도달할 수 없다 — 직접 확인: Tab이 "왼발" 라디오에서 곧장 (탭이 아니라) 포지션 카드로 건너뛴다. 대시보드(SCR-029)의 동일 `Tabs` 컴포넌트는 `RadioGroup`에 중첩되지 않아 정상 작동한다(직접 확인, Tab으로 진입). 08 "출시 차단 기준: 키보드로 P0 흐름 완료 불가"에 해당할 수 있다.
2. **COMMITTING 중 뒤로 가기 경고 대화상자 없음**: 06 문서가 요구하는 "명령 응답 대기 중 뒤로 가기 → 경고 대화상자"가 실제로는 구현돼 있지 않다(`platform.lifecycle.onBackPressed`가 어디서도 호출되지 않는 죽은 코드). `resilience.spec.ts`(d)는 실제 동작(경고 없이 재진입 시 확정 결과가 보임)을 그대로 특성화했다.
3. **결과 확정 시 aria-live 영역 없음**: 08 접근성 체크리스트가 요구하는 "결과 변화가 aria-live로 한 번만 낭독"이 실제로는 없다. 이벤트 확정→결과 화면 전환 경로 어디에도 `aria-live`/`role=status`가 없다(`ScreenStateView`의 announcer는 어디에도 마운트되지 않는 죽은 코드). `a11y.spec.ts`가 `MutationObserver`로 실제 개수(0건)를 기록했다.
4. **선호 포지션(`preferredPosition`)이 화면에 전혀 노출되지 않음**: 완료 조건 표 #5. 계약(스키마)엔 있지만 대시보드·이벤트 화면 모두 `primaryPosition`만 읽는다.
5. **ADR-008 국외 이전 항목 미기재**: 완료 조건 표 #14. 개인정보 처리방침에 "처리 위탁"(Cloudflare) 언급은 있으나 이전받는 자·국가·항목·목적·보유기간을 명시한 절은 없다.
6. **`screen_viewed` 분석 이벤트의 `careerPhase`가 SCR-002/003/004에서 전부 `'YOUTH'`로 고정**: `career.$careerId.create.tsx:115`·`style.tsx:68`·`confirm.tsx:52`. 다만 세 화면 모두 동일하게 고정돼 있고 Phase 1엔 YOUTH 외 다른 생성 단계가 없어, 의도된 단순화인지 방치된 자리표시자인지 애매하다 — 확실한 버그로 단정하지 않는다.
7. **Google 로그아웃 뒤 로컬 커리어 동기화 배지**: 코드 검토(`api/client.ts` "로컬 IndexedDB는 건드리지 않는다(ADR-008)" 주석, `careers.ts:158` "PUT은 다른 사람 소유도 404로 응답") 결과, 로그아웃 뒤 배경 동기화가 PUT에서 404(CAREER_REVISION_CONFLICT가 아닌 CAREER_NOT_FOUND)를 받아 `sync/client.ts`의 "그 외는 FAILED" 분기로 떨어진다. `SyncBadge`는 이 경우 "서버 저장 실패"(danger)를 보여줄 뿐, 401 전용의 "로컬 전용"+"다시 연결" 안내로는 이어지지 않는다 — 원인(로그아웃)을 알 길 없는 채로 영구히 재시도-실패를 반복하게 된다. 라이브로 재현하지는 않았다(정적 코드 추적).
8. **설정 "다시 연결" 뒤 대시보드 LOCAL_ONLY 배지 잔존 여부**: 확인 결과 버그 아님으로 보인다. `useSyncState`/`useSyncSummary`(`engine/use-sync.ts`)는 `useSyncExternalStore` + 전역 구독자 Set으로 구현돼 있어, "다시 연결"이 트리거하는 `sync` 클라이언트 상태 변화는 같은 careerId를 구독하는 모든 컴포넌트(대시보드 포함)에 반응형으로 전파된다. 라이브 재현은 하지 않았다(정적 코드 추적).
9. **axe `page-has-heading-one`(moderate) 다수 화면에서 반복 발견**: SCR-013/014/029 등 여러 화면에서 `<h1>`이 없다는 moderate 위반이 나온다(serious/critical은 아니라 완료 조건엔 영향 없음). `a11y.spec.ts` 콘솔 로그에 화면별로 남아 있다.
10. **(이미 고침) `recovery-api.spec.ts`의 성별 라디오 누락**: T-1-016이 SCR-002에 성별을 필수로 추가한 뒤 이 스펙의 온보딩 헬퍼가 성별을 채우지 않아 실 api 실행 시 `/style`로 못 넘어갔다. 이번 작업에서 `helpers/recovery.ts`로 고쳤다(첫 커밋).
