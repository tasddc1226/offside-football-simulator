# T-11-080: 선수 방출 · 구단 자금 · 유저 카드 이적시장 기획

작성일: 2026-10-04
상태: 기획 / 구현 전
상위 기획: [T-10-078 서비스 시즌 · 커리어 카드 · 유저 이적시장](season-card-market-plan.md)의 E·F 단계를 이 문서로 구체화한다.
소스 확인 기준: 원격 main `cdae906f`

## 1. 확정한 방향 (2026-10-04)

- **카드 = 은퇴 선수의 최고 OVR 시즌.** 능력치·자리별 실력은 지금도 최고 OVR 시즌 말 값(`peakProfile`)을 쓴다. 이 구조를 그대로 쓴다.
- **카드 기준가 = 최고 OVR 시즌의 몸값.** 몸값이 가장 높았던 시즌(`peakValue`)이 아니라 능력치와 같은 시즌의 몸값이다.
- **방출:** 내가 키운 선수를 라커룸에서 내보내고 그 선수의 **은퇴 가치**(`careers.value`)만큼 구단 자금을 받는다.
- **이적시장:** 구단 자금으로 유저끼리 카드를 사고판다. 판매자는 기준가로 내놓거나 가격을 직접 정한다.
- **거래 대상:** 지금 서비스 시즌 선수 카드만. 지난 시즌 카드는 방출로 자금을 만드는 데 쓴다.
- **방출 지급률:** 은퇴 가치 그대로(1.0)로 시작하고, 운영 도구에서 바꿀 수 있게 한다.

T-10-078의 "기존 카드를 삭제하는 방식으로 신규 수요를 만들지 않는다"는 운영이 카드를 없애는 경우를 막는 원칙이다. 이번 방출은 유저가 스스로 고르는 행동이라 이 원칙과 부딪히지 않는다.

## 2. 현재 코드에서 확인한 출발점

| 영역 | 지금 동작 | 근거 |
|---|---|---|
| 최고 OVR | 시즌 말 OVR의 최댓값. 시즌 중간 값은 세지 않는다 | `packages/game/src/season.ts` `nextYear` |
| 카드 능력치 | 최고 OVR과 같거나 높은 시즌 말, 노쇠 감소 전 값. 같은 OVR이면 나중 시즌 | `season.ts` `endSeason`, `attributes.ts` `peakProfileOf` |
| 옛 은퇴 선수 | `peak_profile` 없음. 카드엔 표시용 추정 능력치(`card_attrs_json`)만, 자리별 실력 없음 | `apps/api/src/db/repos/ownerTeams.ts` `estimatedAttrsOf` |
| 은퇴 가치 | 몸값 상위 세 시즌 평균 × (1 + 레전드 점수 / 250). 은퇴 업로드 때 저장, 옛 기록은 소급 | `packages/contracts/src/market-value.ts` `retireValue`, `db/repos/careerValues.ts` |
| 시즌 몸값 | 리그 자금력 × OVR × 나이 배수(24세 이하 5, 29세 이하 4, 그 위 2). 고교·대학·현역 복무 시즌은 0 | `market-value.ts` `seasonValue` |
| 카드 소유 | 따로 없다. `careers.profile_id`(키운 사람)가 곧 소유자 | `ownerTeams.ts` `listEligibleCareers`, `eligibleMap` |
| 팀 편성 자격 | 내가 키움 · 은퇴 · 은퇴 요약 있음 · 숨김 아님 · **그 서비스 시즌 선수** | 같은 곳 |
| 팀 수정 | 지금 시즌 팀만. 지난 시즌 팀은 고칠 수 없다(프리시즌 팀은 시즌 1 개막에 닫힘) | `routes/ownerTeam.ts` `PUT /v1/owner-team`, `service-seasons.ts` |
| 구단 업적 | 키운 사람 기준으로 그 시즌 은퇴 선수를 센다 | `ownerTeams.ts` `seasonCareersOf` |
| 재화·원장 | 없다 | `db/schema.ts` |

## 3. 운영 데이터로 본 규모 (2026-10-04, 읽기 전용 표본)

최근 은퇴 3,000명(숨김 제외, 프로필 705개, 전부 프리시즌 선수). 단위는 원 표기.

| 백분위 | 25 | 50 | 75 | 90 | 99 |
|---|---|---|---|---|---|
| 기준가(최고 OVR 시즌 몸값) | 4억 3천만 | 26억 7천만 | 66억 1천만 | 107억 7천만 | 218억 1천만 |
| 참고: 최고 몸값 | 5억 4천만 | 44억 | 109억 5천만 | 182억 7천만 | 363억 5천만 |
| 은퇴 가치 | 5억 1천만 | 85억 4천만 | 339억 6천만 | 888억 3천만 | 2,779억 |
| 은퇴 가치 ÷ 기준가 | 1.9배 | 4.2배 | 7.9배 | 11.9배 | 22.3배 |

- 프로필 하나가 가진 은퇴 가치 합: 중앙값 740억, 상위 10% 3,105억, 최대 1조 6,756억.
- 최고 OVR 시즌 몸값이 0인 선수(그 시즌이 대학·현역 복무) 760명(25%). 다른 프로 시즌으로 대체해도 0인 선수(프로 경력 없음) 585명(20%).
- 기준가가 최고 몸값보다 낮은 선수가 52%. 나이 배수 때문에 30대에 최고 OVR을 찍으면 몸값이 반 이하로 떨어진다.

**읽을 점:** 방출 한 번으로 받는 돈이 시장 기준가의 4배 안팎이다. 프리시즌 은퇴 선수만 약 4,500명이 쌓여 있어, 시장을 열자마자 자금이 대량으로 풀린다. 아래 4·7절의 가격 범위·지급률·차익 차단은 이 숫자 때문에 둔다.

## 4. 기준가 정의

1. 시즌 기록(스냅샷 `career`)에서 `ovr === peak`인 시즌 중 **마지막** 시즌의 `seasonValue`. 카드 능력치가 같은 OVR이면 나중 시즌을 남기는 것과 맞춘다.
2. 그 값이 0이면(대학·현역 복무 시즌) 프로 시즌 중 몸값이 가장 높은 시즌(`peakValue`)으로 대체한다.
3. 그래도 0이면(프로 경력 없음) **최저가**를 쓴다. 기본값 1억(1만 만 원), 운영 수치로 둔다.
4. 스냅샷이 없는 옛 기록은 기준가를 매기지 않는다 → 거래 대상에서 뺀다(방출은 은퇴 가치로 가능).

`contracts/market-value.ts`에 `cardValue(career, peak)`로 두고 웹·서버가 같이 쓴다. 서버는 `cards.card_value`에 저장한다(5절). 새 은퇴는 은퇴 업로드 때, 기존 은퇴는 `careerValues.ts`처럼 스냅샷으로 한 번 소급한다.

## 5. 데이터 모델

### 5.1 왜 `careers`에 소유자 컬럼을 더하지 않는가

계정을 지우면 그 사람의 `careers`·`career_seasons` 행이 실제로 지워진다(`db/repos/careers.ts` `deleteCareersStatements`).
`careers`에 소유자만 붙이면, 키운 사람이 계정을 지울 때 다른 구단주가 산 카드가 같이 사라진다.
그래서 **기록(`careers`)과 자산(`cards`)을 나눈다.** 카드는 은퇴 때 경기에 쓰는 값만 복사해 두고, 키운 사람의 기록이 지워져도 남는다.

나누는 기준:

- 은퇴 뒤 바뀌지 않는 경기용 값(포지션·국적·등번호·최고 OVR·최고 시점 능력치·기준가·은퇴 가치)만 `cards`에 복사한다.
- 그 밖의 값(공개 이름·숨김·옛 기록의 추정 능력치)과 "누가 키웠나"(`careers.profile_id`)는 복사하지 않고 `careers`를 PK로 LEFT JOIN해 읽는다. 기록이 지워졌으면 익명·숨김 아님·키운 사람 없음으로 본다.
- 다른 테이블로 알 수 있는 상태는 저장하지 않는다. 방출 = `owner_id IS NULL`, 판매 중 = 열린 등록이 있음, 자금 내역 = 등록·방출 기록을 합친 것.

### 5.2 테이블

**`cards`**: 은퇴 선수 한 명당 한 장. 라커룸·팀 편성·방출·시장이 모두 이 테이블을 본다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `career_id` | text PK | 커리어 id. PK라서 커리어당 카드 한 장이 보장된다. 기록이 지워져도 남아야 해서 FK는 걸지 않는다 |
| `owner_id` | text NULL | 지금 가진 구단주. 방출하면 NULL |
| `service_season` | int | 출신 서비스 시즌(0 = 프리시즌). `careers.service_season` NULL은 0으로 |
| `pos` · `dpos` · `nation` · `number` · `peak` · `legend_score` | | 은퇴 때 값 복사 |
| `peak_profile` | text NULL | 최고 시점 능력치 JSON. NULL이면 옛 기록 |
| `card_value` | int NULL | 기준가(만 원). NULL이면 거래 불가 |
| `retire_value` | int | 은퇴 가치(만 원). 방출 지급 기준 |
| `transfers` | int | 팔린 횟수. 목록에 "이적 n회"를 보여 주려고 센다(행마다 등록 수를 세지 않게) |
| `released_at` · `released_value` | text NULL · int NULL | 방출 시각과 그때 받은 자금 |
| `created_at` · `updated_at` | text | ISO UTC |

인덱스: `(owner_id, service_season, peak)`. 라커룸·팀 편성용으로, 지금 `careers_profile_status_season_idx`가 하는 일을 옮겨 온다. 방출 일괄 집계용 `(owner_id, released_at)`는 자금 내역을 붙일 때 더한다.

**`market_listings`**: 판매 등록. 팔린 등록이 곧 이적 이력이고 구매·판매 자금 내역이라, 이력·원장 테이블을 따로 두지 않는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | `newId('lst')`(`db/ids.ts` `IdPrefix`에 `lst` 추가) |
| `career_id` | text | 카드 |
| `seller_id` · `buyer_id` | text · text NULL | |
| `season` | int | 카드 출신 시즌. 목록 필터용으로 하나만 복사한다 |
| `price` · `fee` | int · int | 판매가, 팔렸을 때 수수료(만 원) |
| `status` | text | `open` · `sold` · `cancelled` |
| `created_at` · `closed_at` | text | |

포지션·OVR·기준가는 복사하지 않는다. 한 페이지 20장을 `cards` PK로 붙여 읽는다.

인덱스:
- `UNIQUE (career_id) WHERE status = 'open'`: 카드 한 장에 열린 등록은 하나.
- `(status, season, created_at)` 최신순, `(status, season, price)` 가격순. OVR순은 매물이 늘면 그때 정렬과 인덱스를 같이 더한다.
- `(seller_id, status)`: 내 등록과 동시 등록 상한. `(buyer_id, closed_at)`: 내 영입 내역과 하루 구매 상한.

**`owner_funds`**: 구단주 잔액.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `profile_id` | text PK | FK `profiles.id` |
| `balance` | int | `CHECK (balance >= 0)` |
| `updated_at` | text | |

행은 처음 자금을 받을 때(방출·판매) 만든다.

**원장 테이블은 두지 않는다.** 자금이 움직이는 길은 셋뿐이고 모두 기록이 이미 남는다.

| 움직임 | 기록이 남는 곳 |
|---|---|
| 방출 | `cards.released_at`·`released_value` |
| 판매·영입 | `market_listings`(`seller_id`·`buyer_id`·`price`·`fee`·`closed_at`) |
| 운영 조정 | `audit_log`(`auditLogStatement`, 새 kind `FUNDS_ADJUSTED`) |

잔액 = 방출 합 + 판매 합(가격 − 수수료) − 영입 합 + 운영 조정. 운영 도구가 구단주 한 명씩 이 식으로 대조한다. "내 거래" 화면의 자금 내역은 세 곳을 시각순으로 합쳐 보여 준다.

**운영 수치**: 방출 지급률·수수료율·가격 범위·최저가·하루 상한·동시 등록 상한은 기존 서버 밸런스 설정(`balance_versions`, `packages/contracts/src/balance-spec.ts`)에 `이적시장` 묶음으로 더한다. 버전·활성화·감사 기록·운영 도구 화면을 새로 만들지 않아도 된다. 게임 수치와 달리 서버가 요청 때 활성 버전을 바로 읽어 쓴다(커리어별 버전 고정 대상이 아니다).

### 5.3 카드 행이 생기는 때

- **새 은퇴:** 은퇴 업로드 batch에 `INSERT OR IGNORE INTO cards`를 더한다. 기준가는 그 요청의 스냅샷으로 `cardValue`를 계산해 넣는다. 같은 커리어를 다시 보내도 PK라 한 장뿐이다.
- **기존 은퇴:** 마이그레이션에서 `INSERT INTO cards SELECT … FROM careers WHERE status = 'retired' AND peak IS NOT NULL`로 한 번에 만든다. 기준가는 JS 계산이 필요해서 NULL로 두고, `careerValues.ts`·`clubIds.ts`와 같은 버전 표식(`setMeta`) + 60건씩 나눠 채우는 `ensure…Backfilled` 방식으로 채운다.
- 프리시즌 선수도 카드를 만든다(방출해서 자금을 만들 수 있어야 한다). 시장 등록만 지금 시즌으로 막는다.

### 5.4 쓰기 흐름

D1 `batch`는 한 트랜잭션이다. 문장 하나라도 실패하면 전부 되돌린다. 이 성질을 두 가지로 쓴다.

- 잔액 부족은 `CHECK (balance >= 0)` 위반으로 batch 전체를 실패시킨다.
- "이번 요청이 이겼는가"는 첫 문장의 조건부 UPDATE가 남긴 표식(`buyer_id`·`closed_at`, 또는 `released_at`)으로 판정하고, 뒤 문장은 모두 그 표식이 있을 때만 바꾼다. 기존 `releaseNotes.ts`의 CAS와 같은 생각이다.

구매·방출 엔드포인트는 기존 `idempotency` 미들웨어(`POST /v1/owner-team/matches`가 쓰는 것)를 붙여 재전송을 같은 응답으로 돌려준다.

구매:

```sql
-- 1) 등록을 잡는다(열려 있고, 읽은 가격 그대로이고, 내가 판 게 아닐 때만)
UPDATE market_listings SET status='sold', buyer_id=:buyer, closed_at=:now, fee=:fee
 WHERE id=:id AND status='open' AND price=:price AND seller_id<>:buyer;
-- 2) 구매자 출금. 잔액이 모자라면 CHECK 위반으로 batch 전체(1 포함)가 되돌아간다
UPDATE owner_funds SET balance=balance-:price, updated_at=:now
 WHERE profile_id=:buyer
   AND EXISTS(SELECT 1 FROM market_listings WHERE id=:id AND buyer_id=:buyer AND closed_at=:now);
-- 3) 판매자 입금(UPSERT) 4) 카드 owner_id 이전·transfers+1. 모두 같은 EXISTS 조건(PK 조회)
```

batch 전에 구매자 잔액 행을 읽어 없거나 모자라면 바로 409를 준다. 잔액 행은 지워지지 않으므로(계정 삭제 제외) 이 확인 뒤 2)가 0행으로 지나가는 일은 없다.
1)의 변경 수가 0이면 "이미 팔렸거나 내린 선수예요"(409). CHECK 위반이면 "자금이 모자라요"(409).

방출(일괄):

```sql
-- 1) 지금 내가 가진 카드 중 내가 키웠고 숨김 아닌 것만
UPDATE cards SET owner_id=NULL, released_at=:now, released_value=retire_value*:rate, updated_at=:now
 WHERE career_id IN (SELECT value FROM json_each(:ids)) AND owner_id=:me
   AND EXISTS (SELECT 1 FROM careers c WHERE c.id=cards.career_id AND c.profile_id=:me AND c.hidden=0)
   AND NOT EXISTS (SELECT 1 FROM market_listings l WHERE l.career_id=cards.career_id AND l.status='open');
-- 2) 잔액: 1)이 방출한 카드의 released_value 합만큼 더한다(UPSERT)
```

id 목록은 JSON 한 바인딩(`json_each`)으로 넘겨 D1 바인딩 100개 제한을 피한다. 지금 시즌 선발에 든 카드는 batch 전에 팀 행을 읽어 거른다.

### 5.5 기존 코드에서 바뀌는 곳

소유 규칙은 하나로 정한다. **소유는 쓰는 때(팀 저장·등록·방출·구매)와 지금 시즌 경기 때 확인한다. 닫힌 시즌 팀은 id로 `cards`를 읽기만 한다.** 이 규칙을 `lineupCards(rows, { season, open })` 한 곳에 두고 호출하는 쪽마다 분기를 넣지 않는다.

| 곳 | 지금 | 바뀐 뒤 |
|---|---|---|
| `listEligibleCareers` | `careers.profile_id = 나` | `cards.owner_id = 나`, 열린 등록 없음 + `careers` LEFT JOIN |
| `careersByIds` · `eligibleMap` | 커리어 소유자 확인 | `lineupCards`로 대체 |
| `toLineupCareer` | `careers` 행 | `cards` 행 |
| `seasonCareersOf`(구단 업적)·명예의 전당·영구결번·시즌 순위 | `careers` | 그대로. 키운 기록이다 |
| `moveCareers`(구글 연결 때 익명 커리어 합치기) | `careers.profile_id`만 옮김 | `cards.owner_id`도 같이 옮긴다 |
| 계정 삭제 | 커리어·팀 삭제 | 더해서: 내 열린 등록 취소, `owner_funds` 행 삭제. 내가 가진 카드는 그대로 둔다(삭제된 구단주의 팀은 이미 `liveTeam`이 숨기고, 닫힌 시즌 팀 조회만 읽는다) |

방출도 이적시장과 같이 **구글 연결된 구단주만** 할 수 있다(`requireOwner`). 그래서 익명 프로필에는 자금이 생기지 않고, 계정 합치기에서 옮길 것은 카드 소유자뿐이다.

## 6. 방출

| 항목 | 기본안 |
|---|---|
| 대상 | **내가 키웠고 지금도 내가 가진** 은퇴 선수. 산 카드는 방출할 수 없다 |
| 지급 | 은퇴 가치 × 방출 지급률(운영 수치, 시작값 1.0 확정) |
| 제외 | 숨김 처리된 기록(자동 플레이), 이적시장에 올려 둔 카드(내린 뒤 방출) |
| 지금 시즌 선발 | 선발에 있으면 먼저 빼야 한다 |
| 기록 | 명예의 전당·시즌 순위·업적·영구결번은 그대로 둔다. 라커룸과 시장에서만 빠진다 |
| 되돌리기 | 안 된다. 확인 창에 받을 금액과 "다시 데려올 수 없어요"를 보여 준다 |
| 여러 명 | 한 번에 여러 명 고르는 일괄 방출을 둔다(프리시즌 선수 정리용). 한 요청 최대 50명 |

화면 용어는 "삭제"가 아니라 "방출"로 쓴다. 기록이 남기 때문이다.

## 7. 이적시장

### 거래 대상

**지금 시즌 선수 카드만** 올릴 수 있다(확정). 팀 편성은 그 시즌 선수만 받고 지난 시즌 팀은 고칠 수 없어서, 지난 시즌 카드는 사도 쓸 곳이 없다. 지난 시즌 카드는 방출로 자금을 만드는 데 쓴다. 시즌이 끝나면 그 시즌 등록은 자동으로 내려간다(조회 때 시즌으로 거른다. 배치 작업 없음).

결과적으로 시즌 1 개막 직후에는 시장이 비어 있다. 시즌 1 선수가 은퇴하면서 매물이 생긴다.

### 등록·구매

| 항목 | 기본안 |
|---|---|
| 참여 자격 | 구글 연결된 구단주(`requireOwner`) |
| 가격 | 기준가 그대로 또는 직접 입력. **기준가의 50%~300%**, 최저가 미만 불가 |
| 등록 | 카드 한 장에 등록 하나, 구단주당 동시 20장. 등록 중에는 선발에 넣을 수 없다 |
| 취소 | 언제든 내릴 수 있다. 가격을 바꾸려면 내리고 다시 올린다 |
| 구매 | 내 카드는 살 수 없다. 하루 10건(한국 시각 자정 기준, `time.ts` `kstDay`) |
| 수수료 | 판매 대금의 5%를 떼어 없앤다(자금이 빠져나가는 유일한 곳) |
| 산 카드 | 바로 선발에 넣을 수 있다. 다시 팔 수 있다 |
| 카드 표시 | 키운 사람(공개 이름 동의 범위 안에서), 출신 시즌, 기준가, 판매가, 이적 횟수 |

구매·방출은 각각 batch 한 번이다(5.4). 동시 구매, 재전송, 취소와 구매 경쟁에서 이중 지출·카드 복제가 없는지 테스트로 고정한다.

## 8. 자금과 악용 방지

- **단위:** 몸값과 같은 만 원 정수. 표기는 `fmtValue`.
- **들어오는 곳:** 방출뿐. 시작 자금은 0. **나가는 곳:** 구매(다른 구단주에게 옮겨 감), 수수료(없어짐).

| 위험 | 막는 방법 |
|---|---|
| 싼 레전드를 사서 방출하는 차익 | 방출은 키운 사람만(6절) |
| 부계정으로 자금 몰아주기(쓸모없는 카드를 비싸게 사 주기) | 가격 상한, 하루 구매 상한, 구글 연결 필수, 같은 두 구단주 사이 반복 거래를 운영 도구에서 확인 |
| 프리시즌 은퇴 선수 일괄 방출로 자금 폭증 | 방출 지급률을 운영 수치로 두고, 시장을 연 뒤 잔액 분포를 보고 조정 |
| 자동 플레이 기록으로 자금 만들기 | 숨김 기록은 방출·등록 불가 |
| 클라이언트가 부풀린 기록 | 기존 은퇴 업로드 점검(`plausibility.ts`)을 통과한 값만 쓴다. 이상 기록으로 숨겨진 커리어는 방출·등록 불가 |

## 9. 서버 부담

CLAUDE.md "백엔드 보호 · 요청 최소화 규칙"을 따른다. 이 기능에서 정한 것만 적는다.

- 시장 목록 첫 페이지 기본 정렬만 엣지 캐시하되 **15초 TTL로 짧게 두고 purge하지 않는다.** `purgeEdge`는 그 데이터센터 사본만 지워서 다른 곳에선 어차피 남는다. 이미 팔린 매물을 누르면 409를 받고 목록을 다시 받는다. 캐시 키는 `edgeKeys.ts`의 `EDGE`에 더한다.
- 카드 정보는 목록 응답에 다 담는다(카드마다 상세 호출 없음). 폴링 없음.

## 10. 작업 단계

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1. 기준가 | `cardValue`, `cards` 테이블·기존 은퇴 백필, 라커룸 카드에 기준가 표시 | 3절 분포를 운영 소급 결과로 다시 확인 |
| 2. 소유권 | 라커룸·팀 편성을 `cards`로 전환(5.5), 지난 시즌 팀 조회 보존, 계정 병합·삭제 | 기존 팀·업적·랭킹 결과가 바뀌지 않음 |
| 3. 방출·자금 | 방출 API(단건·일괄), `owner_funds`, 자금 표시 | 잔액 = 방출·거래 기록 합, 되돌리기 불가 확인 창 |
| 4. 이적시장 | 등록·취소·목록·구매, 수수료, 하루 상한, 웹·앱 화면 | 동시 구매 테스트, 요청 횟수 e2e |
| 5. 운영 도구 | 밸런스 설정에 `이적시장` 묶음, 잔액 대조·분포·반복 거래 조회, 자금 조정(감사 기록) | 배포 없이 수치 조정 |

단계 1~3은 시장 없이도 쓸모가 있다(라커룸 정리 + 자금 확인). 단계 4를 열기 전에 3의 잔액 분포를 보고 지급률을 정한다.

## 11. 남은 결정

기본안을 위에 적어 두었다. 구현하면서 정한다.

1. 가격 범위(50%~300%)와 수수료(5%).
2. 다른 구단주에게 판 카드의 키운 사람 표시 범위(공개 이름을 끈 사람은 "익명").
