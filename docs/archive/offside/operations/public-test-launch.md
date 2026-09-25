# 공개 테스트 오픈 · 도메인 전환

2026-09-06 준비 작업. **아직 이 문서의 전환을 운영에 실행하지 않았다.**
기존 운영 이력은 [운영 배포 런북](production-release.md), 인증 설정은
[Google 로그인 런북](google-login.md)을 따른다.

> 이후 진행 상황: PR #115·#116의 게임 개선은 운영에 배포되어 시즌 1의 신규 생성 버전은
> ruleset 1.3.0 / content 0.5.0으로 전환되었다. 아래 초기 버전 설명은 당시 준비 기록이다.
> 도메인 전환과 검색 공개는 아직 실행하지 않았다. 공개 페이지·공유 에셋 및 검색 공개의
> 후속 계획은 [SEO 실행 계획](seo-rollout.md)을 기준으로 확인한다.

## 확정과 확인 대기

- 브랜드: 오프사이드 / OFFSIDE. 부제: **이번 생은 프리미어리거!**
- 공개 문의: 운영자 문의 메일.
- 사용자가 운영 배포 및 공개 테스트를 요청했다. 새 도메인 문자열과 소유 여부는 확인 대기다.
- 사용자 후속 결정: **시즌 1로 오픈한다.** 별도 테스트 시즌을 만들지 않는다. 종료일은 미정으로 유지한다.
- 기존 운영 설정은 `svc_season_1`, ACTIVE, `isTest=false`, ruleset 1.1.0 / pack 0.3.0이다.
  로컬 신규 서사는 ruleset 1.2.0 / pack 0.4.1이다. 운영 DB의 현재 값은 실제 배포 직전에 다시 확인한다.

## SEO 구현

`apps/web/scripts/seo.mjs`가 빌드 시 제목·설명·Open Graph·Twitter 메타와 검색 파일을 생성한다.
실재하는 공유 이미지가 없으므로 이미지 URL은 넣지 않았다. 이미지형 공유 카드는 후속 작업이다.

| 빌드 입력 | 용도 |
| --- | --- |
| `VITE_PUBLIC_SITE_URL` | 확정된 HTTPS origin. 경로·쿼리·인증 정보 불가 |
| `VITE_ENABLE_SEARCH_INDEXING=true` | production 모드에서만 검색 허용 |
| `VITE_API_BASE_URL` | 해당 운영 웹에서 실제로 접근할 API origin |

검색 허용을 명시했는데 사이트 URL이 유효하지 않으면 빌드를 실패시킨다. 미설정·비운영 빌드는
기본 noindex다. `vite build` 자체의 기본 모드도 production이므로 스테이징 배포에 검색 허용 플래그를
전달해서는 안 된다. 운영 workflow에 새 도메인과 입력값을 연결하는 일은 도메인 확정 뒤 수행한다.

공개 소개 루트만 sitemap에 등록한다. 개인 커리어·설정·온보딩 및 알 수 없는 SPA 경로는
HTTP `X-Robots-Tag`로 검색 제외한다. noindex는 접근 제어나 개인정보 보호 수단이 아니므로
기존 API 소유권 검사와 인증은 유지한다. 검색 등록·순위·공유 썸네일 노출은 보장하지 않는다.

원본 HTML에도 소개문과 canonical/OG 메타를 넣어 JS를 실행하지 않는 공유 봇에 대응한다.
첫 방문 소개가 noindex 온보딩으로 자동 전환되지 않도록 공개 소개와 게임 시작 동선을 분리한다.
Cloudflare `_headers`는 정적 에셋 응답에만 적용되므로 향후 Worker가 직접 HTML을 반환하면
동일 정책을 그 응답에도 구현해야 한다.

근거: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[Cloudflare Static Assets 헤더](https://developers.cloudflare.com/workers/static-assets/headers/).

## 기록과 로그인 보존

1. 도메인이 바뀌면 브라우저의 IndexedDB/localStorage는 자동 이전되지 않는다. 기존 주소를 즉시
   일괄 리디렉션하지 않는다. 이전 주소에서 서버 동기화·Google 연결 또는 복구 수단 확보 후
   새 주소에서 같은 계정의 커리어 복원을 검증한다. 복구 코드나 토큰은 로그·문서에 남기지 않는다.
2. API 세션은 현재 Secure/HttpOnly/SameSite=Lax 쿠키다. 새 웹 도메인과 기존 workers.dev API를
   그대로 조합하면 cross-site 문제가 생길 수 있다. 새 웹과 같은 등록 도메인의 API 서브도메인
   또는 검증된 same-origin 구성을 권장하며, 쿠키 보안을 낮추는 임시 변경은 하지 않는다.
3. 새 API callback, `WEB_APP_URL`, CORS allowlist, Google OAuth의 승인된 redirect URI와
   공개 홈페이지·법적 고지 URL을 함께 맞춘다. OAuth는 개인 프로젝트 `offside-football-prod`를 쓴다.
   이전 callback/origin은 필요한 이전 기간 동안 유지하고 검증 없이 삭제하지 않는다.
4. 서버에 이미 저장된 커리어는 생성 당시 버전으로 유지한다. 아직 동기화되지 않은 커리어의 첫 PUT은
   생성 시즌의 PRESEASON/ACTIVE 상태와 manifest를 검사한다(`apply-sync.ts`). 기존 시즌을 바로
   LOCKED로 바꾸거나 manifest를 덮어쓰면 이 첫 동기화를 막을 수 있으므로 별도 전환 설계가 필요하다.
5. 시즌 1을 유지하면서 새 선수에 새 버전을 적용하려면 기존 미동기화 선수의 첫 저장까지 보존하는
   호환 전환을 먼저 구현해야 한다. 현재 시즌 manifest만 즉시 변경하지 않는다. 기존 플레이의
   버전·점수는 소급 변경하지 않으며 다른 버전의 점수 집계를 섞는지 함께 점검한다.
   현재 배포 스크립트는 기존 시즌·버전 및 ACTIVE 행 충돌을 검사한다. 검증된 전환 경로 없이
   기존 스크립트를 재실행하거나 이 검사를 제거하지 않는다.

## 공개 전 최소 인수 순서

1. 도메인 확정 및 시즌 1 버전 호환 전환 준비. DNS/인증서, 웹/API 주소, OAuth redirect, 문의/정책 노출 확인.
2. 최신 코드 PR 검토와 핵심 생성·저장·버전 호환 테스트 및 빌드. 승인된 main SHA 고정.
3. D1 Time Travel bookmark, 시즌 메타데이터, 집계 건수 확인. QA seed를 운영에 실행하지 않는다.
4. 확정된 시즌 전환 및 API → 웹 배포. 현재 서비스 시즌과 신규 버전, 테스트 안내가 일치하는지 확인.
5. 새 주소에서 익명 선수 생성 → 첫 갈림길 → 계약 → 시즌 시작 → 새로고침 저장 확인.
   기존 계정 로그인/기록 복원도 확인한다. 운영 QA 표본은 이름·시각으로 구분하고 기존 기록은 삭제하지 않는다.
6. 원본 HTML 제목/canonical/OG, robots.txt, 루트 한 건 sitemap, canonical 루트 index 및
   다른 호스트·커리어 경로 noindex를 실제 HTTP 응답에서 검증한다.
7. 배포 SHA·run URL·도메인·시즌 ID·Worker 버전·인수 결과 기록 후 공개 안내.
   Search Console 소유권 확인과 sitemap 제출은 실제 도메인 연결 후 진행한다.

문제가 생기면 DNS/Worker 전환 범위를 되돌리거나 수정 배포한다. 새 버전으로 만들어진 선수를
읽을 수 없는 구 코드로 무조건 롤백하거나, 플레이 발생 뒤 DB를 과거 시점으로 무단 복원하지 않는다.

## 준비 작업 검증 기록

- 2026-09-06 로컬: 공개 소개/온보딩/허브 route 테스트 20개, 선수 생성·색상 토큰 검사를 포함한
  3개 파일 36개 테스트 통과. SEO 설정 테스트 3개 및 웹 TypeScript 검사 통과.
- ego-browser로 기존 로컬 QA 선수의 허브와 온보딩에서 부제 및 브라우저 제목을 확인했다.
  기존 로컬 선수는 그대로 유지됐으며 운영 플레이 기록은 변경하지 않았다.
- 이 기록은 도메인 연결, 운영 로그인 이전, 운영 시즌 버전 전환의 인수 완료를 뜻하지 않는다.
