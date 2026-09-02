# ADR-008. 인증과 계정 연결·병합

- 상태: 확정 (2026-09-02)
- 관련: [ADR-002](ADR-002-persistence-and-identity.md), [ADR-007](ADR-007-hosting-and-infra.md), [화면 SCR-030](../screens/05-hub-and-support.md)

## 맥락

비로그인 플레이가 기본이고, 소셜 로그인은 한 가지만 제공한다. 로그인의 목적은 다른 기기 복구와 동기화이지 플레이 조건이 아니다.

## 결정

| 항목 | 선택 |
|---|---|
| 익명 식별 | 서버 발급 `profileId`, HttpOnly 쿠키(ADR-002) |
| 소셜 로그인 | Google 1종 (OpenID Connect). 다른 제공자는 추가하지 않는다 |
| 구현 | Hono + `arctic`(OAuth 클라이언트) + 자체 세션 테이블. Auth 프레임워크 없음 |
| 세션 | 서버 세션 ID 쿠키. 익명 프로필 쿠키와 같은 쿠키를 사용하고 로그인 시 세션에 `googleSub`를 연결 |
| 저장 정보 | `googleSub`, `email`, `linkedAt`. 프로필 사진·이름은 저장하지 않는다 |
| 복구 수단 | 복구 코드(비로그인)와 Google 로그인(로그인) 둘 다 유지 |
| 로그아웃 | 세션 무효화. 로컬 IndexedDB는 지우지 않는다. "이 기기 데이터 삭제"는 별도 동작 |

## 연결·병합 규칙

| 상황 | 동작 |
|---|---|
| 익명 프로필 A에서 Google 로그인, Google 계정이 처음 | A에 Google을 연결한다. 커리어 ID 유지 |
| 익명 프로필 A에서 로그인, Google이 이미 프로필 B에 연결 | A에 진행 중 Career가 없으면 B로 전환. 있으면 사용자에게 "A의 커리어를 B로 옮기기 / B만 사용하기" 선택 |
| 옮기기 선택 | A의 Career·Archive·시즌 진행을 B로 이동. Career ID 유지. A는 빈 프로필로 남기고 30일 뒤 삭제 |
| 같은 시즌 도전 보상을 A·B가 각각 받은 경우 | 하나만 유지. unique key `serviceSeasonId + challengeId + ownerProfileId`로 서버가 판정 |
| 복구 코드로 복구 중 현재 프로필에 커리어가 있음 | 같은 선택 화면. `RECOVERY_CONFLICT` |

병합은 서버 트랜잭션 하나로 처리하고 감사 로그에 `fromProfileId`, `toProfileId`, 이동한 careerId 목록을 남긴다.

## 보안

- OAuth `state`와 PKCE 사용. 콜백은 `api.<domain>/v1/auth/google/callback` 하나만 등록.
- 세션 쿠키 `HttpOnly; Secure; SameSite=Lax`. CSRF는 SameSite와 `Origin` 검사로 막고 상태 변경은 JSON 본문만 받는다.
- 로그인 시도·복구 코드 입력에 KV 기반 rate limit.
- 이메일은 표시와 지원 문의 확인에만 쓴다. 마케팅 발송 없음.

## 개인정보

- 개인정보 처리방침과 이용약관 페이지를 랜딩에 둔다. 수집 항목: Google 식별자, 이메일, 게임 저장 데이터, 오류 로그. Phase 1 완료 조건에 포함한다.
- 삭제 요청은 SCR-030에서 즉시 처리하며 09 문서의 삭제 규칙을 따른다.
- 14세 미만 가입 제한 문구를 약관에 둔다. 연령 확인 절차는 두지 않는다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| Auth.js | Next.js 밖에서는 이점이 작고 익명 프로필 연결을 직접 짜야 함 |
| Supabase Auth 익명 사용자 + linkIdentity | 가장 편하지만 ADR-007에서 Supabase를 채택하지 않음 |
| Apple·카카오 추가 | 사용자 결정으로 1종만. 카카오는 한국 사용자에게 유리하므로 Season 2 이후 재검토 후보 |

## 결과

- 07 API 계약에 `auth` 그룹을 추가한다.
- 02 데이터 모델의 LocalProfile에 `googleSub`, `email`, `linkedAt`을 추가한다.
- SCR-030 설정 화면에 "Google로 연결" 항목을 추가한다.
