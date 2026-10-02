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

한 행에 약 0.5KB가 붙는다. 2026-10-02 기준 하루 시즌 행이 약 3.9만 건이라 하루 약 20MB, 한 달 약 600MB다(D1 약 213MB 시점).
커지면 숨김·QA 커리어의 `growth_json`을 비우거나 오래된 시즌의 세부 능력치(`s0`)를 덜어내는 정리를 따로 낸다.

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
