# 운영 지표 대시보드 설계 (T-11-572)

2026-10-29. 흩어진 지표(운영 D1 · GA4 · AdMob · Meta 광고 · App Store Connect · Play · 엑솔라)를 하루 한 번 표 하나에 모으고,
운영자만 들어가는 별도 주소 `admin.offside-lab.com`에서 한 화면으로 본다. 지금 운영 도구(설정 → 운영 도구)의 대시보드 · 매출
화면은 새 대시보드가 자리를 잡은 뒤 줄인다.

## 결정 요약

| 항목      | 결정                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 방식      | **하루 한 번 수집 → `kpi_daily` 표 → 대시보드는 그 표만 읽는다.** 화면을 열 때 운영 D1에 집계 쿼리를 날리지 않는다(10-16 503 사고)                |
| 주소      | `admin.offside-lab.com` 별도 앱(`apps/admin`, Svelte 5 · Vite, Workers 정적 자산). 웹 첫 화면 번들 · 예산과 무관                                  |
| 접근      | 두 겹. ① Cloudflare Access(운영자 Google 메일 1개만 허용) ② API는 지금처럼 `requireAdmin`(ADMIN_EMAILS + 구글 연결 프로필)                        |
| 수집 시각 | 매일 04:00 KST 일일 cron(`DAILY_STAGES`에 `kpi` 단계) — 전날 KST 하루를 확정 집계. 외부 지표는 에이전트 Worker 08:50 KST cron이 받아 API에 넣는다 |
| 저장 모양 | 긴 표 `(day, metric, dim, value)`. 지표를 늘려도 마이그레이션이 필요 없다                                                                         |
| 화면      | 5묶음(사용자 · 게임 · 수익 · 그로스 · 스토어/품질), 기간 7 · 30 · 90일, 전주 대비                                                                 |

## 화면 구성 (T-11-577)

옆 메뉴 · 윗줄(기간 · 새로고침) 틀에 화면 8개: 개요 · 사용자 · 수익 · 그로스 · 게임 · 커뮤니티 · 시즌 · 대회 · 신고 · 이상 · 데이터(주소 `#/화면`).
`kpi_daily`만 읽는 원칙은 **추세 차트**에 그대로 두고, 오늘 현황 · 판단에 필요한 칸은 운영 도구가 이미 쓰던 운영자 API를 화면이
열릴 때만 읽는다(`/v1/admin/stats` 엣지 1분 · `revenue` · `leagues/current` · `cups` · `chat/reports` · `name-reports` ·
`anomalies`). 같은 주소는 1분 메모, 새로고침 버튼이 메모를 비운다. 개요는 데이터 경보(운영 DB · GA4 · Meta가 어제 행까지 없으면) ·
실시간 현황 · 기간 매출 · 광고 제거 가격 판단(T-11-574 인상 전후 하루 평균, 11-12 결정 기준) · 운영 상태만 두고 추세 차트는 각 화면에 둔다.
빠진 날은 0으로 그리지 않는다(막대는 점선, 추세선은 끊김, 기간 합은 빠진 날 수를 같이 적는다). Codex 검토(Luna · Terra) 반영.

## 접근 제어 — "운영자만"

1. **Cloudflare Access** 앱을 `admin.offside-lab.com` 전체에 건다. 정책은 Include = Emails: 운영자 Google 메일 1개, 로그인 방법은
   Google(또는 일회용 PIN). Access를 통과하지 못하면 정적 파일(HTML · JS)도 내려가지 않는다. 대시보드 UI에서 설정한다(MCP 쓰기 불가).
2. **API**: 지표 응답은 `api.offside-lab.com/v1/admin/kpi`가 준다. 세션 쿠키는 `api.offside-lab.com` 호스트 전용 · `SameSite=Lax`라
   `admin.offside-lab.com`(같은 사이트)에서 `credentials: 'include'`로 보내면 실린다. 핸들러는 `requireAdmin`으로 막는다.
   `ALLOWED_ORIGINS`(운영)에 `https://admin.offside-lab.com`을 더한다.
3. 응답은 `Cache-Control: no-store`, 엣지 캐시하지 않는다(관리자 전용). 웹 메모(`cachedGet`)는 1분.
4. `offside-admin.<계정>.workers.dev` 주소도 같은 Access 앱의 목적지로 막는다. `workers_dev: false`로 끄면 wrangler가 존 라우트 목록을 읽어서, 존 권한이 없는 CI 토큰으로는 배포가 실패한다(T-11-572 첫 배포).

ADMIN_EMAILS가 여러 개여도 Access 정책이 1명만 통과시킨다. 대시보드 API를 운영자 1명으로 더 좁힐 필요가 생기면 `KPI_OWNER_EMAIL`을 따로 둔다(지금은 안 함).

## 수집

### 1단계 — 운영 D1 (api 일일 cron `kpi` 단계)

전날 KST 하루 `[D 00:00, D+1 00:00) KST`를 인덱스 범위로만 읽는다. 단계 하나가 끝나면 `kpi_daily`에 `INSERT … ON CONFLICT DO UPDATE`.
늦게 들어온 기록(환불 등)을 반영하려고 **최근 3일을 매일 다시 쓴다**.

| metric                  | dim                          | 원천 · 정의                                                                                                      |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `signups`               | `all` · `linked`             | `profiles.created_at` 그날(삭제 제외), linked = 구글/애플 연결                                                   |
| `active`                | `web` · `app` · `all`        | `sessions.last_seen_at` 그날인 서로 다른 프로필(채널별). 다음 날 다시 오면 빠지는 근사치(수집 04:00이라 4시간분) |
| `careers_new`           | `all`                        | `careers.created_at` 그날                                                                                        |
| `careers_retired`       | `all`                        | `careers.retired_at` 그날                                                                                        |
| `iap_count` · `iap_krw` | `ios` · `android` · `xsolla` | `iap_purchases`(테스트 제외) × 정가(`IAP_PRICE_KRW`), 매출 화면과 같은 기준                                      |
| `ad_free_count`         | `ios` · `android`            | 스토어 알림(`billing_alerts`) 구매 − 환불                                                                        |
| `pass_count`            | `all`                        | `season_passes` 그날 구매                                                                                        |
| `members_active`        | `all`                        | 그날 끝 시각에 유효한 `memberships`                                                                              |
| `comments` · `chat`     | `all`                        | 게시판 댓글 · 라운지 메시지 수                                                                                   |
| `cup_entries`           | `all`                        | 컵 참가 수(접수 기간 날만)                                                                                       |

### 2단계 — 외부 (에이전트 Worker → API)

에이전트 Worker(`apps/agents`)는 GA4 · Meta 광고 · ASC · Play 자격 증명을 이미 갖고 있고 운영 D1 바인딩이 없다(ADR-015). 그래서
08:50 KST cron에서 전날 값을 받아 `POST /v1/internal/kpi`로 넣는다. 인증은 비밀값 `KPI_INGEST_TOKEN`(양쪽 Worker에 같은 값, 사용자가
`wrangler secret put`). 본문은 `{ day, rows: [{ metric, dim, value }] }`, 허용된 metric 이름만 받는다.

| 원천       | metric                                                                                | 비고                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GA4        | `dau` · `new_users` · `d1_retention` · `d7_retention` (dim `web` · `ios` · `android`) | 이미 있는 `ga4.ts` 읽기 재사용. 리텐션은 코호트 날짜 기준 값을 그 코호트 날에 넣는다 |
| AdMob      | `ad_revenue_krw` · `ad_impressions` · `ad_ecpm` (dim `platform:format`, `source`)     | **새 자격 증명 필요**: AdMob API는 서비스 계정 불가 → 운영자 OAuth 리프레시 토큰     |
| Meta 광고  | `ad_spend_krw` · `ad_clicks` · `ad_installs` (dim 세트 이름)                          | `META_ADS_ACCESS_TOKEN` 재사용(입력 전이면 건너뜀)                                   |
| Google Ads | `ad_spend_krw` (dim `google`)                                                         | 캠페인 시작 뒤                                                                       |
| ASC · Play | `store_rating` · `store_reviews_new` (dim `ios` · `android`)                          | 이미 있는 `reviews.ts` 재사용                                                        |
| 엑솔라     | 1단계 `iap_*`의 `xsolla`로 충분(웹훅이 D1에 남긴다)                                   | 정산 금액은 3단계                                                                    |

### 연결 가능한 외부 원천 전체 (2026-10-29 기준)

| 원천                    | 얻는 것                                                       | 자격 증명 상태                                                  | 단계    |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | ------- |
| GA4 (웹)                | DAU · 신규 · 리텐션 · 유입 채널 · 퍼널 이벤트                 | 있음(에이전트 `GA4_SA_*`, 뷰어)                                 | 2       |
| Firebase Analytics (앱) | 앱 DAU · 첫 실행 · 리텐션 · 앱 이벤트(GA4 속성으로 들어감)    | 앱 데이터가 같은 GA4 속성인지 확인 필요 → 다르면 SA 뷰어 추가   | 2       |
| App Store Connect       | 판매 · 구독 · 다운로드(Sales Reports), 평점 · 리뷰, 심사 상태 | 있음(사용자 지원 키 `ASC_*`). 판매 보고서는 키 역할 '재무' 필요 | 2       |
| Google Play Console     | 설치 · 제거 · 평점 · 리뷰, 수익(GCS 보고서 버킷)              | 있음(`PLAY_SA_*`). 수익 보고서는 SA에 '재무 데이터 보기' 필요   | 2       |
| Meta 광고               | 세트별 지출 · 노출 · 클릭 · 설치                              | `META_ADS_ACCESS_TOKEN` 비밀값 입력 필요(아직 비어 있음)        | 2       |
| Meta Audience Network   | 미디에이션 Meta 수익 · 입찰(지금 0)                           | 같은 Meta 토큰 + `read_audience_network_insights`               | 3       |
| AdMob                   | 광고 수익 · 노출 · eCPM(형식 · 소스 · 국가별)                 | 새로 필요: 운영자 OAuth 리프레시 토큰                           | 3       |
| Google Ads              | JP Android 앱 캠페인 지출 · 설치                              | 캠페인 시작 뒤, 개발자 토큰 신청 필요                           | 3       |
| 엑솔라                  | 웹 결제 주문(이미 D1) · 정산 · 환불                           | 운영 API 키는 켜기 PR 때 사용자가 입력                          | 1(D1)·3 |
| Cloudflare              | Workers 요청 · 오류 · D1 사용량 · 비용                        | 있음(`CF_MCP_TOKEN`)                                            | 3       |
| EAS(Expo)               | OTA 업데이트 적용 수 · 빌드 상태                              | 있음(`EXPO_TOKEN`)                                              | 3       |
| Search Console          | 웹 검색 노출 · 클릭 · 검색어                                  | 있음(에이전트 search_console 도구)                              | 3       |
| 인스타그램 · Threads    | 팔로워 · 게시물 도달 · 참여                                   | 있음(`INSTAGRAM_ACCESS_TOKEN` · `THREADS_ACCESS_TOKEN`)         | 3       |
| 유저 반응 시트          | 라운지 · 디시 · 댓글 주제 건수                                | 있음(`VOICE_SHEET_ID`)                                          | 3       |
| 고객 문의 Gmail         | 문의 건수 · 응답 시간                                         | 있음(`GMAIL_*`)                                                 | 3       |

### 3단계 — 계산 지표 (화면에서)

`ARPDAU = (iap_krw + ad_revenue_krw) / dau`, `CPI = ad_spend_krw / ad_installs`, `ROAS(7일) = 기간 매출 / 기간 지출`.
저장하지 않고 화면에서 계산한다(정의를 바꿔도 다시 수집할 필요 없음).

## 저장

```sql
CREATE TABLE kpi_daily (
  day TEXT NOT NULL,          -- KST 'YYYY-MM-DD'
  metric TEXT NOT NULL,
  dim TEXT NOT NULL DEFAULT 'all',
  value REAL NOT NULL,
  source TEXT NOT NULL,       -- 'd1' | 'ga4' | 'admob' | 'meta' | 'store'
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, metric, dim)
) WITHOUT ROWID;
```

하루 100행 안팎, 1년 4만 행. 대시보드 조회는 `WHERE day >= ?` 기본 키 범위 한 번(90일 ≈ 9천 행). 보관 기한 없음.

## 화면 (`admin.offside-lab.com`)

- 상단: 기간(7 · 30 · 90일), 마지막 수집 시각(원천별), 수집 실패 원천 경고.
- **요약 타일**: 어제 DAU · 신규 · 매출(인앱 + 광고) · 광고 지출 · ARPDAU, 각각 전주 같은 요일 대비.
- **사용자**: DAU(웹/iOS/Android 누적 막대), 신규 가입, D1 · D7 리텐션 선.
- **게임**: 새 커리어 · 은퇴, 댓글 · 채팅, 컵 참가.
- **수익**: 인앱(스토어별) · 광고(형식별) 누적 막대, 시즌 패스 · 멤버십, 광고 제거.
- **그로스**: 광고 지출 vs 설치 · CPI, 채널별 지출, ROAS.
- **스토어 · 품질**: 평점 · 새 리뷰, 클라이언트 오류 · 서버 503 비율(3단계).
- 표 보기: 모든 지표를 날짜 × 지표 표로, CSV 내려받기.

차트는 dataviz 스킬 팔레트로 직접 SVG를 그린다(라이브러리 없이, 묶음 하나 수십 KB).

## 단계

1. **이 PR**: `kpi_daily` 마이그레이션 · 일일 `kpi` 단계(1단계 D1 지표) · `GET /v1/admin/kpi` · `POST /v1/internal/kpi` · `apps/admin`
   (사용자 · 게임 · 수익 묶음) · CORS · 배포 잡. 지난 90일은 한 번 백필(피크 밖, 하루씩 나눠서).
2. 에이전트 Worker 수집기(`apps/agents/src/kpi.ts`, 같은 PR): GA4(플랫폼별 DAU · 신규 · 세션) · Meta 광고(세트별 지출 · 노출 · 클릭 · 설치). 어제 · 그제를 매일 다시 넣는다. 스토어 평점 · 리텐션은 다음.
3. AdMob(운영자 OAuth 토큰 발급 필요) · Google Ads · 품질 지표.
4. 새 대시보드에 익숙해지면 기존 운영 도구 대시보드 · 매출 화면을 줄인다.

## 사용자가 할 일

- Cloudflare 대시보드 → Zero Trust → Access → 애플리케이션 추가(`admin.offside-lab.com`, 운영자 메일 1개 허용). 배포 전에 걸어 둔다.
- `KPI_INGEST_TOKEN` 비밀값 생성 · 입력(api · agents 두 Worker), 2단계 때.
- AdMob API OAuth 동의(3단계 때).
