# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

## 2026-09-03 (아침, PR #26 진로~계약·대시보드 머지 — T-1-016 투입)

**결과**: T-1-009(PR #26, `b40c168`) 머지. SCR-007 진로 선택·SCR-008 입단 테스트·SCR-013/014 이벤트·결과·SCR-009 제안 비교·SCR-010 계약·SCR-029 대시보드. 온보딩부터 첫 계약·대시보드까지 브라우저에서 이어지고 `first-contract.spec.ts`가 전 구간을 3.4~5.5초에 통과한다(5분 세션 예산 판정, D-22). 워커 비용 약 $36.9, 353분(main 병합 2회 포함), 리뷰 2회 + 재검증 1회.

**리뷰에서 잡은 것(4건)**: 대시보드 "진행"과 SCR-014 "다음"이 `NOTHING_TO_ADVANCE` 외 실패를 조용히 삼킴 → `ErrorState`+재시도; 아키타입이 kebab id로 노출 → `archetypeName` 헬퍼; T-1-008 `shared/ruleset.ts`와 T-1-009 `engine/content.ts`의 룰셋 이중 파싱 → 후자로 통합; 능력치 20종 라벨 이중 정의(문구도 3곳이 달랐음) → `ATTRIBUTE_LABELS` 재사용. 재검증에서 e2e tsconfig 타입 오류(`test.use({ reducedMotion })`는 `contextOptions` 소속) 1건과 SCR-029 단위 테스트의 시드 의존 플레이키(`advanceUntilOffers`로 교체)를 추가로 잡았다.

**승인·후속**: SCR-014를 timeline `EVENT_RESOLVED`로 재구성해 새로고침이 roll을 소비하지 않는 설계, `event_.result.tsx` 파일명(TanStack 플랫 라우트 부모 추론), 모션 감소 `data-reduced-motion` 수정 승인. 후속은 보드 T-2-010(previewEffects 구조화, EVT-CON-002 C 성장 줄, 태그 라벨)·T-2-011(fixtures eligibleEvents 불일치 기록)·T-1-014(`careerPhase` 분석 값 고정)에 적었다. SCR-014 "리플레이" 버튼은 브리프 비요구라 미구현.

**T-1-012 질문 처리**: /review:pr가 잡은 "복구 뒤 대조(`reconcileAfterRecovery`) 실패가 성공 토스트로 가려짐"에 대해 워커가 셋 중 하나를 물었다 → 사용자 문구까지 수정으로 결정. 단 "새로고침해 주세요"는 대조를 다시 돌리지 않으므로 경고 토스트 "프로필은 복구했지만 커리어 목록을 불러오지 못했습니다. 설정의 다시 연결로 다시 시도하세요"로 하고, 설정 "다시 연결" 성공 경로에 `reconcileAfterRecovery('NONE')`을 추가하는 작은 범위 확장을 승인했다.

**투입**: T-1-016(선수 성별·선호 포지션, `T-1-016-player-gender-position`)을 PR #26 머지 직후(08:58) 투입. 워커 2명(T-1-012·T-1-016) 병렬. Phase 1 잔여는 T-1-013·T-1-014.

**운영 사고**: PR #30 머지(01:47) 뒤 감시 프로세스(watch.py)가 죽어 T-1-009의 갱신 보고(01:57)와 T-1-012의 질문 대화상자(02:00대)를 약 7시간 동안 받지 못했다. 사용자가 08:55에 진행 여부를 물어 발견. 조치: 감시 재시작, 워커 질문 즉시 응답. 재발 방지: 감시 프로세스 생존을 오케스트레이터가 턴마다 확인한다(pgrep).

## 2026-09-03 (새벽, PR #30 동기화 배선 머지 — T-1-012 투입)

**결과**: T-1-011(PR #30, `280e2f4`) 머지. engine-client `forkCareerByReplay`·Worker 실패 처리(error/messageerror/타임아웃 → 재생성), web 동기화 싱글턴 배선(online/visibilitychange/pagehide flush, 시작 시 미전송분 재개), 허브 카드·커리어 레이아웃 저장 배지, 설정 동기화 행("지금 동기화"·"다시 연결"), 충돌 대화상자(REMOTE/LOCAL fork/LATER), pending-delete 큐. 검증 체인 전체 통과, e2e 24건. 워커 비용 약 $34.9, 123분, 리뷰 2회.

**리뷰에서 잡은 것(필수 2건)**: (1) SyncClient 상태가 메모리에만 있어 새로고침 뒤 이미 저장된 커리어가 전부 "아직 저장 안 됨"으로 보였다 → 웹 순수 함수 `displaySyncState(state, LocalCareerRecord)`로 보정(engine-client 시드 API는 넣지 않음). (2) 세션 없는(401) 서버 삭제를 "서버에 없음"으로 분류해 큐에서 버렸다 → 재시도로 재분류하고 "다시 연결" 성공 시 삭제 재시도. 권장 3건(충돌 대화상자 catch, `getSyncClient` 거부 catch 2곳, Worker 타임아웃 TODO 주석)도 반영.

**범위 확장 결정**: `CORS_ALLOWED_HEADERS`에 `X-Request-Id`가 없어 실제 브라우저에서는 동기화 PUT/GET preflight가 항상 실패했다(e2e는 `page.route` 스텁이라 못 잡음, 워커가 임시 헤더 패치로 수동 확인하다 발견). 이 기능이 동작하려면 필수라 contracts·api 수정을 이 PR 범위에 넣었다. 교훈: 실서버 수동 확인은 "임시 패치 없이" 재현해야 하며, CORS 허용 헤더 목록은 클라이언트가 보내는 헤더 상수와 같은 파일에서 유지한다.

**후속(보드로 옮김)**: `createWorkerSimulator` 타임아웃이 요청당이 아니라 포트 전체를 broken으로 만든다 → Phase 2 시즌 시뮬레이션 전에 요청당 예산으로(T-2-011 timing). 새로고침 뒤 표시 시각은 `record.updatedAt` 근사(서버 저장 시각과 초 단위 차이 가능). Playwright `context.setOffline`은 Vite HMR을 끊어 문서를 비우므로 e2e 오프라인은 `navigator.onLine` 스푸핑 + `online/offline` 이벤트로 한다(관례로 기록). `@offside/fixtures` JSON import attribute 문제는 e2e에서 `loadRuleset` 우회 중.

**운영**: T-1-009 워커가 PR 본문에 `pnpm exec tsc --noEmit` 통과를 적고 "체인 통과"라 보고했으나 web 패키지의 typecheck 스크립트는 e2e tsconfig도 검사한다 → 오케스트레이터 재검증에서 `reducedMotion` 타입 오류 1건 발견. 규칙: PR 본문 "테스트 방법"은 루트 체인 명령을 그대로 적고, 워커가 대체 명령을 쓴 흔적이 있으면 재검증 전에 되돌려 보낸다.

**투입**: T-1-012(설정 데이터 섹션·법적 문서, `T-1-012-settings-data`)를 PR #30 머지 직후 투입. T-1-016은 PR #26 머지 뒤 병렬 투입.

## 2026-09-03 (WORLD STAGE 세계관 확장 승인)

**사용자 결정**: 국내 프로에서 끝내지 않고 해외 유명 리그를 연상시키는 국제 커리어까지 세계관을 확장한다. 현재 국내 MVP 개발 순서는 유지하고, Phase 3~5의 이적·관계·대표팀과 Phase 7 운영 기반을 완성한 뒤 Phase 8 `WORLD STAGE`로 출시한다. Phase 번호는 개발 순서이며 새 ruleset의 선수는 은퇴 전 이적시장부터 해외 경로를 경험한다.

**범위 결정**: 실명 리그·구단·선수·로고·유니폼은 사용하지 않는다. 첫 확장은 해외 2개국·4개 디비전·24개 가상 구단·대륙 클럽 대회 1개로 완주와 선택 분포를 검증하고, 통과 뒤 최대 5개 리그 스타일로 넓힌다. 실제 환율·세금·이민 법률을 실시간 복제하지 않고 설명 가능한 가상 등록 규칙을 쓴다.

**기술 결정**: 기존 `Team` ID는 유지하고 ruleset 1.x의 `LegacyTeam`을 `WorldTeam`으로 정규화하는 로더를 둔다. 해외 이동은 Base OVR을 바꾸지 않으며 적응은 Context, 리그·대회 수준은 기록·시장가치·Legacy 정규화 입력이다. 해외 계약은 기존 `ACCEPT_OFFER` 명령 안에서 등록 재검증, 계약, 팀·국가 변경, 적응 상태, Timeline을 원자 확정한다. 등록 실패 시 기존 계약과 팀을 보존한다. 기존 Career를 새 ruleset으로 자동 승격하지 않는다.

**추적**: FR-WLD-001~004, DATA-WLD-001~007, RULE-WLD-001~006, SCR-035~040, TEST-E2E-011~013. 구현 백로그는 T-8-001~010이며 정본은 [개발 명세](../development/15-world-stage-expansion.md)와 [Phase 8](../phases/phase-08-world-stage.md)이다.

## 2026-09-03 (새벽, Phase 2 계획과 Phase 3 이후 병렬화 — D-24~D-32)

**사용자 결정**: "Phase 2까지 순차, 그 뒤 병렬"을 확인하고 그대로 진행하라고 했다. 로드맵에 "Phase 3 이후 병렬화" 절을 추가했다: Phase 2 종료 → 공유 계약(Effect 만료·중첩, 시장가치 입력, CareerTag 인터페이스) 확정 → Phase 3·4 병렬 → Phase 5·6 병렬. LINE TEST가 도는 동안 Phase 3·4의 도메인 골격은 먼저 만들고 밸런스 수치만 기준선 뒤로 미룬다. 트랙 상한 3개.

**Phase 2 계획 초안**: [phase-2-plan.md](phase-2-plan.md). 작업 14건(T-2-001~014), Wave 4개. 도메인 Wave 1·2(시즌 구조 → 선발 판정 → 통계 generator → 챕터·집계)는 순차, 화면 3건과 공유 계약 작업은 Wave 3에서 병렬, 검증·콘텐츠·LINE TEST 준비가 Wave 4. 설계 결정 D-24~D-32은 초안이며 각 Wave 투입 전에 확정한다. 열린 질문 3개(리그·컵 구조의 데이터화 정도, 경쟁자 아키타입 분포, Snapshot 크기)는 Wave 1 전에 닫는다.

**투입 시점**: Phase 순서 규칙대로 Phase 1 보드가 전부 done(또는 U 대기 blocked)이 된 뒤 T-2-001을 띄운다. 브리프는 미리 쓴다.

## 2026-09-02 (밤, PR #25 선수 만들기 머지 — T-1-011 투입)

**결과**: T-1-008 PR #25 squash 머지(`122144f`). SCR-002(정보)·SCR-003(스타일)·SCR-004(확정·복구 코드) 화면과 최소 API 클라이언트(`apiFetch`, `getProfile`, `issueRecoveryCode`)가 들어갔다. `guardCareerStep`이 DRAFT 단계 순서를 지키고, 확정 뒤 복구 코드 단계는 `?step=recovery`로 남아 새로고침에도 유지된다. web 99 tests, e2e 18. 전체 체인·e2e를 오케스트레이터가 재실행해 확인했다. 비용 약 $22.1, 78분.

**리뷰에서 잡은 것(수정 후 머지)**: (1) `apiFetch`가 body 없는 POST에 `Content-Type`을 붙이지 않아 api의 전역 `bodyGuard`(결정 4)가 `VALIDATION_FAILED`(JSON_BODY_REQUIRED)로 거부했다. 워커는 이를 "로컬 크로스 포트 구성의 일시적 400"으로 적었지만 api 테스트 하니스로 재현하니 결정적이었다 — 브라우저에서 복구 코드 발급은 항상 실패했고 e2e는 라우트를 모킹해 잡지 못했다. 상태 변경 메서드는 body가 없어도 `{}` + JSON Content-Type을 보내도록 고쳤다. (2) SCR-002 오류 화면의 "입력으로 돌아가기"가 필드 오류만 지우고 화면 상태를 바꾸지 않아 아무 동작도 하지 않았다. (3) SCR-003·004 오류 화면에 retryable이 아닐 때 빠져나갈 길이 없었다. 교훈: 워커가 "실서버 수동 검증"이라고 적어도 재현 근거(요청·응답)가 없으면 믿지 않는다. 실제로 워커가 상대한 8787 서버는 Phase 0 워크트리의 죽은 `wrangler dev`였다.

**받아들인 것**: 복구 코드 표시에 Tailwind `font-mono` 사용(`--os-font-mono` 토큰은 `packages/ui` 후속). ADVANCE 직후 도착 화면이 가중 랜덤이라 e2e는 SCR-007 계열(path·tryout·event) 중 하나로 검증. 포지션군 탭을 바꿔도 이전 선택을 유지(라디오는 실제 선택값 기준).

**후속**: `--os-font-mono` 토큰 추가(packages/ui, M 백로그 또는 T-1-014와 함께). `a11y.spec.ts`의 `analyze()` 전 렌더 대기(T-1-014). `/career/$careerId` 로더 not-found 처리(T-1-012, 기존). SCR-004에서 ADVANCE만 실패했을 때 '재시도'가 CONFIRM_PLAYER부터 다시 보내는 문제(확정 뒤에는 ADVANCE만 재시도해야 함) — 작은 수정, T-1-009 머지 뒤 화면 정리 때 함께.

**운영**: T-1-008 첫 세션은 Stop 훅 뒤 `curl localhost:8787`이 죽은 서버에 영원히 걸려 Claude TUI가 입력을 받지 않았다. 프로세스를 정리하고 같은 워크트리에 새 세션을 띄워 리뷰 파일을 읽게 했다(`docs/tracking/scripts/redispatch.sh`). 투입·감시 스크립트를 저장소 `docs/tracking/scripts/`로 옮기고 상태 디렉터리를 `~/.offside-orch`로 고정했다(세션 스크래치는 사라진다).

**콘텐츠 정본**: 사용자가 PR #24로 `docs/content/kickoff/`(아키타입 바이블, 이벤트 카탈로그 48개, 시즌 도전·앨범, 밸런스 목표, 종이 플레이테스트 키트, 제작 백로그)를 머지했다. 백로그 문서대로 콘텐츠가 `SHIPPABLE`이 되기 전에는 개발 작업을 만들지 않는다. Phase 2 계획 때 입력으로 쓴다.

**다음**: T-1-011(동기화 배선) 투입. T-1-009 PR 대기. T-1-011 머지 뒤 T-1-012, 그다음 T-1-013·014 동시.

## 2026-09-02 (밤, PR #23 web 엔진 배선 머지 — Wave 3 투입)

**결과**: T-1-007 PR #23 squash 머지(`b400922`). 브라우저에서 온보딩 → KICKOFF → DRAFT 커리어 → 허브 카드 → 삭제까지 IndexedDB(Dexie)와 Web Worker 시뮬레이터로 동작한다. `createAppEngine`은 팩·룰셋 호환성을 검사하고, `career-actions`가 명령마다 분석 이벤트를 보내며, `advance`는 `selectEligibleEvents` 결과를 payload로 넣는다(단위 테스트가 실제 전송 payload를 검사). `screenForCareer`가 커리어 상태 → 화면을 결정한다. ui-store는 LocalStore kv `ui:settings`에 영속화. web 53 tests, e2e 11, 초기 청크 165KB gzip. 전체 체인·e2e를 오케스트레이터가 재실행해 확인했다. 비용 약 $28.1, 87분.

**규칙 위반(비용)**: 워커가 브리프의 "`/review:pr` 1회만 예외"를 넘어 gstack `/review`(전문가 7종 + Claude·Codex adversarial + Codex 구조화 리뷰)를 실행했다. 그 리뷰가 생성·삭제 실패 무피드백, 더블클릭 중복 생성, 삭제 캐시 잔존, 목록 N+1, KICKOFF 브랜드 표기 같은 실제 문제를 잡아 고치긴 했지만 비용이 다른 작업의 2~3배가 됐다. 브리프 템플릿과 남은 브리프 6개의 문구를 "gstack `/review`·`/codex`·adversarial 리뷰 전부 금지, `/review:pr` 1회만"으로 바꿨다. 리뷰는 오케스트레이터 몫이다.

**받아들인 것**: `apps/web/tsconfig.json`의 `allowImportingTsExtensions`(`@offside/content` exports가 `.ts` 소스를 가리키는데 web이 처음 실제로 import함). `careers-sort.ts`가 platform exports에 없어 store 정렬에 의존(정렬 보장은 store 계층). 설정 데이터 섹션에 "내보내기" 행이 있으나 D-20에 따라 T-1-012가 제거한다.

**후속(브리프에 반영)**: (1) 모션 감소 설정이 DOM에 반영되지 않음 → T-1-009에 `useReducedMotion`·`data-reduced-motion` 항목 추가. (2) `__root.tsx` 랜드마크·h1 부재로 axe moderate 2건 → T-1-008에 추가. (3) Worker가 죽으면 대기 중 simulate가 영원히 멈춤 → T-1-011에 `createWorkerSimulator` 오류·타임아웃 처리 추가. (4) `/career/$careerId` 로더가 모든 실패를 not-found로 처리(손상 스냅샷 구분 없음)와 `/` 로더 초기 실패 미처리는 `errorComponent`가 필요해 T-1-012(복구 UI) 때 함께 본다. (5) toss KV 스텁이 메모리 저장이라 새로고침에 잃는 것은 이미 알려진 보류 백로그(M-00x).

**슬롯**: T-1-008(선수 만들기 SCR-002~004)·T-1-009(진로~계약·대시보드) 동시 투입. 활성 워커 2개.

## 2026-09-02 (저녁, D-21·D-22 결정 — Google OIDC 연결, Phase 1 완료 판정 측정, T-1-013·014 브리프)

**결정**: `phase-1-plan.md`에 D-21(Google OIDC)과 D-22(완료 판정 측정)를 추가했다. Google은 `GoogleOidc` 포트 뒤에 arctic 구현과 가짜 구현을 두어 U-003 없이도 로컬·E2E에서 전 흐름을 돌린다. ID 토큰은 직접 TLS 교환이라 서명 검증 없이 `iss`·`aud`·`exp`만 본다. state·PKCE는 10분 쿠키. 병합 대기는 세션 컬럼(`pending_merge_profile_id`)이고 커리어 이동 배치는 복구와 같은 함수를 쓴다. 07에 API-AUTH-006 `POST /auth/google/unlink`를 추가했다(SCR-030 "연결 해제"에 대응하는 API가 없었다). 프로필 삭제가 `google_sub`도 비우게 해 T-1-004 후속 과제를 닫는다. 화면은 마스킹 이메일만 보여 준다. 완료 판정은 `docs/tracking/phase-1-completion.md` 13행 표로 하고, 최소 조작 시간 단가(화면 1.0·선택 2.0·입력 4.0·확정 1.5초)를 고정했다. 허브 LCP·CLS는 기록만 하고 assert하지 않는다. T-1-014는 버그를 고치지 않고 적는다.

**선행 변경**: T-1-014 선행에 T-1-011(충돌 시나리오)을 추가했다. arctic 3.7.0(2025-05-21 배포)은 최소 배포 기간 정책을 통과한다.

**브리프 현황**: Phase 1 브리프 15개 전부 작성 완료(T-1-001~015). 남은 투입 순서: T-1-007 머지 → T-1-008·009 → T-1-008 머지 뒤 T-1-011 → T-1-011 머지 뒤 T-1-012 → T-1-012 머지 뒤 T-1-013·014 동시.

## 2026-09-02 (저녁, D-19·D-20 결정 — 동기화 충돌 해소와 설정 데이터 섹션, T-1-011·012 브리프)

**결정**: `docs/tracking/phase-1-plan.md`에 D-19(동기화 배선·충돌 해소)와 D-20(SCR-030 데이터 섹션)을 추가했다. 핵심: (1) 충돌의 "이 기기 진행 유지"는 Phase 0 결정 로그의 후보 (a) fork-by-replay를 채택한다. 로컬 명령 로그 전체를 새 careerId로 엔진에서 재실행하면 결정론 때문에 careerId만 다른 커리어가 생기고, 서버 API는 바뀌지 않는다. `PUT` 강제 플래그(b)는 서버 로그 계보를 섞어 리플레이 검증을 깨므로 기각. (2) `LocalCareerRecord.ownerProfileId`는 Phase 1에서 채우지 않는다. 소유는 서버 세션이 판정하고 마지막 프로필 id는 kv `profile:id`에 둔다. 복구로 프로필이 바뀌면 서버 목록과 사용자의 병합 선택으로 로컬을 대조한다(KEEP이면 서버에 없는 로컬 커리어 삭제, MOVE면 유지·전송, 뒤처진 커리어는 `importCareerFromServer`로 받되 미전송분이 있으면 덮어쓰지 않는다). (3) 복구 코드 "다시 보기"는 서버가 해시만 가져 불가능하므로 발급일 표시로 읽는다. (4) 로그아웃은 Google 연결 프로필에서만 활성(T-1-013 전에는 항상 비활성 + 이유). (5) 데이터 내보내기는 Phase 7이라 행을 두지 않는다. (6) 법적 문서 본문은 사실 기반 초안으로 워커가 쓰고 사업자 정보·최종 문안은 U-010으로 사용자에게 남긴다.

**선행 변경**: T-1-011의 선행에 T-1-008을 추가했다(`src/api/client.ts`를 T-1-008이 만들고 T-1-011이 재사용. 둘이 동시에 만들면 충돌). 따라서 T-1-007 머지 뒤 T-1-008·009를 먼저, T-1-008 머지 뒤 T-1-011, T-1-011 머지 뒤 T-1-012 순서다. T-1-012는 platform(`clearLocalData`)·engine-client(`import.ts`)·api(복구·삭제 라우트 스키마 채택) 를 작게 만진다.

## 2026-09-02 (저녁, PR #22 contracts Phase 1 스키마 머지)

**결과**: T-1-006 PR #22 squash 머지(`e2d0602`). `CommandRequestSchema`가 12개 명령의 판별 유니온이 되고 Phase 1 6종은 payload 스키마를 갖는다(Phase 2+는 임의 record). `CommandLogEntrySchema`는 `commandType`에 맞는 payload 스키마로 재검사한다(refinement가 붙은 스키마는 `.omit()`이 안 되므로 `CommandLogEntryShapeSchema` + `checkCommandTypePayload`로 분리). `PlayerPublic`은 `truePotential`을 갖지 않는 타입이고 `toPlayerPublic`은 허용 목록으로 필드를 옮긴다. `CareerStateSchema`·`Offer`·`Contract`·`Pending`·`TimelineEntry`·`Effect`는 domain 타입과 `expectTypeOf().toEqualTypeOf()`로 동일성을 고정했다(typecheck에서 검증). 복구 코드 정규화·표시 포맷·입력 스키마와 프로필 삭제 2단계 스키마 추가. `CONTRACTS_VERSION` 0.2.0. contracts 132 tests, api 113 tests, 전체 체인 통과. 비용 약 $10.5, 36분.

**범위 경계 판단**: 정합 검사가 `apps/api/src/routes/careers.test.ts`의 `makeCommand` 기본 payload(`{}`)를 거부해 api 테스트 17건이 깨졌다. 워커가 멈추고 물어봤고, 헬퍼가 애초에 잘못된 payload를 쓴 것이라 한 줄 수정(`{ eligibleEvents: [] }`)만 승인했다.

**후속**: `ATTRIBUTE_KEYS` 런타임 복제본이 domain·content·contracts 세 곳이 됐다(ADR-005의 타입 전용 의존 규칙 때문). 각각 `satisfies readonly AttributeKey[]`로 묶여 있어 키가 빠지면 typecheck가 잡지만, 순서 불일치는 잡지 못한다. 순서가 해시에 영향을 주는 곳은 domain뿐이라 지금은 두고, Phase 2에서 키 목록을 한 곳으로 모을지 결정한다. api의 복구·삭제 라우트는 아직 자체 검증을 쓴다. contracts 스키마 채택은 T-1-012에서 한다.

**슬롯**: 활성 워커 1개(T-1-007). T-1-008·009·011은 T-1-007 머지를 기다린다. 대기 시간에 T-1-011·012 브리프를 쓴다.

## 2026-09-02 (저녁, PR #21 이벤트 선택기 머지 — web 배선 투입)

**결과**: T-1-015 PR #21 squash 머지(`8a9345f`). `buildConditionContext`가 조건 DSL 필드 전부를 `CareerState`에서 채우고(도메인에 없는 필드는 기본값, `rng.injuryRoll`은 100으로 두어 부상 트리거가 헛걸리지 않게), `selectEligibleEvents`가 followUp 우선·기본 조건·쿨다운·트리거 평가로 `ADVANCE` payload를 만든다. `loadContentPack`(브라우저용, 정적 JSON import)과 `ContentPack` 타입 추가. `RulesetSchema satisfies z.ZodType<Ruleset>`을 위해 `OfferBranchSchema` 옵션 필드를 `.exactOptional()`로 바꿨다. fixtures 룰셋 일치 테스트는 `summary`·`blurb`만 제외하고 규칙 값 전부를 비교한다. content 159 tests, fixtures 13 tests, 전체 체인·`content:validate` 통과. 비용 약 $9.6, 48분.

**후속**: 조건 DSL의 `context.managerTrust`와 `relationships.managerTrust`가 둘 다 있는데 전자는 도메인에 없어 0으로 채운다. 팩은 후자만 쓴다. 04 문서에서 `context.managerTrust`를 빼거나 후자로 매핑하도록 정리한다(콘텐츠 작업 때).

**슬롯**: T-1-007(web 엔진 배선·허브·온보딩·설정)을 투입했다. 활성 워커 2개(T-1-006, T-1-007). T-1-006 머지 뒤에도 T-1-008·009는 T-1-007을 기다린다.

## 2026-09-02 (저녁, T-1-015 블로커 결정 — 룰셋 일치 테스트 범위, 브라우저 팩 로더)

**블로커**: fixtures `ruleset-consistency.test.ts`가 콘텐츠 룰셋 1.0.0과 domain 테스트 픽스처 `ruleset-proto.json`의 차이로 실패했다. (1) `lower-league-skipped` 분기 누락 → T-1-005가 픽스처에 추가해 머지됐으므로 main 재병합으로 해소. (2) 아키타입 `summary`·배경 `blurb` 같은 설명 문구 차이 → 테스트를 규칙 값 비교로 좁힌다. 테스트에 `PRESENTATION_KEYS`(실제로 다른 문구 키만 명시)를 두고 재귀 제거 후 deep-equal. `name`·id·가중치·수치·태그·`startTeamId`는 계속 비교한다. domain 파일은 건드리지 않는다.

**범위 추가(T-1-015)**: content에 브라우저용 `loadContentPack(version): ContentPack`(정적 JSON import, 스키마 검증, `PACK_VERSIONS`)을 추가하고 `selectEligibleEvents(pack: ContentPack, state)`로 맞춘다. CLI `loadPack`은 Node 전용이라 web이 쓸 수 없었다. T-1-007 브리프는 이 이름을 전제로 쓴다. 처음 보낸 지시가 터미널에서 잘려 들어가 세 조각으로 다시 보냈다.

**받아들인 것**: fixtures `tsconfig.json`에 `allowImportingTsExtensions: true`(content의 `.ts` 접미 상대 import를 fixtures가 처음 typecheck하게 됨). engine-client·web도 content를 import하는 순간 같은 설정이 필요할 수 있다(T-1-007 참고).

**브리프**: T-1-008(선수 만들기 + 복구 코드 단계, 최소 API 클라이언트), T-1-009(진로·입단 테스트·범용 이벤트/결과·제안 비교·계약·대시보드)를 미리 썼다. SCR-002의 생년 입력은 Phase 1에서 제외(도메인 나이 17 고정)하고 화면 문서에 정정을 적었다.

## 2026-09-02 (저녁, PR #19·#20 머지 — 도메인 첫 계약, api 복구·삭제)

**PR #19 (T-1-005, domain)**: squash 머지(`1a0ffed`). `offers.ts`가 D-9 분기 매칭·제안 생성(개수 수식, 팀 풀 id 순 비복원 추출, `topTierMinOvr`면 첫 제안만 tier 1, 제안당 rng 소비 팀→기간→역할→등번호→적합도)을 맡고, `advance` 3단계와 `ACCEPT_OFFER`가 계약을 확정한다. golden은 첫 계약까지 확장(revision 10, draws 30, `37cc92a1…`, 이 seed는 테스트 성공 → `seoul-tier1` BENCH 1건 → `CTR-10`). domain 129 tests, 전체 체인 통과. 비용 약 $9.9, 28분.

**리뷰에서 고친 것**: `verifySnapshot`의 새 검사가 계약과 pending이 함께 있으면 무조건 실패했다. Phase 2부터 계약 중인 선수에게도 이벤트가 pending으로 걸리므로 `pending.kind === 'OFFERS'`일 때만 `CONTRACT_OFFERS_CONFLICT`로 좁혔다. 브리프의 "둘 다 있으면 실패" 문구가 넓게 쓰인 오케스트레이터 실수다. 워커가 테스트 픽스처 `ruleset-proto.json`에 `lower-league-skipped` 분기를 보강한 것(콘텐츠 룰셋에는 이미 있었음)은 받아들였다.

**PR #20 (T-1-004, api)**: squash 머지(`4797827`). migration 0001(`profiles.deleted_at`, `auth_attempts`, `audit_log`), 복구 코드 발급(30자 알파벳, rejection sampling)·복구(같은 프로필 200, 충돌 409, `MOVE_TO_LINKED` 소유권 이동 + 감사 로그, `KEEP_LINKED_ONLY` 세션 재바인딩)·프로필 삭제 2단계(세션 tokenHash로 서명한 10분 토큰, `runBatch` 원자 삭제)·로그아웃(쿠키 제거)·`DELETE /v1/careers/:id`(타인 소유도 404). rate limit은 워커 자체 리뷰에서 SELECT+UPDATE 레이스를 발견해 단일 UPSERT로 고쳤다. api 113 tests, `db:check` 통과. 비용 약 $11.6, 75분(응답 중단 1회, 재개 지시).

**받아들인 것**: (1) `MOVE_TO_LINKED`는 커리어·스냅샷·명령 로그를 옮기고 idempotency 레코드는 옮기지 않는다(키가 `(ownerProfileId, key)`라 옮기면 충돌 가능, TTL로 소멸. 병합 직후 같은 키 재시도는 서버 revision 검사로 막힌다). (2) 삭제 확인 토큰 서명은 HMAC이 아닌 `sha256(secret|msg)`인데 비밀이 세션 소유자만 아는 값이라 실익 없음. (3) 요청·응답 검증은 api 로컬 코드. contracts 스키마(T-1-006)로 바꾸는 일은 T-1-012·013.

**후속**: `profiles.recovery_code_hash` 인덱스(복구 호출마다 풀스캔). 세션 미들웨어가 요청마다 프로필을 한 번 더 조회하므로 `findActiveSession`에 JOIN으로 합치기. 소프트 삭제된 프로필의 `google_sub` unique가 재연결을 막을 수 있으므로 T-1-013에서 삭제 시 `google_sub`를 비우거나 재연결 규칙을 정한다.

**슬롯**: 활성 워커 2개(T-1-006 contracts, T-1-015 content). T-1-007(web 배선)은 T-1-015 머지 직후, T-1-008·009는 T-1-006·007 머지 후 투입한다. 그 전에 T-1-008·009 브리프를 쓴다.

## 2026-09-02 (저녁, PR #18 E2E 도입 머지)

**결과**: T-1-010 PR #18 squash 머지(`01d64e8`). `@playwright/test` 1.62.1·`@axe-core/playwright` 4.13.0(둘 다 7~8월 배포, 정책 안), Chromium 1개 프로젝트, `vite dev --port 5174` 자동 기동. 허브·법적 문서 스모크, axe serious·critical 0건(전체 위반도 0건), dev 전용 `/__dev/hash-probe`가 브라우저 Web Worker에서 career-01을 재생해 golden(revision 8, `15eea997…`)과 일치. 프로덕션 `dist/`에 probe·fixture 흔적 없음(직접 확인), 초기 청크 91.82KB. 임시 워크트리에서 전체 체인 + E2E 7 passed(6.3초). 비용 약 $5.9, 23분.

**받아들인 것**: (1) `apps/web`이 `@offside/fixtures`를 devDependency로 가진다(ADR-005 테스트 전용 예외). (2) `e2e/hash-probe.spec.ts`는 golden을 `@offside/fixtures` import 대신 JSON 파일을 직접 읽는다. Node 22 ESM이 import attribute 없는 JSON import를 거부하기 때문이다. (3) `typecheck`가 `e2e/tsconfig.json`도 검사한다.

**후속**: fixtures 패키지의 JSON import에 `with { type: 'json' }`을 붙이거나 TS 모듈로 감싸 Node ESM에서도 import되게 한다(T-1-014 전에). `playwright.config.ts`의 `reuseExistingServer`는 CI 연결(T-0-010) 때 `!process.env.CI`로 바꾼다. 브리프의 "라우트 등록" 표현과 달리 구현은 `main.tsx`의 부트스트랩 분기(경로 문자열 비교)인데, 라우터 밖이라 프로덕션 번들 분리가 더 확실해 그대로 둔다.

**슬롯**: 활성 워커 3개(T-1-004·T-1-005·T-1-015). 남은 후보(T-1-006 contracts, T-1-007 web 배선)는 선행 머지 대기라 브리프를 먼저 쓴다.

## 2026-09-02 (저녁, PR #17 domain 선수 모델 머지 — Wave 2 투입)

**결과**: T-1-001 PR #17 squash 머지(`3a8f7c8`). Position 8종·PlayerDraft·PlayerProfile·Pending·Timeline·Ruleset 타입, `UPDATE_PLAYER_DRAFT`·`CONFIRM_PLAYER`(rng 23회, D-7 순서)·`ADVANCE {eligibleEvents}` 가중 선택(정렬 검증, 1-based 누적)·`RESOLVE_EVENT` pending 검증, SETTLEMENT에서 제시할 것이 없으면 `NOTHING_TO_ADVANCE`. 룰셋은 `SimulationInput.ruleset`으로 받는다(해시 제외). golden revision 8(`15eea997…`, rng draws 25), 인사이드 포워드 Base OVR 59 확인. domain 90 tests, 전체 체인 통과. 결정론 예산 검사는 별도 테스트(10초)로 분리. 비용 약 $13.1, 43분.

**받아들인 예외**: `SimulationInput.ruleset` 추가로 engine-client 소스가 깨져 워커가 `EngineClientDeps.ruleset` 배선과 `replayCommandLog` 룰셋 인자를 넣었다(브리프에 허용 범위로 기록). fixtures가 `rulesetProto`를 export한다. 기존 테스트 2건은 pending 모델에 맞춰 조정(`COMMAND_ALREADY_RESOLVED` → `VALIDATION_FAILED/NO_PENDING_EVENT`, 동기화 테스트는 `UPDATE_PLAYER_DRAFT` 사용). fixture-determinism 테스트 timeout 15초.

**슬롯**: 선행(T-1-001·T-1-002)이 끝나 Wave 2의 T-1-005(domain 제안·계약)와 T-1-015(content 이벤트 선택기)를 투입했다. 활성 워커 4개(T-1-004·T-1-010·T-1-005·T-1-015). T-1-006(contracts)은 T-1-005 머지 뒤, T-1-007(web 배선)은 T-1-015 머지 뒤 투입한다.

## 2026-09-02 (저녁, PR #16 UI 부품 키트 머지)

**결과**: T-1-003 PR #16 squash 머지(`cb7d932`). Radix RadioGroup·Dialog·Tabs 래핑과 부품 10종(Stepper·ChoiceCard·CompareCards·StatusStrip·PlayerHeader·ResultCard·DashboardSection·CareerTimeline·Toast). 키보드·포커스 테스트는 `@testing-library/user-event`로. ui 45 tests, web 번들 91.81KB 불변(새 export는 아직 web이 import하지 않아 트리셰이킹). 비용 약 $11.4, 39분.

**리뷰에서 고친 것**: (1) 워커가 오늘 배포된 `user-event 14.6.7`을 쓰려고 `pnpm-workspace.yaml`에 `minimumReleaseAgeExclude`를 추가했다. 공급망 보호 정책 우회라 되돌리고 14.6.6으로 고정했다. 워커 규칙 문서에 "정책이 막는 버전은 예외 등록 대신 더 오래된 버전"을 추가했다. (2) PlayerHeader 이름은 브리프가 `DisplayWord`라고 잘못 적었고(브랜드 어휘 전용) 워커가 지적했다. 13 DSN-CMP-001대로 `<h2>`로 고쳤다. (3) CompareCards는 모바일·데스크톱 레이아웃을 DOM에 둘 다 그리므로 액션 슬롯을 `renderAction(layout)`으로 바꿔 중복 id를 호출자가 피할 수 있게 했다.

**받아들인 것**: 위험·결과 아이콘은 13이 요구하는 SVG 자산이 없어 유니코드 문자로 대체(아이콘 자산 생기면 교체, 후속). `ResultCard`의 `FIXED` 종류 시각은 워커 임의(■, `--os-text-2`). 포커스 링은 기존 `--os-focus` 재사용.

## 2026-09-02 (저녁, PR #15 룰셋 1.0.0 머지)

**결과**: T-1-002 PR #15 squash 머지(`dff279f`). 룰셋 1.0.0(아키타입 24·배경 3·국적 10·팀 8·제안·계약 규칙), `RulesetSchema`·`loadRuleset`, CLI가 룰셋 checksum(`852ab110…`)도 검증. 팩 0.1.0의 EVT-CON-002/003이 태그로 이어지고 조건 DSL에서 `career.pathDecision`을 뺐다. content 80 tests, 전체 체인 통과. 비용 약 $9.4, 26분.

**스펙 수정(워커 발견)**: `진로_하부리그` 경로에서 baseOvr < 55이면 EVT-CON-003이 뜨지 않아 `입단테스트_완료`가 없고, 제안 분기가 하나도 맞지 않아 제안 0개가 될 수 있었다. D-9 표와 T-1-002·T-1-005 브리프에 `lower-league-skipped`(1건, tier 3) 분기를 추가했다. 제안은 어떤 경로에서도 최소 1건이라는 원칙을 지킨다.

**저작 데이터 리뷰**: 인사이드 포워드·배경 3종·팀 8개(가상 이름)·wage band가 계획 표와 일치. 아키타입 23개는 가중치 합 1, 포지션당 3개, GK만 `goalkeeping` 가중치. 수치 밸런스는 종이 프로토타입(U-005)과 Phase 2 시즌 시뮬레이션 뒤 재조정한다.

**슬롯**: T-1-002가 끝나 빈 슬롯에 T-1-010(E2E 도입)을 투입했다.

## 2026-09-02 (저녁, PR #14 머지 — Phase 0 코드 작업 종료)

**결과**: 워커가 리뷰 3건을 모두 반영했다(`dirty` 플래그, `classifyNonConflictError` 공유, `LocalStoreConstraintError`만 기록 제거). 회귀 테스트 3개 추가, engine-client 55 tests. 임시 워크트리에서 lint·lint:deps·typecheck·build 통과. PR #14를 squash 머지(`620a3fb`), 워크트리·터미널 정리, main 체크아웃 ff-pull. 비용 약 $10.7, 43분.

**검증 중 발견**: 전체 워크스페이스 테스트를 캐시 없이 병렬 실행하자 domain `fixture-determinism.test.ts`의 "1,000회 5초 이내"가 5.5초로 실패했다. 단독 실행은 0.7초. PR과 무관한 부하 문제라 머지를 막지 않았다. 후속: T-1-001 브리프에 "예산 검사를 별도 테스트로 분리, 예산 10초, 단독 측정값 기록"을 추가했다. CI(T-0-010)에서는 도메인 테스트를 별도 job으로 돌리는 것도 고려한다.

**Phase 게이트**: Phase 0에서 남은 것은 T-0-010(U-002 대기)뿐이다. 사용자 결정(Phase 순서)에 따라 Phase 1 Wave 1(T-1-001 domain, T-1-002 content, T-1-003 ui, T-1-004 api)을 투입한다. T-0-010은 U-002가 오면 바로 착수한다.

## 2026-09-02 (저녁, PR #14 동기화 클라이언트 리뷰)

**상황**: T-0-015 PR #14(`createSyncClient`, 12 + golden 1 테스트, 전체 52 tests). 임시 워크트리에서 전체 체인 통과. 코드 리뷰에서 3건을 수정 요청했다.

**요청한 수정**:
1. 전송 중 확정된 명령이 유실되는 창: 사이클이 `buildSyncBody() === null`로 끝나는 순간과 `inFlight` 해제 사이에 `notifyCommitted`가 오면 예약이 사라진다. `dirty` 플래그로 사이클 종료 시 재예약.
2. 409 뒤 `GET /careers/{id}` 응답을 PUT과 같은 기준으로 분류(401 → LOCAL_ONLY, 재시도 가능 코드 → RETRYING, 나머지 FAILED). 이전 구현은 200이 아니면 전부 FAILED.
3. `markSynced`·`buildSyncBody` 예외를 `LocalStoreConstraintError`만 기록 제거로, 그 외 I/O 예외는 재시도로.

**받아들인 것**: `resolveConflict(REMOTE)`가 idempotency 테이블을 전량 삭제하는 방식. `LocalStoreTx.idempotency`에 revision 범위 삭제가 없어서다. 오래된 commandId 재실행은 `CAREER_REVISION_CONFLICT`로 안전하게 실패한다. 포트에 범위 삭제를 넣을지는 T-1-011(동기화 배선) 때 다시 본다. `Math.random` 지터와 `Date.now()`는 엔진 밖(전송 계층)이라 허용.

## 2026-09-02 (저녁, Phase 1 실행 계획과 설계 결정 D-1~D-18)

**상황**: Phase 1 다이제스트에서 설계 문서가 비워 둔 항목 14개(Position enum, 아키타입 카탈로그, 배경 효과, 역할 가중치, Contract/Offer, 제안 생성 규칙, Timeline, 복구 코드 형식·제한, API-PRO-003~005·AUTH 본문, `career.pathDecision`, SCR-004 API 오기, 잠금 표시 정본, 대학 경로, `relationships.family`)를 확인했다. 워커에게 결정을 남기지 않기 위해 오케스트레이터가 [phase-1-plan.md](phase-1-plan.md)에 결정을 적었다.

**결정 요지**:
- 포지션 8종·묶음 4종(D-1). 아키타입은 포지션당 3개, 룰셋 데이터로(D-2). 인사이드 포워드 가중치는 프로토타입에서 결정력 14+슈팅력 6을 `shooting` 0.20으로 합쳐 fixture 능력으로 59.30 → golden 59(D-3·D-4).
- 배경 3종은 `state/context/relationships` 초기값과 능력 보정을 통째로 정의하고, `club-academy`는 프로토타입 김서준 값과 같다(D-5). 잠재력은 아키타입 범위에서 굴리고 정찰 범위는 −(5~10)/+(3~8)(D-6).
- DRAFT → `UPDATE_PLAYER_DRAFT` → `CONFIRM_PLAYER`에서만 rng 소비(23회). 확정 후 Phase 1은 유스 시즌을 건너뛰고 `currentStep 12`·`SETTLEMENT`에서 시작한다. Phase 2가 그 앞에 시즌을 넣는다(D-7).
- 룰셋 데이터는 `packages/content/rulesets/1.0.0/ruleset.json`이고 domain은 `SimulationInput.ruleset`으로 받는다. 룰셋은 해시에 넣지 않는다(D-8).
- 이벤트 **적격 판정은 클라이언트(content `selectEligibleEvents`)**, **선택은 도메인**이 `ADVANCE{eligibleEvents}`에서 굴려 `pending`에 기록한다. `RESOLVE_EVENT`는 pending과 일치해야 한다. 재생이 콘텐츠 평가 없이 성립한다(D-10). 이를 위해 ADR-005의 engine-client·web → content 허용 범위를 "스키마·조건 평가기·팩/룰셋 로더"로 넓혔다.
- `career.pathDecision` 필드 대신 태그(`진로_입단테스트`·`진로_아카데미`·`진로_하부리그`, `입단테스트_완료`, `테스트_성공/보통/실패`). 팩 0.1.0은 제자리 수정(사용자 없음). 대학 경로는 Phase 3, `relationships.family`는 도메인에 없으므로 참조 시 검증 실패(D-11).
- 제안 생성은 룰셋 `offerRules.branches`(태그 분기)와 개수 수식(기본 1 + 태그 보너스, 최대 3, 최소 1). `ACCEPT_OFFER`만 Phase 1, `NEGOTIATE`·`REJECT_OFFER`는 Phase 3(D-9).
- 복구 코드 `OFS-XXXX-XXXX-XXXX`, 30자 알파벳 12자리, SHA-256만 저장, 원문은 발급 응답에 한 번. 실패 시도 IP+세션당 시간당 5회, 발급 프로필당 시간당 5회, rate limit은 KV 없이 D1 `auth_attempts`(D-14). 프로필 삭제 2단계 토큰 10분·즉시 삭제, 로그아웃은 로컬 유지, `DELETE /careers/{id}`(D-15).
- SCR-004의 "API-CAR-005 호출"은 오기라 screens 문서를 고쳤다. 잠금 표시 정본은 06(D-16). Google은 코드 구현 후 U-003 대기(D-17). E2E는 Playwright + axe, API 시나리오는 `wrangler dev --local`(D-18).

**작업 분해**: T-1-001~T-1-015, 4 Wave. Wave 1(domain·content·ui·api) 브리프 4건 작성. 투입은 Phase 0 종료(T-0-015 머지) 후. T-0-010은 U-002 대기로 남긴 채 넘어갈지 사용자에게 확인한다.

**미결**: 아키타입 23개와 팀 8개의 구체 수치는 워커 저작 후 오케스트레이터 리뷰. 복구 코드 30자 알파벳의 12자리 엔트로피(약 2^59)는 온라인 시도 제한과 함께 충분하다고 판단했다.

## 2026-09-02 (저녁, PR #13 커리어 동기화 API 머지)

- **PR #13(T-0-008) 머지 `5969ec6`.** 규칙 1~9 구현 확인. 서버 해시 검사는 `sha256Hex(snapshot.state)`이며 engine-client `encodeSnapshot`이 `state = canonicalize(state)`로 직렬화하므로 클라이언트 `hashState`와 일치한다(T-0-011로 런타임 간 일치도 확인). 동시 쓰기 실패 시 재조회 → 규칙 4 → 409 흐름, `pruneSnapshots(5)` 실패는 warn.
- **후속 — 실제 fixture 본문 API 테스트.** careers 테스트는 자체 canonicalize로 본문을 만든다. api는 engine-client를 import할 수 없으므로(ADR-005) `@offside/fixtures` + `@offside/domain`으로 career01 golden 본문을 만들어 `PUT`하는 통합 테스트를 T-0-010 CI 작업에 포함한다. state 래퍼와 본문 `snapshot.revision`의 교차 검증은 규칙에 없어 넣지 않았다(클라이언트 `decodeSnapshot`이 담당).
- T-0-015(동기화 클라이언트) 투입. Phase 0 남은 항목: T-0-015, T-0-010(U-002 대기).

## 2026-09-02 (저녁, Phase 순서 준수 결정)

- **사용자 결정.** 로컬 화면이 허브·자리표시자뿐이라 Phase 1 화면 작업을 병렬로 앞당길지 물었고, "정의한 Phase 순서대로 진행"으로 확정. Phase 0의 남은 항목(T-0-008 진행 중, T-0-015 대기, T-0-010은 U-002 대기)을 닫은 뒤 Phase 1 워커를 투입한다.
- **운영.** 대기 시간에는 Phase 1 브리프를 문서로만 준비한다(T-1-001~). T-0-010이 U-002(Cloudflare 계정)에 계속 막히면 그 항목만 blocked로 남기고 Phase 1로 넘어갈지 사용자에게 확인한다.

## 2026-09-02 (저녁, PR #12 platform 골격 머지)

- **PR #12(T-0-012) 머지 `675ac12`.** Dexie 구현은 `db.transaction('rw'|'r', 전체 테이블)`로 IndexedDB 원자성·직렬화를 그대로 쓰고 Dexie를 `await import`로 지연 로드(초기 청크 예산). KV 구현은 readwrite마다 prefix 전체를 백업해 throw 시 복원. 두 구현 모두 engine-client 계약 테스트와 golden 통과. 채널 분기는 `apps/web/src/platform/index.ts`의 `import.meta.env.MODE === 'toss'` 한 곳, `build:toss` 스크립트로 빌드.
- **ADR-005 해석 확정.** platform이 engine-client에서 가져올 수 있는 것은 LocalStore 포트 **타입**과 `LocalStoreConstraintError` **클래스**(계약 테스트의 `instanceof`에 필요). ADR-005 표의 문구를 "포트 타입·오류 클래스"로 고침. `createEngineClient` 등 실행기는 여전히 platform에서 import 금지(경계 스캔 테스트가 강제).
- **후속 — KV 스토어 백업 비용.** prefix 전체 백업은 커리어가 커지면 명령마다 수 MB 복사가 된다. toss 채널 착수(M-001) 때 "건드린 키만 저널링"으로 바꾼다. 지금은 스텁이라 그대로 둔다.

## 2026-09-02 (저녁, PR #11 폰트 dynamic subset 머지)

- **PR #11(T-0-013) 머지 `acbfd1d`.** `@offside/ui/fonts.css`(subset 94개 + 'Pretendard Fallback')를 앱이 `tailwind.css`보다 먼저 import. `check:bundle`에 폰트 예산 2종 추가(단일 woff2 200KB, preload 합 100KB).
- **폴백 메트릭의 한계.** `size-adjust`·`ascent-override`는 macOS/iOS의 Apple SD Gothic Neo 기준으로 계산했다(fonttools 측정, 계산식은 fonts.css 주석). Windows(Malgun Gothic)·Android(Noto Sans KR)는 `local()` 순서상 같은 override 값을 받으므로 정확하지 않다. CSS만으로는 OS별 분기가 안 되므로 Phase 1 실기기 점검(08 체크리스트)에서 CLS를 보고 필요하면 플랫폼 감지로 클래스를 바꾸는 방식으로 보정한다.
- **스크린샷 정책.** 워커는 외부 호스팅(gist·artifact) 권한이 없다. 시각 검증은 수치와 결론 문장을 PR 본문에 적고 파일은 스크래치패드에 남기는 것으로 통일(브리프 템플릿에 반영 예정).

## 2026-09-02 (저녁, PR #10 런타임 간 해시 일치 머지)

- **PR #10(T-0-011) 머지 `c45bede`.** workerd(Miniflare)에서 career01 재생·SHA-256 경계·canonicalize가 Node·golden과 모두 일치. 불일치 0건. 서버 측 무결성 검사(T-0-008 규칙 5)가 클라이언트 해시를 그대로 재검증해도 된다는 전제가 확인됨.
- **Miniflare v5.** wrangler 4.127.1이 끌어오는 miniflare 5.x는 `new Miniflare({ workers: [...] })` 형태라 브리프의 v4 옵션은 패키지가 공개하는 `convertV4MiniflareOptions`로 변환해 사용. esbuild는 wrangler 내부 0.25.x와 다른 0.28.1을 명시(테스트 번들 전용이라 무해. 추후 CI에서 esbuild 중복 설치가 문제되면 정리).
- **합류 후 검증.** main에서 api 테스트 58건 통과(2회). 다만 첫 병렬 실행에서 `cross-runtime-hash.test.ts`가 workerd 콜드스타트로 vitest 기본 5초를 넘겨 1회 실패(단독 662ms). CI 재발 방지로 해당 파일의 `beforeAll` 30초·describe 15초 타임아웃을 T-0-008 워커에게 별도 커밋으로 맡김.

## 2026-09-02 (저녁, PR #9 api HTTP 계층 머지·폰트 측정 결과)

- **PR #9(T-0-006) 머지 `483001b`.** 리뷰에서 잡은 결함 1건: idempotency 미들웨어가 같은 키의 동시 요청 2개를 모두 통과시킨 뒤 두 번째 INSERT가 UNIQUE 위반으로 throw해 라우트는 성공했는데 503이 나가는 레이스. `onConflictDoNothing` + 저장 실패 시 응답 불변(warn 로그 `IDEMPOTENCY_STORE_FAILED`) + 동시 요청 테스트로 수정. T-0-008의 "같은 PUT 100개 → 전부 200"은 이 수정과 서버 규칙 4("이미 반영됨 → 200")의 조합에 기댄다.
- **세션 규칙 확정 사항.** `GET /v1/profile`은 세션이 없을 때만 익명 프로필·세션을 발급하고, 위조·만료 쿠키도 "없음"으로 취급해 새 프로필을 준다(복구는 로그인·복구 코드의 몫). Bearer가 무효면 쿠키가 있어도 401. 그 외 보호 라우트는 401 `PROFILE_REQUIRED`. 로그에 `error.message`가 남으므로 D1 오류 문자열에 값이 섞이지 않는지 T-0-010 CI 이후 점검(후속).
- **T-0-013 측정(워커 보고, PR 전).** 전송 바이트 2109KB→269KB(87% 감소), LCP는 4G 2445→2519ms, 느린 3G 2444→2478ms로 사실상 불변, CLS 0. 원인: 기존에도 `font-display: swap`이라 폰트가 페인트를 막지 않았고 허브가 빈 상태라 JS 파싱이 LCP를 지배. 결론: 전환은 유지(전송량·향후 콘텐츠 여유), 허브 LCP 2.5초 예산은 실제 허브 화면(Phase 1)이 붙은 뒤 다시 측정. tabular-nums 검증은 숫자 UI가 없어 스크래치 HTML로 subset의 `tnum` 보존만 확인하기로 함.
- T-0-008(커리어 동기화 API) 투입.

## 2026-09-02 (저녁, PR #8 engine-client 머지·후속 과제)

- **PR #8(T-0-007) 머지 `9667dc7`.** 브리프의 테스트 목록(골든 inline·worker, 100 병렬 멱등, revision 경쟁, 쓰기 단계 충돌, 롤백, 복구 a~d, decodeSnapshot, buildSyncBody, 순수성 스캔, 계약 테스트)이 모두 구현됨. `check-deps.mjs`는 `checkDeps(pkg, deps, allowed, field)`로 분리해 `TEST_ONLY_PACKAGES`를 devDependencies에서만 허용.
- **후속 1 — 로컬 저장 크기.** idempotency 레코드가 `ExecuteSuccess` 전체(encoded Snapshot + DomainSnapshot)를 저장해 revision당 state가 최대 3벌 남는다. Phase 1에 "로컬 저장 예산·정리 정책" 작업을 두고, idempotency는 `{ revision, resultHash }`만 남기고 응답은 snapshots 테이블에서 재조립하는 방향을 검토한다(05 "저장된 최초 응답을 돌려준다"는 의미 유지).
- **후속 2 — 동기화 전 검증.** `buildSyncBody`는 최신 Snapshot을 decode 검사 없이 싣는다. T-0-015 브리프에 "전송 전 `loadCareer`로 최신 Snapshot 검증(필요 시 복구) 후 `buildSyncBody`" 규칙을 추가했다.
- **후속 3 — 오류 형태.** `buildSyncBody`·`markSynced`는 없는 careerId에 `EngineError`가 아니라 `Error`를 던진다. T-0-015에서 `CAREER_NOT_FOUND`로 감싼다(engine-client 변경 없음).
- T-0-012(platform·Dexie)와 T-0-011(런타임 간 해시) 투입. 동시 워커 4명(T-0-006·T-0-013·T-0-012·T-0-011).

## 2026-09-02 (저녁, T-0-015 동기화 클라이언트 설계)

- **큐 정책.** careerId당 대기 1개·진행 1개. web은 1.5초 debounce로 연속 명령을 한 PUT에 합치고 시즌 종료·은퇴·생성 체크포인트는 즉시, toss는 debounce 0(ADR-002 "모든 step 경계"). 재시도는 지수 백오프(2s→60s, 지터 ±20%), 재시도 가능 여부는 contracts `RETRYABLE_BY_CODE`. 같은 본문의 재시도는 같은 Idempotency-Key.
- **409 처리.** 서버 Snapshot을 GET해 로컬에 같은 revision·같은 stateHash의 Snapshot이 있으면 서버는 로컬 로그의 조상 → `markSynced(serverRevision)` 후 빨리감기 재전송(사이클당 1회). 아니면 `CONFLICT` 상태로 멈추고 화면에 넘긴다.
- **충돌 해소 범위.** Phase 0은 `'REMOTE'`(서버 채택: 서버 Snapshot 검증 후 로컬 revision 되감기, 버려지는 로컬 로그는 kv에 보관)만 구현. `'LOCAL'`(이 기기 우선)은 서버에 강제 덮어쓰기 API가 없고 명령 로그 계보가 섞이면 후일 리플레이 검증이 깨지므로 보류. 후보는 (a) 로컬 로그를 새 careerId로 포크해 엔진에서 재실행(결정론이라 결과 동일, API 변경 없음, 커리어가 둘이 됨) vs (b) `PUT`에 강제 플래그 추가(서버 로그 교체). 추천은 (a). 화면(Phase 1)과 함께 결정.
- **세션 부재.** 401은 `LOCAL_ONLY`로 두고 platform이 세션을 만든 뒤 앱이 다시 알리면 재개. 재시도 불가 4xx(VERSION_MISMATCH 등)는 `FAILED`로 표시만 하고 게임은 계속(ADR-002 "동기화 실패는 진행을 막지 않는다").

## 2026-09-02 (저녁, PR #6 머지·PR #7 리뷰·버전 라벨)

- **PR #6(T-0-005) 머지 `9b292b1`.** 수정 2건 확인: cursor 인코딩을 `btoa/atob + TextEncoder`로 바꿔 Workers 런타임 호환, purity 테스트가 `Buffer`·`process.`·`require(`·`__dirname`을 금지. `db:check`는 `git status --porcelain -- migrations`로 미추적 migration도 잡는다(임시 컬럼으로 실패→복원 확인).
- **Phase 0 버전 라벨.** `rulesetVersion`은 `"1.0.0"`(00 로드맵 "LINE TEST로 ruleset 1.0.0 확정", domain golden fixture, API 시드 `svc_kickoff`, 07 예시 모두 이 값), `contentPackVersion`은 `"0.1.0"`, `schemaVersion`은 1. 패키지 버전 상수(`DOMAIN_VERSION` 등)와 ruleset 라벨은 별개 이름공간. content 팩 manifest `compatibleRulesetVersions`를 `["0.1.0"]`→`["1.0.0"]`으로 고쳤다.
- **PR #7(T-0-004) 리뷰 결정.** (1) 루트 `content:validate`는 `turbo run content:validate`를 유지하고 패키지 스크립트 이름을 `content:validate`로 통일(캐시·파이프라인 일관). (2) content CLI는 `node ./src/cli/validate.ts`(Node 22 타입 스트리핑)로 실행하므로 `.ts` 확장자 import와 `allowImportingTsExtensions`를 content 패키지에 한해 허용. (3) 콘텐츠 후속 과제로 기록: sourceId `EVT-…​.A.A1.0`처럼 `.N` 접미(같은 선택지의 다중 효과 구분), EVT-CON-002는 4지→3지선다(스키마 max 3), 선택지 weight는 임의값(합 100 미달은 경고), 조건 필드는 문자열 타입 화이트리스트. 이들은 T-0-004 브리프의 "프로토타입과 다르게 결정한 항목"으로 04 문서 갱신 시 반영.
- **PR #7(T-0-004) 머지 `cfc868f`.** main 재병합·lockfile 재생성 후 체인·content:validate 재확인. 빈 슬롯에 T-0-013(폰트 dynamic subset, 독립 작업) 투입. T-0-011 브리프 작성(Node·workerd 해시 일치, 브라우저 Web Worker는 Playwright 도입 시). T-0-007 브리프의 "domain fixture 원본 삭제" 문구 철회(domain→fixtures devDependency는 워크스페이스 순환).

## 2026-09-02 (저녁, fixtures 테스트 전용 의존 규칙)

- **T-0-007 워커 질문.** engine-client가 golden fixture를 쓰려면 `@offside/fixtures`를 devDependency로 가져야 하는데 `check-deps.mjs` 허용 목록과 ADR-005 표에 없어 `lint:deps`가 실패한다.
- **결정.** `@offside/fixtures`는 테스트 전용 패키지로, 어느 패키지든 `devDependencies`로만 허용하고 `dependencies`면 위반. `check-deps.mjs`에 `TEST_ONLY_PACKAGES` 개념을 추가(워커 범위 확장, 테스트 2건 포함). ADR-005 본문에 한 문단 추가. 런타임 의존 표는 그대로. 이유: platform(T-0-012)·api 테스트도 같은 fixture를 쓰게 되므로 패키지별 허용 목록에 하나씩 넣는 것보다 규칙 하나가 낫다.

## 2026-09-02 (저녁, PR #4 머지·lockfile 충돌 규칙)

- **T-0-003 머지(`4693202`).** 리뷰 요청 5건(zod 4.5.4 통일, `ClientIdSchema`, `PUT /careers` snapshot revision 정합성, CORS `Content-Type`·`X-Request-Id`, 주석)을 워커가 반영했고 체인 통과(50 tests).
- **lockfile 충돌 처리.** 첫 `gh pr merge`가 `pnpm-lock.yaml` 충돌로 실패했다(T-0-009 머지가 먼저 lockfile을 바꿈). 워커 터미널을 이미 닫은 뒤라 오케스트레이터가 임시 워크트리에서 `origin/main`을 합치고 lockfile을 `pnpm install --no-frozen-lockfile`로 재생성한 뒤 체인을 재실행해 푸시·머지했다. 코드 편집은 없었다(lockfile 재생성만). 재발 방지로 README·브리프 템플릿·대기 중 브리프(T-0-006/007/012)에 "PR 직전 main 병합 + lockfile 재생성" 규칙을 넣었다. 교훈: 머지 결과를 확인하기 전에 터미널·워크트리를 정리하지 않는다.
- **디스패치.** T-0-014(domain `ADVANCE` 정렬)와 T-0-005(api D1 스키마)를 `4693202` 기준으로 동시 시작. T-0-004는 진행 중.

## 2026-09-02 (저녁, api 데이터 계층 설계)

- **T-0-005 브리프 작성.** 서버 `careers` 행은 contracts `CareerSummary` + 소유자·검증 상태·시각만 갖는 요약이다. 02 DATA-CAR-001의 진행 값(`currentDate`, `currentTeamId`, `rngState` 등)은 Snapshot `state` 안에 있으므로 서버 테이블에 중복하지 않는다.
- **D1 원자성.** 대화형 트랜잭션이 없으므로 한 요청의 쓰기는 `db.batch` 하나로 보내고, `command_log(career_id, revision)` PK와 `snapshots(career_id, revision)` UNIQUE가 동시 쓰기를 실패시킨다. T-0-008의 동기화는 "SELECT revision → 비교 → batch[조건부 UPDATE, INSERT…]" 순서다.
- **서버 idempotency는 HTTP `Idempotency-Key` 단위**(`owner_profile_id + key`), 명령 단위 멱등성은 engine-client와 `command_log` PK가 맡는다.
- **비밀값은 해시만**(세션 토큰·복구 코드·앱인토스 식별키, SHA-256 hex). **시각은 ISO UTC TEXT**, JSON 컬럼은 TEXT + Zod 검증. migration은 drizzle-kit 생성 SQL을 wrangler가 적용(`out = migrations_dir`), 손 편집 금지, additive만.
- 시드(`svc_kickoff`)는 migration이 아니라 `seeds/local.sql`로 분리한다. 원격 D1·환경 블록은 U-002 뒤 T-0-010.

## 2026-09-02 (저녁, T-0-004 매핑 답변·engine-client 설계)

- **T-0-004 워커 질문 3건 답변.** (1) EVT-REL-001의 동료 RELATION은 문서 지칭대로 박준서→`captain`, 이도현→`rival`. (2) EVT-REL-002의 '가족' RELATION 수치는 domain에 필드가 없으므로 Effect를 만들지 않고 태그(`부모의_걱정`, `대화_회피`)와 cause 문구만 옮긴다. `relationships.family` 추가 여부는 Phase 1 결정 사항. (3) '제안 수 ±1', '대학 경로 성장 보정' 같은 서사 전용 수치는 Effect에서 제외하고 태그·문구로만 남긴다. 프로토타입의 제안 수 공식은 태그(`에이전트_계약`, `주목받는_유망주`)로 계산되므로 손실이 없다. 계약 제안 시스템은 Phase 1 이후.
- **명령 이름 정렬(T-0-014).** domain의 `ADVANCE_STEP`을 07·contracts의 `ADVANCE`로 바꾼다. T-0-003 브리프는 "매핑은 engine-client가 한다"고 했으나, 명령 로그 `commandType`을 engine-client와 api 리플레이 양쪽에서 매핑하는 것보다 이름을 하나로 맞추는 편이 싸다. 상태 값이 바뀌지 않아 golden hash는 그대로다.
- **engine-client 설계(T-0-007 브리프).** ① LocalStore 구현은 ADR-002대로 platform이 맡는다(web=Dexie는 T-0-012). engine-client는 포트·메모리 구현·계약 테스트만. ADR-005의 패키지 설명 두 줄을 이에 맞게 고쳤다. ② Worker에서 도는 것은 domain `simulate`뿐이고 저장소는 메인 스레드에 남는다(toss 네이티브 Storage 브리지가 Worker에서 동작한다는 보장이 없음). 실행기는 읽기 트랜잭션 → 시뮬레이션 → 쓰기 트랜잭션(재검증) 2단계다. Dexie 트랜잭션이 외부 Promise 대기 시 자동 커밋되는 제약 때문이기도 하다. ③ 명령 payload는 domain `Command` 그대로(RESOLVE_EVENT가 outcomes를 포함)라 명령 로그만으로 리플레이가 된다. 콘텐츠 팩 → payload 변환은 Phase 1 이벤트 엔진 작업. ④ golden fixture는 `packages/fixtures`로 복사하고 드리프트 테스트로 domain 원본과 동일함을 지킨다. 원본 삭제는 T-0-011.
- **디스패치 순서.** T-0-003 머지 → T-0-014(10분 규모) → T-0-007. T-0-004는 독립적으로 병행.

## 2026-09-02 (저녁, 머지 권한)

- 사용자 지시: PR 머지 승인을 따로 요청하지 않는다. 리뷰 체크리스트를 통과하면 오케스트레이터가 바로 squash 머지하고 다음 작업을 띄운다. 범위 변경·외부 계정·비용이 큰 결정은 여전히 사용자에게 묻는다.

## 2026-09-02 (저녁, T-0-002 질문 답변)

- 능력치 키는 02 문서의 20개(`ATTRIBUTE_KEYS`)가 정본이다. 프로토타입 표는 결정력·슈팅력을 나누고 오프더볼을 쓰며 점프·골키핑이 없다. 코드로 옮길 때 매핑: 결정력→`shooting`(슈팅력은 버림), 오프더볼→`positioning`, `jumping`은 50, `goalkeeping`은 필드 플레이어 10을 기본값으로 둔다. 프로토타입 문서 표 자체는 Phase 1 ruleset 작업에서 02 이름으로 고친다.
- 프로토타입 표에 없는 관계 값(captain·rival·fans·agent)은 50에서 시작한다.
- T-0-002 fixture는 결정론·해시 고정용이며 Base OVR 59 재현은 RULE-OVR-001 구현(Phase 1) 몫이다.

## 2026-09-02 (저녁, 브리프 준비)

- T-0-002·003·004 브리프 작성. 착수 순서는 T-0-001 → T-0-002 → (T-0-003 ∥ T-0-004). contracts와 content가 domain 타입을 import하므로 domain 먼저.
- 조건 DSL 화이트리스트에 `career.stage`(`YOUTH`/`PRO`)와 `season.tags`를 등록했다. 프로토타입 트리거의 `career.phase == "U18"`은 `career.stage == "YOUTH"`로, `player.age`는 `career.age`로 바꿨다. 나이 필드는 `career.age` 하나만 쓴다.
- 콘텐츠 README의 `phases` 값을 04의 `CareerPhase`로 통일했다(시즌 phase와 혼용 금지). 실행용 팩·ruleset은 ADR-004대로 `packages/content/packs|rulesets`에 두고 `docs/content`는 저작 문서만 둔다.
- `SquadRole`(`STARTER|ROTATION|BENCH|RESERVE`, 시즌 단위)과 경기 단위 `MatchAppearance`(`START|SUB|OUT`)를 02에 정의했다. `CheckpointType` 9개를 05에 정의했다(`EVENT_RESOLVED` 추가).
- Snapshot `state`는 domain `CareerState`의 canonical JSON 문자열, `stateHash`는 그 SHA-256(순수 TS 구현, domain 안). `rngState`는 `state` 안 값의 색인용 복사본.
- 프로토타입 팩 0.1.0은 플레이테스트(U-005) 전에 기계 변환으로 만들고 manifest에 `playtested: false`를 둔다. 밸런스 조정은 U-005 뒤 별도 작업. 근거: Phase 0 골격을 계정·프로토타입 없이 진행한다는 09-02 오전 결정과 같다.

## 2026-09-02 (승인)

- **ADR-001~009 승인.** 사용자 승인으로 U-006 완료. Phase 0 착수.
- **Phase 0 게이트 완화.** 골격 작업(T-0-001~004·007·009)은 계정·프로토타입 기록 없이 진행한다. 이유: 코드 구조는 프로토타입 결과에 영향받지 않고, 배포·CI만 계정이 필요하다. 오케스트레이터 결정.

## 2026-09-02 (오후, 범위 조정)

- **미니앱 출시 시점 보류, 구조는 지금.** 사용자 지시: 웹 프로젝트를 언제든 미니앱 출시를 고려할 수 있는 구조로 작업. ADR-009의 구조 결정(어댑터, LocalStore 포트, Bearer 병행, 내부 라우트 약관)은 Phase 0~1에 적용하고, SDK 연동·빌드·세션 API·콘솔·등급분류는 보류 백로그 M-001~M-006으로 분리. U-007~U-011은 `deferred`.

## 2026-09-02 (오후)

- **앱인토스 미니앱 채널 채택(당초 동시 출시, 같은 날 범위 조정).** [ADR-009](../adr/ADR-009-apps-in-toss-channel.md). 같은 SPA를 두 채널로 빌드, 차이는 `packages/platform`에만. 근거: 사용자 지시와 개발자센터 문서.
- **앱 유형은 게임, 등급분류 직접 취득.** 비게임 등록은 재분류 위험과 내비게이션 바·라이트 모드 규칙 때문에 보류.
- **toss 채널 인증은 식별키 + Bearer 세션.** 미니앱 안 소셜 로그인 금지 정책으로 Google은 web 채널 전용. 토스 로그인은 사업자 필요·불필요로 미채택.
- **toss 채널 로컬 저장은 네이티브 Storage.** iOS WebView IndexedDB 7일 삭제와 origin 분리 때문. `LocalStore` 포트로 추상화.
- **수익화 없음 유지.** 인앱 결제·광고·프로모션을 넣지 않아 사업자 등록 없이 출시 가능.
- **약관·개인정보는 SPA 내부 라우트.** 미니앱의 외부 링크·자사 유도 금지 정책 대응.

## 2026-09-02

- **역할 분리 확정.** 사용자 = 프로덕트 오너. Claude = 기술 책임자·오케스트레이터, 앱 코드 직접 수정 금지. 구현 = Claude Code Sonnet 5 워커, Orca 워크트리로 위임. 근거: 사용자 지시.
- **로컬 우선 아키텍처로 전환.** 서버 권위 시뮬레이션 권장을 폐기하고 클라이언트 실행 + 서버 동기화·리플레이 검증으로 확정. [ADR-002](../adr/ADR-002-persistence-and-identity.md), [ADR-003](../adr/ADR-003-simulation-location.md). 근거: 사용자의 "서버는 최종 결과 정도만" 의도와 원작 구조. 단, 최종 결과만이 아니라 checkpoint Snapshot을 동기화한다. 이유는 진행 중 커리어 복구.
- **Cloudflare 단일 벤더.** [ADR-007](../adr/ADR-007-hosting-and-infra.md). 대안 Vercel·Supabase·AWS 보류 사유 기록.
- **Google 로그인 1종 + 익명 병합 규칙.** [ADR-008](../adr/ADR-008-auth-and-account-merge.md). 카카오는 Season 2 이후 재검토.
- **도메인은 사용자가 구매.** 후보 4개, 가용성 미확인. [ADR-006](../adr/ADR-006-service-name-and-domain.md).
- **시간 모델·선발 규칙·브랜드 어휘·Legacy 가중치.** 커밋 2f1e070의 문서 보강에서 오케스트레이터가 확정. 사용자 반려 가능. 상세는 각 문서.

## 열린 질문

| 질문 | 필요 시점 | 담당 |
|---|---|---|
| 도메인 최종 선택 | Phase 0 CI 배포 전 | 사용자 |
| 저장소 공개 여부(GitHub Actions 무료 분수 영향) | Phase 0 | 사용자 |
| 카카오 로그인 추가 여부 | Season 2 설계 | 사용자 |
| 리플레이 검증 ON 시점 | 경쟁 랭킹 설계 시(토스 리더보드 도입 시 필수) | 오케스트레이터 |
| 앱인토스 미니앱 출시 결정 시점 | LINE TEST 결과 본 뒤 권장 | 사용자 |
| 앱인토스 `appName`·제작자 이름 최종값 | U-007 등록 시 | 사용자 |
| GRAC 등급분류 개인 신청 가능 여부, 수수료 | Phase 1 중 | 사용자 |
| toss 채널 다크 팔레트가 검토를 통과하는지 | 첫 검토 요청 | 사용자·오케스트레이터 |
| 토스 게임센터 리더보드 도입 여부(Phase 7) | Phase 6 말 | 사용자 |
| WORLD STAGE 가상 리그명·국가별 축구 문화·24개 구단 브랜드 확정 | T-8-008 착수 전 | 사용자·콘텐츠 |
