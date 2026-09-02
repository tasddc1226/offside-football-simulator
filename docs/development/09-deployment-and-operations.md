# 09. 배포·운영

## 환경

인프라는 [ADR-007](../adr/ADR-007-hosting-and-infra.md)의 Cloudflare 구성이다.

| 환경 | 목적 | 웹 | API | 데이터 |
|---|---|---|---|---|
| local | 개발과 fixture | `vite dev` | `wrangler dev` | 로컬 D1, 합성 데이터 |
| preview | PR 화면·계약 검증 | Pages PR preview | Workers preview | PR별 preview D1 |
| staging | 마이그레이션·E2E·시즌 전환 리허설 | `staging.<domain>` | `staging-api.<domain>` | staging D1, 합성 데이터 |
| production | 실제 플레이 | `<domain>` | `api.<domain>` | production D1, 정본 |

운영 데이터를 개발 환경으로 복사하지 않는다.

## CI/CD 게이트

1. lint, typecheck, unit/property test.
2. 콘텐츠 schema와 참조 무결성 검사.
3. API contract와 migration test.
4. Phase P0 E2E와 접근성 smoke test.
5. preview 배포 및 수동 핵심 화면 확인.
6. staging migration, canary, production 점진 배포.

## 배포 단위

- 웹 앱(Pages)과 API(Workers)는 따로 배포하되 같은 태그를 쓴다.
- D1 migration(`wrangler d1 migrations apply`).
- immutable ruleset artifact와 content pack 번들(Pages 정적 자산 + R2 보관).
- service season manifest.
- 백업: 매일 Cron으로 D1 export를 R2에 저장, D1 Time Travel 30일.

각 단위의 checksum과 호환 버전을 release manifest에 기록한다.

## 앱인토스 채널 배포

정본은 [ADR-009](../adr/ADR-009-apps-in-toss-channel.md)다.

1. 태그 `v*`에서 `pnpm build:toss`로 `.ait` 번들을 만들고 `ait deploy --api-key`로 콘솔에 올린다. 업로드마다 `deploymentId`와 QR 테스트 스킴(`intoss-private://…?_deploymentId=`)이 생긴다.
2. QR 실기기 테스트 체크리스트(08 문서)를 통과하면 콘솔에서 '검토 요청하기'. 검토는 영업일 최대 3일, 카테고리에 따라 7일 이상. 한 번에 한 버전만 검토 가능.
3. 승인 메일 후 '출시하기'. 즉시 전체 사용자에게 반영된다. 롤백도 콘솔에서 즉시.
4. 출시 후 `ait sentry upload-sourcemap --deployment-id`로 소스맵을 올린다.
5. API는 검토 대기 중인 번들과 라이브 번들 두 버전을 동시에 지원해야 한다. 응답 스키마는 추가만 하고 삭제·의미 변경은 다음 두 릴리스 뒤에 한다.
6. 콘솔 MCP(`apps-in-toss-console`)로 상태 조회·번들 업로드·검토 신청을 할 수 있다. 롤백·출시·예산 충전은 사용자가 직접 확인한 뒤 실행한다.

## 관측성

### 기술 지표

- API latency/error by route and error code.
- DB transaction conflict와 command duplicate 비율.
- 시즌 결산 시간, state hash mismatch.
- Snapshot 크기와 migration 실패.
- Web Vitals와 JS 오류.

### 제품 지표

- 생성 시작→첫 계약→첫 시즌→은퇴 전환율.
- 단계별 이탈과 오류 복구 성공률.
- 포지션·아키타입·선택지 분포.
- 이벤트 결과, 엔딩, 도전 과제 완료율.
- 규칙 버전별 평균 커리어 길이와 OVR 분포.

## 경보

| 심각도 | 예 | 대응 |
|---|---|---|
| SEV-1 | 저장 손상, 다른 사용자 Career 노출 | 쓰기 중단, 즉시 대응 |
| SEV-2 | 결산 실패 급증, 시즌 전환 실패 | 기능 플래그 차단, 1시간 내 |
| SEV-3 | 특정 이벤트/화면 오류 | 콘텐츠/기능 우회 |
| SEV-4 | 문구·경미한 시각 문제 | 정기 수정 |

## 기능 플래그

- 새 기능 플래그와 ruleset 버전을 혼동하지 않는다.
- 플래그 OFF가 기존 Career 상태를 해석하지 못하게 해서는 안 된다.
- 상태를 생성하는 플래그는 롤백 경로와 데이터 판독 코드를 먼저 배포한다.

## 시즌 전환 런북

1. 새 ruleset/content pack 검증과 checksum 고정.
2. PRESEASON 테스트 Career 격리.
3. 전환 공지와 신규 Career 영향 확인.
4. 현재 시즌 ACTIVE→LOCKED 전환.
5. 결산 Snapshot 생성·중복 검증.
6. 새 시즌 ACTIVE 포인터 원자 교체.
7. 이전 시즌 ARCHIVED와 보관함 열람 확인.
8. 신규·기존 Career smoke test.

콘텐츠 전환만으로 서버를 의무 중단하지 않는다. 스키마 마이그레이션이 필요한 경우에만 유지보수 창을 사용한다.

## 백업과 복구

- DB point-in-time recovery와 일일 복구 리허설 기준을 정한다.
- ruleset/content pack은 원격 아티팩트와 Git 태그로 이중 보존한다.
- 분기별로 Career Snapshot 복구, 시즌 전환 롤백, 익명 프로필 병합을 연습한다.

## 개인정보와 보존

- 분석 ID와 플레이 프로필 키를 분리한다.
- 로그의 상세 보존 기간을 제한한다.
- 사용자 삭제 요청은 Career/Player/Contract/Archive 연결 데이터를 추적 가능하게 삭제한다.
- 집계 지표는 재식별 가능한 소표본을 노출하지 않는다.

