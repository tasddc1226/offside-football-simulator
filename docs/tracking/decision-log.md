# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

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
