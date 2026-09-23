# ADR-007. 호스팅·인프라·CI·비용

- 상태: Amended by ADR-013 (2026-09-24, D1에 게임 데이터 없음 — 마이그레이션 0015). 확정 (2026-09-02, Workers Static Assets 전환 2026-09-04)
- 관련: [ADR-002](ADR-002-persistence-and-identity.md), [ADR-005](ADR-005-monorepo-boundaries.md), [배포·운영](../archive/offside/development/09-deployment-and-operations.md)

## 결정

모든 인프라를 **Cloudflare** 한 계정에 둔다.

| 역할 | 서비스 | 비고 |
|---|---|---|
| 웹 앱·정적 콘텐츠 팩 | Cloudflare Workers Static Assets | API Worker와 분리. SPA fallback, PR별 preview Worker |
| API | Cloudflare Workers + Hono | 라우트 `api.<domain>/v1/*` |
| DB | Cloudflare D1 (SQLite) + Drizzle ORM | 리전은 APAC(서울 근접) 우선 |
| 객체 저장 | Cloudflare R2 | 과거 콘텐츠 팩, 명령 로그 아카이브, D1 백업 export |
| 캐시·세션 보조 | Cloudflare KV | rate limit 카운터, 세션 블랙리스트. 세션 자체는 D1 |
| DNS·TLS·CDN | Cloudflare | Universal SSL |
| 오류 추적 | Sentry (무료 tier) | 브라우저 + Workers. 선수명·쿠키·복구 코드 스크러빙 |
| 제품 지표 | Cloudflare Web Analytics + 자체 이벤트 테이블(D1) | 쿠키 없는 분석. 06 문서의 5개 이벤트만 |
| 로그 | Workers Logs | 구조화 JSON, requestId |
| 배치 | Cloudflare Cron Triggers | 시즌 전환, D1 → R2 백업, 밸런스 리포트 |
| 관리자 | Cloudflare Access로 `admin.` 보호 | Phase 7. 초기에는 wrangler CLI로 운영 |
| 앱인토스 서버 API 호출 | Workers `mtls_certificates` 바인딩 | 앱인토스가 발급한 클라이언트 인증서를 `wrangler mtls-certificate upload`로 등록. 식별키 검증 등 `apps-in-toss-api.toss.im` 호출에만 사용 |
| 앱인토스 미니앱 배포 | 앱인토스 콘솔(번들 호스팅은 토스) | `.ait` 번들 업로드 → QR 테스트 → 검토 → 출시. 자체 호스팅 아님. [ADR-009](ADR-009-apps-in-toss-channel.md) |

## 환경

| 환경 | 웹 | API | DB | 용도 |
|---|---|---|---|---|
| local | `vite dev` | `wrangler dev` | D1 로컬(Miniflare) | 개발, fixture |
| preview | `offside-web-pr-<N>.tasddc1569.workers.dev` | `offside-api-pr-<N>.tasddc1569.workers.dev` | 공유 preview D1(배포 직렬화, 합성 데이터) | PR 검증 |
| staging | `staging.<domain>` | `staging-api.<domain>` | staging D1 | migration·E2E·시즌 전환 리허설 |
| production | `<domain>` | `api.<domain>` | production D1 | 정본 |

운영 데이터는 개발 환경으로 복사하지 않는다. staging은 합성 데이터만 쓴다.

앱인토스 채널의 웹 번들은 토스가 호스팅하므로 origin이 우리 도메인이 아니다. API와 콘텐츠 정적 자산은 아래 origin을 CORS로 허용한다(`<appName>`은 콘솔 등록값).

| 앱인토스 환경 | Origin | 연결되는 API |
|---|---|---|
| QR 테스트 | `https://<appName>.private-web.tossmini.com`, `https://<appName>.private-apps.tossmini.com` | `staging-api.<domain>` |
| 라이브 | `https://<appName>.web.tossmini.com`, `https://<appName>.apps.tossmini.com` | `api.<domain>` |

웹 Static Assets Worker의 `/content/*`는 앱인토스 채널을 활성화할 때 Worker handler로 같은 CORS 목록을 적용한다. 라이브 환경은 HTTPS만 허용되며 iframe은 금지다.

## CI/CD (GitHub Actions)

1. PR: lint, typecheck, unit·property, `content:validate`, contract test, migration dry-run, Playwright P0 smoke, axe.
2. PR: API와 웹을 `offside-api-pr-<N>`, `offside-web-pr-<N>` Worker로 배포한다. 공유 preview D1 migration은 concurrency group으로 직렬화한다.
3. main 머지: staging 배포, `wrangler d1 migrations apply`, E2E 전체.
4. 태그 `v*`: production 배포. 콘텐츠 팩·ruleset checksum이 release manifest와 일치해야 진행.
5. 롤백: 웹·API Worker는 이전 버전을 재배포하고, D1은 roll-forward를 우선한다(09 문서).
6. (미니앱 출시 결정 후) 태그 `v*`: `pnpm build:toss` 후 `ait deploy --api-key`로 앱인토스 콘솔에 번들 업로드(QR 테스트 상태). 검토 요청과 출시 버튼은 사람이 누른다. 앱인토스 번들과 API는 같은 태그를 쓰고, API는 이전 번들 버전과 호환을 유지한다(출시 검토가 최대 3~7 영업일이라 두 버전이 동시에 살아 있다).

GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_AUTH_TOKEN`, `AIT_API_KEY`(앱인토스 콘솔 키). mTLS 인증서는 GitHub가 아니라 Cloudflare에 업로드하고 certificate_id만 wrangler 설정에 둔다.

## 백업·복구

- D1 Time Travel(유료 30일)로 시점 복구.
- 매일 Cron으로 D1 export를 R2에 저장, 90일 보관.
- 콘텐츠 팩·ruleset은 Git 태그와 R2에 이중 보존.
- 분기 복구 리허설은 09 문서를 따른다.

## 비용 (2026-09 기준 추정, 사용자 확인 필요)

| 항목 | 월 비용 | 메모 |
|---|---:|---|
| Workers Free 플랜 | 0 | 개발·PR preview·내부 staging. LINE TEST 전까지 |
| Workers Paid 플랜 | 5달러 | D1·KV·R2 한도 확장, Time Travel. LINE TEST 직전 전환 |
| D1·R2·KV 사용량 | 0~2달러 | 초기 사용량은 포함 한도 안 |
| 도메인 | 연 10~40달러 | TLD에 따라 다름 |
| Sentry | 0 | 무료 tier, 초과 시 이벤트 샘플링 |
| GitHub Actions | 0 | 공개 저장소면 무료, 비공개면 월 2,000분 |
| 앱인토스 | 0 | 등록·호스팅·검토 무료. 인앱 결제·광고 수익이 생길 때만 수수료. 게임 등급분류 수수료는 별도(1회, GRAC 요율표) |

목표 고정비는 도메인을 제외하고 월 5달러 안팎이다. 사용자 1만 명 규모에서도 한도 조정 없이 유지될 것으로 본다. 넘으면 먼저 Snapshot 압축과 명령 로그 R2 이관을 한다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| Vercel + Neon + Auth.js | 익숙한 조합이지만 Vercel Hobby는 상용 불가, Pro 20달러. Neon 서울 리전 없음 |
| Supabase + 정적 호스팅 | 익명·소셜 연결이 내장돼 편하지만 무료 tier는 7일 미사용 시 일시정지, Pro 25달러 |
| AWS (Lambda·RDS·S3) | 운영 부담과 최소 비용이 1인 프로젝트에 과함 |
| Firebase | Firestore 모델이 관계형 Snapshot·명령 로그와 맞지 않음 |

## 결과

- 09 배포·운영 문서의 환경 표를 이 ADR에 맞춰 갱신한다.
- Phase 0 완료 조건에 "preview·staging 배포 파이프라인 동작"이 포함된다.
- Cloudflare 계정·GitHub Secrets·Sentry 프로젝트 생성은 사용자 액션이다. 추적 보드에 등록한다.
