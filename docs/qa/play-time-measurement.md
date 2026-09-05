# 실사용자 플레이 시간 측정 프로토콜 (Phase 3·4 완료 조건 게이트, D-62·T-4-024)

Phase 3·4 완료 조건 "FAST 한 시즌 4~6분·CHAPTER 8~12분"은 자동화 재생 시간(`apps/web/e2e/session-length.spec.ts`)으로 대체하지 않는다(D-62). 실사용자 세션의 분석 이벤트로만 판정한다. 이 문서는 무엇을·어디서·어떻게 재는지와 판정 기준을 고정한다.

## 1. 신호

| 이벤트 | 필드 | 뜻 | 출처 |
|---|---|---|---|
| `season_settled` | `simulationMode` (`FAST`/`CHAPTER`), `elapsedSecBucket`, **`elapsedSec`**(T-4-024, 정수 초, 상한 7200) | 시즌 시작(`seasonStartedAt`, SEASON_STARTED 성공 시각)부터 결산까지 | `apps/web/src/engine/funnel.ts` `recordSeasonSettled` |
| `step_passed` | `seasonIndex`, `step`, `simulationMode`, **`elapsedSec`**(T-4-024, 시즌 시작 기준, baseline 없으면 생략) | step별 도달 시각 → step 사이 간격·이탈 지점 | `trackStepPassed` |
| `funnel_reached` | `stage`, `careerIndex`, `elapsedSecBucket` | 온보딩 시작 기준 첫 계약·첫 시즌 결산까지 | `recordFunnelReached` |
| `career_abandoned_hint` | `seasonIndex`, `step`, `seasonPhase` | 커리어를 떠난 지점 | `trackCareerAbandonedHint` |

`elapsedSec`은 **벽시계 경과**다. 탭을 열어 둔 채 자리를 비운 시간이 포함되므로 §4의 절단 규칙으로 걸러야 한다. `elapsedSecBucket`은 T-4-024 이전 데이터와의 연속성용으로 유지한다.

저장: `POST /v1/analytics/events`(API-ANA-001) → D1 `analytics_events`(`id, client_id, profile_id, name, props_json, client_ts, received_at`). props는 `json_extract(props_json, '$.키')`.

## 2. 대상·기간

- 대상: LINE TEST 테스터(U-015, 9/8 시작 예정)의 **첫 커리어 첫 시즌**과 두 번째 시즌. 오케스트레이터·워커의 로컬 DEV·e2e 세션은 staging D1에 닿지 않으므로 섞이지 않는다. 스테이징 리허설(`e2e:staging`, T-2-016)이 남긴 행은 `client_id`가 리허설 고정값이므로 §4에서 제외한다.
- 표본: 모드별 시즌 완주 10건 이상이 모이면 1차 판정, 30건 이상이면 확정.

## 3. 쿼리(D1, `wrangler d1 execute offside-staging --remote --env staging --command "<SQL>"`)

```sql
-- 3-1 모드별 시즌 완주 시간 분포(초): 중앙값 근사는 정렬 후 수동, D1에는 percentile 함수가 없다
SELECT json_extract(props_json,'$.simulationMode') AS mode,
       json_extract(props_json,'$.seasonIndex') AS season,
       json_extract(props_json,'$.elapsedSec') AS sec,
       client_id
FROM analytics_events
WHERE name='season_settled' AND json_extract(props_json,'$.elapsedSec') IS NOT NULL
ORDER BY mode, sec;

-- 3-2 모드별 요약: 건수·평균·최소·최대(절단 규칙 §4 적용 뒤)
SELECT json_extract(props_json,'$.simulationMode') AS mode, COUNT(*) AS n,
       ROUND(AVG(json_extract(props_json,'$.elapsedSec'))) AS avg_sec,
       MIN(json_extract(props_json,'$.elapsedSec')) AS min_sec,
       MAX(json_extract(props_json,'$.elapsedSec')) AS max_sec
FROM analytics_events
WHERE name='season_settled'
  AND json_extract(props_json,'$.elapsedSec') BETWEEN 60 AND 3600
GROUP BY mode;

-- 3-3 step 사이 간격(같은 기기·같은 시즌의 연속 step_passed 차이) — 어느 step이 오래 걸리는지
SELECT a.client_id, json_extract(a.props_json,'$.seasonIndex') AS season,
       json_extract(a.props_json,'$.step') AS step,
       json_extract(a.props_json,'$.elapsedSec') - COALESCE((
         SELECT MAX(json_extract(b.props_json,'$.elapsedSec')) FROM analytics_events b
         WHERE b.name='step_passed' AND b.client_id=a.client_id
           AND json_extract(b.props_json,'$.seasonIndex')=json_extract(a.props_json,'$.seasonIndex')
           AND json_extract(b.props_json,'$.step')<json_extract(a.props_json,'$.step')), 0) AS gap_sec
FROM analytics_events a
WHERE a.name='step_passed' AND json_extract(a.props_json,'$.elapsedSec') IS NOT NULL
ORDER BY a.client_id, season, step;

-- 3-4 이탈 지점: 시즌을 시작했지만 결산이 없는 기기의 마지막 step
SELECT client_id, MAX(json_extract(props_json,'$.step')) AS last_step
FROM analytics_events
WHERE name='step_passed' AND client_id NOT IN (SELECT client_id FROM analytics_events WHERE name='season_settled')
GROUP BY client_id;

-- 3-5 T-4-024 이전 데이터(버킷만 있는 행)와의 연속성
SELECT json_extract(props_json,'$.simulationMode') AS mode, json_extract(props_json,'$.elapsedSecBucket') AS bucket, COUNT(*) AS n
FROM analytics_events WHERE name='season_settled' GROUP BY mode, bucket;
```

## 4. 절단·제외 규칙

- `elapsedSec < 60`: 결산까지 1분 미만은 자동화·재생·복구 커리어로 본다 → 제외.
- `elapsedSec > 3600`: 탭을 열어 둔 채 이탈한 세션으로 본다 → 제외. 3-3의 step 간격이 900초를 넘는 시즌도 같은 이유로 제외한다.
- 리허설 `client_id`(staging 리허설 스펙의 고정값)와 `profile_id`가 개발자 계정인 행 제외.
- 같은 기기의 같은 `seasonIndex` 중복 결산은 첫 행만 센다.

## 5. 판정

| 모드 | 목표 | 판정 |
|---|---|---|
| FAST | 4~6분(240~360초) | 절단 뒤 중앙값이 범위 안이면 통과. 범위 밖이면 3-3으로 병목 step을 찾아 결정 로그에 남기고 사용자 결정(밸런스·UI). |
| CHAPTER | 8~12분(480~720초) | 같음. |

첫 계약까지 5분 이하(`funnel_reached` `CONTRACT_SIGNED` 버킷 `<360` 이하)는 [line-test-plan §5-3](../tracking/line-test-plan.md)를 그대로 쓴다.

## 6. 절차

1. T-4-024 머지 → main CI → staging 배포 확인(`gh run list --branch main`).
2. LINE TEST 시작 뒤 3일차·7일차에 §3 쿼리를 돌리고 결과를 `docs/tracking/line-test-results.md`(없으면 생성)에 붙인다.
3. §5 판정을 결정 로그에 기록한다. 통과면 Phase 3·4 완료 조건의 "실사용자 플레이 시간" 항목을 닫고, 아니면 U-액션(밸런스 결정)을 연다.
