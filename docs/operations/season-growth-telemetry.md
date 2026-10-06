# 시즌 성장 기록 (T-11-048)

시즌마다 능력치·OVR·잠재력이 어떻게 바뀌는지 서버에 남긴다. 성장 곡선, 잠재력과 성장 속도의 관계, 시작 OVR과 잠재력의
독립성 같은 밸런스 검증용이다. 게임에는 보이지 않고 점수·순위·판정 어디에도 쓰지 않는다. 값은 기기가 보내므로 조작될 수
있다 — 숨김 커리어(`careers.hidden = 1`)는 집계에서 뺀다.

## 저장 위치

`career_seasons`에 시즌마다 한 줄. `growth_json`(아래 JSON). 성장 기록이 없는 옛 행·옛 클라이언트
업로드는 NULL이다. 같은 시즌을 성장 기록 없이 다시 올려도 이미 쌓인 값은 지워지지 않는다(coalesce).

| 키        | 내용                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------- |
| `v`       | 형식 버전(1). 세부 능력치 키 순서가 바뀌면 올린다.                                                 |
| `o0`      | 시즌 시작 OVR. 첫 시즌은 선수를 만든 직후 OVR이다(= 시작 지점).                                    |
| `ph`      | 구간(프리시즌·전반기·후반기)에 들어갈 때마다의 OVR. 시즌 끝 OVR은 `career_seasons.ovr`.            |
| `a0`·`a1` | 시즌 시작·끝 능력치 6개 — `pac, sho, pas, dri, def, phy` 순서.                                     |
| `s0`·`s1` | 시즌 시작·끝 세부 능력치 — `SUB_KEYS`(`packages/game/src/attributes.ts`) 순서, 34개.               |
| `pot`     | `s` 스카우트 평가, `b` 잠재력 보너스, `bl` 숨은 성장분, `r` 재평가 횟수. 실제 잠재력 = s + b + bl. |

`SUB_KEYS`는 맨 뒤에만 더한다(순서 고정 테스트가 `attributes.test.ts`에 있다). 순서를 바꾸거나 빼야 하면 `v`를 올리고 위
표와 테스트를 함께 고친다.

시즌 끝 값은 `endSeason`이 노쇠·재평가를 적용하기 *전*에 뜬다(`takeSeasonGrowth`). 시즌 시작 값은 직전 시즌 노쇠·재평가가
반영된 값이라, 한 시즌의 `a1`과 다음 시즌의 `a0` 차이가 시즌 사이(노쇠·시장·재평가)의 변화다.

## 용량

한 행에 약 0.5KB가 붙고, 그중 3분의 2가 세부 능력치(`s0`·`s1`)다. 2026-10-04 하루 시즌 행이 15만 건을 넘어 이 열만 하루 약
70MB가 쌓였다(D1 약 800MB 시점). 세부 능력치별 성장 분석을 계속하므로 빼지 않는다 — T-11-097에서 잠깐(2026-10-05 KST
14:52~) 빼고 저장했다가 T-11-097b에서 되돌렸다. 그 사이(UTC 2026-10-05 05:52:50 ~ 07:26:43, 13,988행) 올라온 시즌은
`s0`·`s1`이 없다 — 분석에서 뺀다.

## 보관 (T-11-100)

매일 작업(KST 04:00, `apps/api/src/cron/growthArchive.ts`)이 올라온 지 30일(`KEEP_DAYS`) 지난 시즌의 성장 기록을 R2
`offside-d1-backup` 버킷 `growth/<env>/<실행일>-<시각>.ndjson.gz`로 옮기고 D1에서는 `growth_json`을 비운다. 시즌 행과 다른
열은 그대로다. 그날 D1 백업 뒤에 돌아서, 백업이 성공했으면 비우기 전 값은 그날 백업에도 남는다. 백업 정리는 `d1/` 아래만 지우므로 이 파일은
지워지지 않는다.

- 한 줄이 한 시즌이다: `{"careerId","year","age","ovr","createdAt","growth":{…growth_json 그대로}}`. 포지션·잠재력·숨김 같은
  커리어 정보는 D1 `careers`와 `careerId`로 잇는다.
- D1에 남은 성장 기록 중 30일 지난 것을 부분 인덱스(`career_seasons_growth_created_idx`)로 찾아 옮기고, 올린 행만 비운다.
  한 번에 40만 행까지 옮기고 남은 행은 다음 날 옮긴다.
- 옮긴 뒤 같은 시즌이 성장 기록과 함께 다시 올라오면(진행 중 커리어의 재전송) 그 행은 다음 실행이 다시 옮긴다. 같은
  `(careerId, year)`가 여러 파일에 있으면 나중 파일(파일 이름의 시각) 값을 쓴다.

분석은 최근 30일은 D1, 그 전은 R2 파일을 내려받아 한다:

```bash
wrangler r2 object get offside-d1-backup/growth/production/<파일> --remote --file g.ndjson.gz
gunzip -c g.ndjson.gz | jq -c 'select(.age == 18) | [.growth.o0, .ovr]'
```

## 조작 판정 (T-11-097)

시즌 업로드(`PUT /v1/careers/:id/seasons/:year`)는 성장 기록으로 세이브를 고친 흔적을 보고 그 커리어를 숨긴다
(`growthTampered`, `apps/api/src/db/repos/anomalies.ts`). 저장된 OVR은 나이별 상한으로 잘리고 만 24세부터는 99까지
그대로라, 시즌 중간에 능력치를 올린 기록은 성장 기록에만 남는다.

- 시작 → 구간마다 → 시즌 끝 OVR 중 한 번에 `ANOMALY.growthStep`(20) 이상 오름. 2026-10-05 운영 32만 시즌에서 정상은 14가
  최대, 조작은 23 이상이었다.
- 시즌 시작 OVR(`o0`)이 지난해 시즌의 저장된 OVR보다 `ANOMALY.growthCarry`(5) 이상 높음. 정상은 29만 번 중 한 번도 오르지
  않았다.

성장 기록 없이 올라온 시즌은 이 판정을 받지 않는다(매일 점검의 시즌 간 상승·나이별 상한만 본다).

## 집계 예

```sql
-- 시즌 시작 OVR과 첫 시즌 말 OVR, 잠재력(숨김 제외)
SELECT json_extract(s.growth_json, '$.o0'), s.ovr AS ovr_end, c.pot
FROM career_seasons s JOIN careers c ON c.id = s.career_id
WHERE s.age = 18 AND json_extract(s.growth_json, '$.o0') IS NOT NULL AND c.hidden = 0;

-- 나이별 평균 시즌 성장(시작 → 끝)
SELECT age, count(*) n, round(avg(ovr - json_extract(growth_json, '$.o0')), 2) gain
FROM career_seasons s JOIN careers c ON c.id = s.career_id
WHERE growth_json IS NOT NULL AND c.hidden = 0 GROUP BY age ORDER BY age;
```
