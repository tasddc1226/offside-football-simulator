# LINE TEST 운영 계획·기준선 기록 양식 (T-2-013)

정본: [로드맵 "LINE TEST 공개 게이트"](../development/00-development-roadmap.md), [시간 모델 "세션 길이 목표"·RULE-TIME-004](../development/11-time-model-and-pacing.md), [phase-2-plan D-31·D-54·D-55](phase-2-plan.md), [T-2-012 브리프](briefs/T-2-012.md)(PR #49, main `c90b769`). 이 문서는 운영 절차와 기록 양식만 정하며 명세를 바꾸지 않는다. 기준선 자체가 산출물이고 Phase 3 이후 개선 목표가 된다(로드맵).

## 1. 무엇을 하는가

외부 사용자가 staging 웹에서 한 시즌(가능하면 두 시즌)을 플레이한다. 커리어는 서비스 시즌 `svc_line_test`(PRESEASON, `is_test`)에 묶여 테스트 보관함으로 남고 정식 시즌 도전에 집계되지 않는다(D-31·D-54). 측정은 D-55 분석 이벤트로만 한다 — 선수 이름·성별·자유 입력·서사 전문은 스키마에 키가 없다.

| 항목 | 값 |
|---|---|
| 웹 | https://offside-web-staging.tasddc1569.workers.dev |
| API | https://offside-api-staging.tasddc1569.workers.dev (`GET /v1/service-seasons/current` → `svc_line_test`, `isTest: true`, `notice: LINE_TEST`) |
| 서비스 시즌 | `svc_line_test` — PRESEASON, 2026-09-08 ~ 2026-10-31, ruleset 1.0.0, 팩 0.1.0, `cs_line_test` (`apps/api/seeds/bootstrap-non-production.sql`, 배포마다 upsert) |
| 배포 | main 푸시 → CI `Deploy staging`(migration + 시드 + Workers). 워커는 staging에 직접 배포하지 않는다 |
| 데이터 | D1 `offside-staging` — `careers.created_service_season_id`, `analytics_events` |
| 로그인 | 익명 프로필 + 복구 코드(SCR-030). Google 연결은 U-003 전이라 staging에서 쓰지 않는다 |
| 오류 관찰 | Sentry(U-004) 전이라 `wrangler tail --env staging`과 `command_failed` 이벤트로만 본다 |

## 2. 일정

| 단계 | 언제 | 내용 |
|---|---|---|
| 준비 | 2026-09-04 ~ 09-07 | 3절 체크리스트. 오케스트레이터가 staging에서 FAST 한 시즌·CHAPTER 한 시즌을 직접 완주해 이벤트가 D1에 쌓이는지 확인 |
| 1차 | 09-08 ~ 09-14 | 테스터 10~30명. 매일 5절 조회 1회, 결함은 보드 `T-2-01x`로 |
| 중간 기준선 | 09-15 | 6절 양식으로 1차 기록. 막힘(이탈 step 집중, 오류)은 즉시 수정 PR |
| 2차 | 09-15 ~ 09-21 | 수정 반영 뒤 같은 테스터 + 추가 모집. 두 번째 시즌 시작률을 여기서 본다 |
| 최종 기준선 | 09-22 | 6절 양식 확정 → 결정 로그 → ruleset 1.0.0 확정 결정(로드맵) |
| 종료 | 기준선 확정 뒤 | 시드의 `svc_line_test` status를 `LOCKED`로 바꾸는 PR(시드가 배포마다 upsert하므로 D1 직접 UPDATE는 다음 배포에 되돌아간다). 커리어는 보관함에 그대로 남는다 |

날짜는 시드의 `starts_at`(09-08)에 맞춘 제안이며 사용자가 모집 상황에 따라 옮긴다. 2주를 넘기지 않는다 — Phase 3·4 밸런스 수치가 이 기준선을 기다린다(D-32).

## 3. 준비 체크리스트(공개 전)

| # | 항목 | 담당 | 상태 |
|---|---|---|---|
| 1 | staging `GET /v1/service-seasons/current`가 `svc_line_test`·`isTest: true`를 돌려준다 | 오케스트레이터 | ✅ 2026-09-04 12:34(run `2270e81`): PRESEASON·isTest·notice LINE_TEST |
| 2 | 허브에 LINE TEST 배너·"테스트 시즌" 배지가 보이고 커리어 생성 PUT 본문에 `svc_line_test`가 실린다 | 오케스트레이터 | ✅ 12:56 예행(Playwright, staging)에서 배너·배지 확인. 빈 기기는 온보딩으로 가서 안내를 못 본다 → T-2-015 #3 |
| 3 | FAST·CHAPTER 각 한 시즌 완주 → `analytics_events`에 `funnel_reached` 5단계·`season_settled`가 쌓인다 | 오케스트레이터 | ⚠ 12:56 예행: 완주 통과, 소배치 202. **20건 배치는 503**(D1 문장당 변수 100개 상한, 7열×20행) → T-2-015 #1 머지 뒤 재예행. D1 건수 확인은 U-016(wrangler 로그인) 뒤 |
| 4 | U-014 Workers Paid 플랜 전환(무료 한도: 일 10만 요청·D1 5M 행 읽기 — 30명 규모면 넘지 않지만 rate limit·큐 flush 폭주 대비) | 사용자 | 공개 직전 |
| 5 | U-010 약관·개인정보 문안: 연락처가 "준비 중"이면 안내문에 문의 채널을 따로 적는다 | 사용자 | 출시 전 필수, LINE TEST는 안내문으로 보완 |
| 6 | 테스터 안내문(4절) 발송, 피드백 채널 결정 | 사용자 | |
| 7 | 감시: 매일 5절 쿼리 + `wrangler tail --env staging --format pretty` 1회 | 오케스트레이터 | U-016 뒤 |

## 4. 테스터 안내문(초안, 사용자가 채널에 맞게 다듬는다)

> OFFSIDE 축구 커리어 시뮬레이터 LINE TEST에 참여해 주셔서 고맙습니다.
> - 링크: https://offside-web-staging.tasddc1569.workers.dev (모바일 브라우저 권장, 설치 없음)
> - 기간: 9월 8일 ~ 9월 21일
> - 해 주실 일: 선수 하나를 만들어 첫 프로 계약까지, 그리고 한 시즌을 끝까지 진행해 주세요. 시간이 되면 두 번째 시즌도 시작해 보세요. 시즌 모드는 FAST(4~6분)와 CHAPTER(8~12분) 중 아무거나 좋습니다.
> - 이 기간의 커리어에는 "테스트 시즌" 표시가 붙고 정식 시즌 기록에는 들어가지 않습니다. 기기를 바꾸려면 설정 > 데이터의 복구 코드를 쓰세요. 데이터는 설정에서 언제든 지울 수 있습니다.
> - 저희가 받는 데이터: 화면 이동, 어느 단계까지 갔는지, 선택한 보기, 소요 시간 구간. 선수 이름이나 입력한 글은 보내지 않습니다.
> - 피드백: (채널) — 막힌 화면, 이해 안 되는 문구, 느린 곳을 알려 주세요.

## 5. 측정 쿼리(D1, `wrangler d1 execute offside-staging --remote --env staging --command "<SQL>"`)

`analytics_events` 열: `id, client_id, profile_id, name, props_json, client_ts, received_at`. props는 `json_extract(props_json, '$.키')`. `client_id`는 기기 단위(브라우저 저장소를 지우면 새 id), `careerIndex`는 기기 안 커리어 순번이라 "첫 커리어"는 `careerIndex = 1`.

```sql
-- 5-1 퍼널(첫 커리어): 단계별 기기 수 → 도달률의 분자·분모
SELECT json_extract(props_json,'$.stage') AS stage, COUNT(DISTINCT client_id) AS devices
FROM analytics_events WHERE name='funnel_reached' AND json_extract(props_json,'$.careerIndex')=1
GROUP BY stage;

-- 5-2 두 번째 시즌 시작: 첫 시즌보다 큰 seasonIndex로 step_passed가 찍힌 기기 수
SELECT COUNT(*) FROM (
  SELECT client_id FROM analytics_events WHERE name='step_passed'
  GROUP BY client_id HAVING COUNT(DISTINCT json_extract(props_json,'$.seasonIndex')) >= 2);

-- 5-3 세션 길이: 첫 계약(목표 5분 이하 → '<360' 이하 버킷)과 시즌 완주(FAST 4~6분, CHAPTER 8~12분)
SELECT json_extract(props_json,'$.stage') AS stage, json_extract(props_json,'$.elapsedSecBucket') AS bucket, COUNT(*) AS n
FROM analytics_events WHERE name='funnel_reached' AND json_extract(props_json,'$.stage') IN ('CONTRACT_SIGNED','SEASON_SETTLED')
GROUP BY stage, bucket;
SELECT json_extract(props_json,'$.simulationMode') AS mode, json_extract(props_json,'$.elapsedSecBucket') AS bucket, COUNT(*) AS n
FROM analytics_events WHERE name='season_settled' GROUP BY mode, bucket;

-- 5-4 시즌당 결정 수(RULE-TIME-004: CHAPTER 8~10, FAST 4~6)
SELECT json_extract(props_json,'$.simulationMode') AS mode,
       AVG(json_extract(props_json,'$.decisionsOpened')) AS avg_decisions, MIN(json_extract(props_json,'$.decisionsOpened')) AS min_d, MAX(json_extract(props_json,'$.decisionsOpened')) AS max_d,
       AVG(json_extract(props_json,'$.matchesPlayed')) AS avg_matches, COUNT(*) AS seasons
FROM analytics_events WHERE name='season_settled' GROUP BY mode;

-- 5-5 이탈 step: 결산 없이 끝난 기기의 마지막 step 분포 + 삭제 확인 시점
SELECT last_step, COUNT(*) AS devices FROM (
  SELECT s.client_id, MAX(json_extract(s.props_json,'$.step')) AS last_step
  FROM analytics_events s
  WHERE s.name='step_passed' AND s.client_id NOT IN (SELECT client_id FROM analytics_events WHERE name='season_settled')
  GROUP BY s.client_id) GROUP BY last_step ORDER BY last_step;
SELECT json_extract(props_json,'$.step') AS step, json_extract(props_json,'$.seasonPhase') AS phase, COUNT(*) AS n
FROM analytics_events WHERE name='career_abandoned_hint' GROUP BY step, phase;

-- 5-6 선택지 분포
SELECT json_extract(props_json,'$.eventId') AS event, json_extract(props_json,'$.choiceId') AS choice, json_extract(props_json,'$.riskLabel') AS risk, COUNT(*) AS n
FROM analytics_events WHERE name='choice_selected' GROUP BY event, choice, risk ORDER BY event, n DESC;

-- 5-7 오류·서버 측 커리어 수
SELECT json_extract(props_json,'$.commandType') AS cmd, json_extract(props_json,'$.errorCode') AS code, COUNT(*) AS n
FROM analytics_events WHERE name='command_failed' GROUP BY cmd, code ORDER BY n DESC;
SELECT status, COUNT(*) FROM careers WHERE created_service_season_id='svc_line_test' GROUP BY status;
```

한계(기록해 둔다): 재시도가 없어 네트워크 실패분은 유실된다(D-55). `funnel_reached`는 기기·커리어당 1회라 같은 사람이 기기를 바꾸면 두 기기로 센다. 프로필 복구로 내려받은 커리어는 `createdServiceSeasonId`가 현재 포인터로 덮인다(PR #49 범위 밖 발견) — LINE TEST 중에는 포인터가 `svc_line_test` 하나라 영향 없다.

## 6. 기준선 기록 양식(`docs/tracking/line-test-baseline.md`로 채운다)

```markdown
# LINE TEST 기준선 (기록일 YYYY-MM-DD, 대상 기간 MM-DD ~ MM-DD, 기기 N대)

## 통과 기준 3지표 (로드맵)
| 지표 | 정의 | 값 |
|---|---|---|
| 첫 프로 계약 도달률 | CONTRACT_SIGNED 기기 / ONBOARDING_STARTED 기기 (첫 커리어) | __ / __ = __% |
| 첫 시즌 완주율 | SEASON_SETTLED 기기 / CONTRACT_SIGNED 기기 | __ / __ = __% |
| 두 번째 시즌 시작률 | 5-2 기기 / SEASON_SETTLED 기기 | __ / __ = __% |

## 세션 길이 (시간 모델 목표 대비)
| 구간 | 목표 | 버킷 분포(<60/<180/<360/<720/<1800/>=1800) | 목표 안 비율 |
|---|---|---|---|
| 첫 방문 → 첫 계약 | 5분 이하 | | |
| 한 시즌 FAST | 4~6분 | | |
| 한 시즌 CHAPTER | 8~12분 | | |

## 시즌당 결정 수 (RULE-TIME-004)
| 모드 | 예산 | 평균 | 최소~최대 | 시즌 수 |
|---|---|---|---|---|
| FAST | 4~6 | | | |
| CHAPTER | 8~10 | | | |

## 이탈 step
| step | 기기 수 | 비고(화면·원인 추정) |
|---|---|---|

## 선택지 분포 (상위 이벤트 10개)
| 이벤트 | 선택지 | risk | 횟수 | 비율 |
|---|---|---|---|---|

## 결함·피드백
| # | 내용 | 조치(PR / 작업 ID) |
|---|---|---|

## 판정
- ruleset 1.0.0 확정 여부와 근거(어느 수치가 예산·목표 밖인지):
- Phase 3·4 밸런스 수치에 넘길 개선 목표:
```

## 7. LINE TEST 게이트 완료 조건

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | staging이 `svc_line_test`·`isTest: true`를 돌려주고 허브 배너·배지가 보인다 | ⏳ | 3절 #1·#2 |
| 2 | 오케스트레이터 예행: FAST·CHAPTER 각 1시즌 완주 이벤트가 D1에 있다 | ⏳ | 3절 #3 — 흐름은 통과(12:56), 이벤트 유실 결함 T-2-015 머지 뒤 재예행 + U-016 |
| 3 | 외부 테스터 10명 이상이 첫 커리어를 만들었다 | ⏳ | 5-1 ONBOARDING_STARTED |
| 4 | 기준선 3지표·세션 길이·결정 수·이탈·선택 분포가 6절 양식으로 기록됐다 | ⏳ | `line-test-baseline.md` |
| 5 | 테스트 중 발견한 결함이 닫혔거나 작업 ID로 배정됐다 | ⏳ | 보드 |
| 6 | ruleset 1.0.0 확정(또는 수정 목록) 결정이 결정 로그에 있다 | ⏳ | decision-log |
| 7 | `svc_line_test`를 LOCKED로 바꾸는 PR이 머지됐다 | ⏳ | 시드 |

Phase 2 완료 조건 표(9행, [phase-2-completion.md](phase-2-completion.md))는 T-2-011로 닫혔고, 이 7행이 그 뒤의 LINE TEST 게이트다. 사람 기준 세션 길이 판정(FAST 6분·CHAPTER 12분)은 U-005 종이 플레이테스트가 아니라 여기 5-3·6절 값으로 닫는다.
