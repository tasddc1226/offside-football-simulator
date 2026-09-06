# 오프사이드 공개 페이지·SEO 실행 계획

작성: 2026-09-06. 범위: 공개 소개, 플레이 가이드, FAQ, 기술 SEO, 공유 에셋 준비.
**검색 공개·도메인 구매·DNS 변경·검색 도구 등록은 이 작업의 실행 범위가 아니다.**
시즌과 기존 선수 기록, 로그인, 커리어 규칙은 변경하지 않는다.

## 출발점과 목표

점검 기준 main: `15c559aa765c093618dd53906eb7bb8489ec1394`.
운영 주소는 `https://offside-web.tasddc1569.workers.dev/`이며, 도메인 구매는 완료되지 않았다.
2026-09-06 실제 응답에서 제목·설명·기본 OG는 확인했지만 다음 사항이 남아 있었다.

- 루트 HTML과 HTTP 응답 모두 `noindex, nofollow`, robots.txt는 `Disallow: /`.
- 대표 URL과 OG 이미지 없음. 원본 HTML의 소개 문구가 짧음.
- 생성되지 않은 `/sitemap.xml`을 요청해도 SPA HTML이 HTTP 200으로 반환됨.

목표는 검색으로 게임을 발견한 사용자가 게임 방식을 이해하고 선수 생성까지 도달하는 것이다.
개인 커리어를 검색 콘텐츠로 만들거나 검색 순위·노출·엔딩 도달 시간을 보장하지 않는다.

## 단계와 완료 기준

| 단계 | 작업 | 완료 기준 |
| --- | --- | --- |
| 1 · 공개 콘텐츠 | 소개 `/`, 가이드 `/guide`, FAQ `/faq`, 실제 화면과 시작 동선 | 주요 문구·링크가 원본 HTML에 존재하고 모바일에서 읽을 수 있음 |
| 2 · 기술 SEO | 경로별 메타·canonical, robots, XML sitemap, 공개/게임/404 응답 분리 | 공개 설정과 실제 응답이 일치하고 게임 deep link가 유지됨 |
| 3 · 공유 | 브랜드 대표 이미지, favicon, OG·Twitter 메타 | 이미지 실재·크기·MIME 확인, 설정된 origin을 사용하며 가짜 도메인을 넣지 않음 |
| 4 · 검색 공개 | 도메인·인증·기록 복원 검증 후 공개 플래그, Google·네이버 등록 | 실제 대표 도메인의 공개 페이지만 색인 허용, 소유권 확인·사이트맵 제출 |
| 5 · 운영 개선 | 검색 노출·클릭·선수 생성 전환 및 모바일 성능 관찰 | 초기 기준선 확보 후 실제 데이터로 개선 우선순위 결정 |

단계 1~3은 도메인 없이 준비할 수 있다. 기본 검색 제외를 유지한 상태로 검증한다.
단계 4는 도메인 소유권·DNS·TLS·API 쿠키·OAuth·기록 이전 검증 뒤 별도로 실행한다.

## 콘텐츠 원칙

- 브랜드: **오프사이드 / OFFSIDE**, 부제: **이번 생은 프리미어리거!**
- 목표 검색어 후보: 오프사이드, 이번 생은 프리미어리거, 축구 선수 키우기, 축구 인생 게임,
  축구 시뮬레이션 웹게임. 검색량을 조사한 결과는 아니며 성과 데이터로 재평가한다.
- 소개: 19세 신규 커리어, 출발 배경·정체성·선호 포지션, 선택·성장·계약·은퇴의 반복 플레이.
- 가이드: OVR 외 체력·폼·관계·전술의 의미, 시즌 진행과 서비스 시즌의 차이, 계약은 출전 보장이 아님.
- FAQ: 익명 시작과 Google 연결, 브라우저 저장과 서버 동기화, 복구 수단, 버전별 규칙 유지.
- 현재 구현을 넘는 리그 라이선스·공식 제휴·성공 확률·평균 소요 시간은 주장하지 않는다.
- 문의는 `tasddc1569@gmail.com`. 복구 코드·토큰·개인 선수 기록을 공개 페이지에 넣지 않는다.

`apps/web/public/gameplay-career.png`는 2026-09-06 운영의 QA 전용 선수 화면을 직접 캡처한 것이다.
780×1688 PNG, CSS viewport 390×844. 실제 게임 화면임을 확인했으며 복구 코드·계정 이메일·토큰은 없다.
테스트 선수 예시임을 표시하고, 해당 커리어로 직접 연결하지 않는다. 게임 화면이 바뀌면 교체한다.

## 검색·응답 정책

- 검색 허용은 유효한 HTTPS `VITE_PUBLIC_SITE_URL`과 production 모드 및
  `VITE_ENABLE_SEARCH_INDEXING=true`를 모두 갖춘 경우에만 가능해야 한다.
- production 빌드가 스테이징에도 사용될 수 있으므로 빌드 모드만으로 공개하지 않는다.
- canonical과 사이트맵은 공개 3개 페이지를 대상으로 한다. 게임·설정·온보딩을 루트의 복제 페이지로
  canonical 처리하지 않고, 검색 제외 및 사이트맵 제외로 구분한다.
- 원본 HTML meta와 `X-Robots-Tag`가 상충하지 않게 한다. 클라이언트 JS로만 noindex를 제거하지 않는다.
- 게임 deep link는 계속 HTML 앱 셸을 반환하되, 잘못된 일반 경로·없는 파일은 404로 구별한다.
- noindex는 인증·접근 통제가 아니다. 기존 API 소유권 검증은 그대로 둔다.
- 미리보기·스테이징·대체 호스트에 대표 도메인과 같은 index 허용을 자동 확장하지 않는다.

## 도메인 연결 후 실행할 일

1. 대표 호스트 하나와 웹/API 구성을 확정하고 TLS를 확인한다.
2. 기존 호스트의 미동기화 기록 저장과 Google 연결/복구 수단을 안내한다.
   IndexedDB와 localStorage는 도메인이 바뀌면 자동 이전되지 않으므로 전체 강제 리디렉션부터 하지 않는다.
3. 새 도메인에서 인증, 서버 저장, 기존 기록 복원을 검증한다. CORS와 OAuth callback도 함께 확인한다.
4. 실제 도메인을 빌드 설정에 넣고 검증된 main을 배포한다. 공개 페이지만 색인을 허용한다.
5. 원본 HTML, canonical, OG 절대 URL, robots, sitemap, 404 및 개인 경로 noindex를 확인한다.
6. Google Search Console·네이버 서치어드바이저 소유권 확인과 사이트맵 제출을 수행한다.
7. 공유 플랫폼에서 미리보기를 확인한다. 이미지/메타 준비만으로 플랫폼의 캐시 갱신·노출을 보장하지 않는다.

## 최소 검증과 운영 지표

CI를 무겁게 늘리지 않는다. 변경된 메타·사이트맵·응답 분기 테스트와 기존 시작/허브 회귀 검증,
타입 검사·빌드를 우선한다. 배포 뒤에는 주요 URL의 실제 HTTP 응답과 모바일 동선을 확인한다.

- 공개 페이지: JavaScript 없이 내용·내부 링크·시작 링크가 존재, 모바일 가로 넘침 없음.
- 색인 설정: 기본 OFF, opt-in 공개 3개 URL, 다른 호스트/개인 경로 제외.
- 게임: 기존 허브, 온보딩, 저장된 선수 deep link, 정적 JS/CSS 제공 유지.
- 공유: 이미지 디코딩 가능·실제 파일 경로·비율·접근 가능성 확인.

초기 검색 노출·클릭·검색어는 검색 도구에서 확인한다. 다음으로 방문 → 게임 시작 → 선수 생성 완료의
집계 전환을 연결하되, 이벤트 이름·동의 정책·기존 수집 구현을 먼저 점검하고 사용자 식별자를 URL에 넣지 않는다.
Core Web Vitals 목표는 실사용 방문 75백분위 LCP ≤2.5초, INP ≤200ms, CLS ≤0.1이다.
현재 달성 수치가 아니며, 초기 트래픽에서는 공개 실사용 데이터가 부족할 수 있다.
Lighthouse 한 번의 점수를 검색 순위나 실사용 품질의 보증으로 다루지 않는다.

## 근거

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Cloudflare static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
- [네이버 robots.txt](https://searchadvisor.naver.com/guide/seo-basic-robots)
- [Core Web Vitals](https://web.dev/articles/vitals)

## 검증 기록

2026-09-06 로컬 검증:

- 기존 시작·허브와 Worker 응답 정책 24개 테스트 통과, SEO 설정/사이트맵 3개 테스트 통과.
- 웹 lint·typecheck 통과. 기본 production 빌드와 가상 HTTPS origin을 지정한 별도 opt-in 빌드 통과.
- 기본 빌드의 공개 3개 페이지는 HTTP 200/noindex이며 각 원본 HTML에 H1·내용·시작 링크가 존재.
- opt-in 빌드의 원본 HTML: 페이지별 robots 메타 1개, 올바른 canonical 및 시작 링크 확인.
  사이트맵은 루트·`/guide/`·`/faq/` 3개 URL만 포함. 게임 셸은 noindex이며 canonical 없음.
- 실제 로컬 Wrangler에서 `/onboarding`과 `/career/qa-unknown/create`가 주소를 바꾸지 않고
  200/noindex 앱 셸을 반환함을 확인. 후자는 존재하는 선수의 플레이 검증이 아니라 라우팅 검증이다.
- 최초 검증에서 내부 `/app-shell.html`로 잘못 리디렉션하던 문제를 발견해 내부 에셋 조회 경로를 수정했고 재검증했다.
- 사이트맵 비활성 상태와 알 수 없는 일반 경로는 HTTP 404/noindex 확인.
- 브라우저에서 가이드 → 온보딩 이동 후 제목·설명이 게임용으로 전환됨을 확인.
- 모바일 폭 390px의 가이드·FAQ 화면을 확인했으며 가이드에 가로 넘침이 없었다.
- OG PNG 1200×630 및 favicon PNG 64×64, 이미지 디코딩·실제 제공 확인.
  신규 대표 이미지는 기존 FootballMark의 축구공 도형을 재사용한다.
- 초기 index/vendor 청크 gzip 합 101.38KB로 기존 300KB 검사 통과.
  전체 페이지의 Core Web Vitals 실사용 측정이나 모든 청크의 전송량을 뜻하지 않는다.
- `wrangler deploy --dry-run --env production` 통과. 원격 배포는 실행하지 않았다.

검색 공개·도메인 연결·실제 검색 노출·카카오톡/Threads 미리보기는 별도 인수 대상이다.
현재 공유 이미지 URL은 대표 origin 미설정 시 상대 경로이며, 도메인 설정 뒤 절대 URL과 실제 공유 표시를 확인한다.

### 구현과 유지보수 참고

정적 소개는 `apps/web/index.html`, 가이드/FAQ의 원본 HTML과 메타·에셋 생성은
`apps/web/scripts/seo.mjs`, React 화면은 `apps/web/src/shared/public-content.tsx`에 있다.
현재 문구는 정적/React 양쪽에 작성되어 있으므로 문구 변경 시 두 경로를 함께 확인한다.
후속 개선으로 콘텐츠 모델 통합을 고려하되 이 작업에서 전체 SSR 전환을 하지 않는다.

`apps/web/src/worker.ts`는 ASSETS binding을 통해 파일을 제공하고 게임 경로의 앱 셸과
404/검색 정책을 분리한다. 모든 요청이 이 Worker를 거치므로 향후 트래픽이 커지면 요청량·비용을 관찰한다.
기존 assets-only 배포와 달리 Worker가 직접 반환하는 응답의 검색 헤더도 이 코드에서 책임진다.
공개 canonical의 최종 경로는 Cloudflare 디렉터리 에셋 동작에 맞춘 `/guide/`, `/faq/`다.
