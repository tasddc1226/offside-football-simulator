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

- 은퇴 뒤 바뀌지 않는 경기용 값(포지션·국적·등번호·최고 OVR·최고 시점 능력치·기준가·은퇴 가치)은 `cards`에 복사한다.
- 은퇴 뒤 바뀔 수 있는 값(공개 이름·숨김·대표 칭호)은 복사하지 않고 `careers`를 LEFT JOIN해 읽는다. 기록이 지워졌으면 익명·숨김 아님으로 본다.

### 5.2 테이블

**`cards`**: 은퇴 선수 한 명당 한 장. 라커룸·팀 편성·방출·시장이 모두 이 테이블을 본다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `career_id` | text PK | 커리어 id. PK라서 커리어당 카드 한 장이 보장된다. 기록이 지워져도 남아야 해서 FK는 걸지 않는다 |
| `creator_id` | text NULL | 키운 구단주. 그 사람이 계정을 지우면 NULL |
| `owner_id` | text NULL | 지금 가진 구단주. 방출하면 NULL |
| `state` | text | `owned` · `listed` · `released` |
| `service_season` | int | 출신 서비스 시즌(0 = 프리시즌). `careers.service_season` NULL은 0으로 |
| `pos` · `dpos` · `nation` · `number` | | 은퇴 때 값 복사 |
| `peak` | int | 최고 OVR |
| `legend_score` | int | 카드 등급(레전드 테두리) 표시용 |
| `peak_profile` | text NULL | 최고 시점 능력치 JSON. NULL이면 옛 기록 |
| `card_attrs_json` | text NULL | 옛 기록의 표시용 추정 능력치 |
| `card_value` | int NULL | 기준가(만 원). NULL이면 거래 불가 |
| `retire_value` | int | 은퇴 가치(만 원). 방출 지급 기준 |
| `transfers` | int | 팔린 횟수 |
| `created_at` · `updated_at` · `released_at` | text | ISO UTC |

인덱스:
- `(owner_id, state, service_season, peak)`: 라커룸·팀 편성. 지금 `careers_profile_status_season_idx`가 하는 일을 옮겨 온다.
- `(creator_id)`: 계정 병합·삭제.

**`market_listings`**: 판매 등록. 팔린 등록이 곧 이적 이력이라 이력 테이블을 따로 두지 않는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | `newId('lst')` |
| `career_id` | text | 카드 |
| `seller_id` · `buyer_id` | text · text NULL | |
| `price` | int | 판매가(만 원) |
| `base_value` | int | 등록할 때의 기준가. 기준가 대비 표시용 |
| `season` · `pos` · `peak` | | 목록 필터·정렬용 복사본(카드 JOIN 없이 인덱스만으로 정렬) |
| `status` | text | `open` · `sold` · `cancelled` |
| `fee` | int | 수수료(팔렸을 때) |
| `created_at` · `closed_at` | text | |

인덱스:
- `UNIQUE (career_id) WHERE status = 'open'`: 카드 한 장에 열린 등록은 하나.
- `(status, season, created_at)` 최신순, `(status, season, price)` 가격순, `(status, season, peak)` OVR순. 포지션 필터는 정렬 인덱스 범위 안에서 거른다(목록이 작을 때). 매물이 수천 건을 넘으면 `(status, season, pos, created_at)`를 더한다.
- `(seller_id, created_at)` · `(buyer_id, closed_at)`: 내 거래 내역과 하루 상한.

**`owner_funds`**: 구단주 잔액.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `profile_id` | text PK | FK `profiles.id` |
| `balance` | int | `CHECK (balance >= 0)` |
| `updated_at` | text | |

**`fund_ledger`**: 자금이 움직일 때마다 한 줄. 잔액은 원장 합과 같아야 한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | |
| `profile_id` | text | |
| `delta` | int | 증감(만 원) |
| `kind` | text | `release` · `sale` · `purchase` · `admin` |
| `career_id` · `listing_id` | text NULL | 참조 |
| `ref` | text | 한 요청의 묶음 id(일괄 방출 한 번 = 같은 ref) |
| `created_at` | text | |

인덱스: `(profile_id, created_at)`.
수수료는 따로 줄을 만들지 않는다. 판매 줄의 `delta`가 `price − fee`이고 `fee`는 등록에 남는다.

**운영 수치**: 방출 지급률·수수료율·가격 범위·최저가·하루 상한은 `app_meta`의 `market:config` 한 줄(JSON)에 두고, 키·기본값·범위는 `packages/contracts/src/market-spec.ts`에 둔다. 게임 밸런스(`balance_versions`)는 클라이언트 게임 수치라 섞지 않는다.

### 5.3 카드 행이 생기는 때

- **새 은퇴:** 은퇴 업로드(`PUT` 은퇴 요약) batch에 `INSERT OR IGNORE INTO cards`를 더한다. 기준가는 그 요청의 스냅샷으로 `cardValue`를 계산해 넣는다. 같은 커리어를 다시 보내도 PK라 한 장뿐이다.
- **기존 은퇴:** 마이그레이션에서 `INSERT INTO cards SELECT … FROM careers WHERE status = 'retired' AND peak IS NOT NULL`로 한 번에 만든다. 기준가는 JS 계산이 필요해서 NULL로 두고, `careerValues.ts`처럼 스냅샷을 읽어 채우는 백필을 운영 도구에서 돌린다.
- 프리시즌 선수도 카드를 만든다(방출해서 자금을 만들 수 있어야 한다). 시장 등록만 지금 시즌으로 막는다.

### 5.4 쓰기 흐름

D1 `batch`는 한 트랜잭션이다. 문장 하나라도 실패하면 전부 되돌린다. 이 성질을 두 가지로 쓴다.

- 잔액 부족은 `CHECK (balance >= 0)` 위반으로 batch 전체를 실패시킨다.
- "이번 요청이 이겼는가"는 첫 문장의 조건부 UPDATE가 남긴 표식(`buyer_id`·`closed_at`, 또는 `released_at`·`ref`)으로 판정하고, 뒤 문장은 모두 그 표식이 있을 때만 바꾼다. `changes()`를 이어 쓰는 것보다 읽기 쉽고, 순서가 바뀌어도 안전하다. 기존 `releaseNotes.ts`의 CAS와 같은 생각이다.

구매:

```sql
-- 0) 구매자 잔액 행 보장(없으면 0으로). 이게 없으면 2)가 0행으로 지나가 공짜 구매가 된다
INSERT OR IGNORE INTO owner_funds (profile_id, balance, updated_at) VALUES (:buyer, 0, :now);
-- 1) 등록을 잡는다(열려 있고, 내가 판 게 아닐 때만)
UPDATE market_listings SET status='sold', buyer_id=:buyer, closed_at=:now, fee=:fee
 WHERE id=:id AND status='open' AND seller_id<>:buyer;
-- 2) 구매자 출금. 잔액이 모자라면 CHECK 위반으로 batch 전체(1 포함)가 되돌아간다
UPDATE owner_funds SET balance=balance-:price, updated_at=:now
 WHERE profile_id=:buyer
   AND EXISTS(SELECT 1 FROM market_listings WHERE id=:id AND buyer_id=:buyer AND closed_at=:now);
-- 3) 판매자 입금(UPSERT) 4) 카드 owner_id·state·transfers 갱신 5) 원장 두 줄. 모두 같은 EXISTS 조건
```

1)의 변경 수가 0이면 "이미 팔렸거나 내린 선수예요"(409). CHECK 위반이면 "자금이 모자라요"(409).
`:price`는 클라이언트 값이 아니라 서버가 등록을 읽어 넣은 값이고, 1)의 WHERE에 `price=:price`도 걸어 읽은 뒤 가격이 바뀐 경우를 막는다.

방출(일괄):

```sql
-- 1) 내가 키웠고 지금 가진, 숨김 아닌 카드만 방출
UPDATE cards SET state='released', owner_id=NULL, released_at=:now, updated_at=:now
 WHERE career_id IN (SELECT value FROM json_each(:ids))
   AND owner_id=:me AND creator_id=:me AND state='owned'
   AND NOT EXISTS (SELECT 1 FROM careers c WHERE c.id=cards.career_id AND c.hidden=1);
-- 2) 원장: 방금 방출된 카드마다 한 줄(retire_value × 지급률)
INSERT INTO fund_ledger (...) SELECT … FROM cards WHERE released_at=:now AND career_id IN (…) AND state='released';
-- 3) 잔액: 2)의 같은 ref 합만큼 더한다(UPSERT)
```

id 목록은 JSON 한 바인딩(`json_each`)으로 넘겨 D1 바인딩 100개 제한을 피한다. 지금 시즌 선발에 든 카드는 batch 전에 팀 행을 읽어 거른다.

### 5.5 기존 코드에서 바뀌는 곳

| 곳 | 지금 | 바뀐 뒤 |
|---|---|---|
| `listEligibleCareers` | `careers.profile_id = 나` | `cards.owner_id = 나 AND state = 'owned'` + `careers` LEFT JOIN(공개 이름·숨김) |
| `careersByIds` · `eligibleMap` | 커리어 소유자 확인 | 카드 소유자·상태 확인. **지난 시즌 팀 조회는 소유를 확인하지 않는다**(판 선수가 지난 팀에서 사라지지 않게) |
| `toLineupCareer` | `careers` 행 | `cards` 행 |
| `seasonCareersOf`(구단 업적) | 키운 사람 기준 | 그대로. 업적은 키운 기록이다 |
| 명예의 전당·영구결번·시즌 순위 | `careers` | 그대로 |
| `moveCareers`(구글 연결 때 익명 커리어 합치기) | `careers.profile_id`만 옮김 | `cards.creator_id`·`owner_id`도 같이 옮긴다 |
| 계정 삭제 | 커리어·팀 삭제 | 더해서: 내 열린 등록 취소, 내가 가진 카드 방출 상태(지급 없음), 내가 키운 카드의 `creator_id` NULL, `owner_funds`·`fund_ledger` 내 행 삭제 |

## 6. 방출

| 항목 | 기본안 |
|---|---|
| 대상 | **내가 키웠고 지금도 내가 가진** 은퇴 선수. 산 카드는 방출할 수 없다(8절 차익 차단) |
| 지급 | 은퇴 가치 × 방출 지급률(운영 수치, 시작값 1.0) |
| 제외 | 숨김 처리된 기록(자동 플레이)은 방출할 수 없다. 이적시장에 올려 둔 카드는 내린 뒤 방출 |
| 지금 시즌 선발 | 선발에 있으면 먼저 빼야 한다 |
| 기록 | 명예의 전당·시즌 순위·업적·영구결번은 그대로 둔다. 라커룸과 시장에서만 빠진다 |
| 되돌리기 | 안 된다. 확인 창에 받을 금액과 "다시 데려올 수 없어요"를 보여 준다 |
| 여러 명 | 한 번에 여러 명 고르는 일괄 방출을 둔다(프리시즌 선수 정리용). 한 요청 최대 50명 |

화면 용어는 "삭제"가 아니라 "방출"로 쓴다. 기록이 남기 때문이다.

## 7. 이적시장

### 거래 대상

**지금 시즌 선수 카드만** 올릴 수 있다(기본안). 팀 편성은 그 시즌 선수만 받고 지난 시즌 팀은 고칠 수 없어서, 지난 시즌 카드는 사도 쓸 곳이 없다. 지난 시즌 카드는 방출로 자금을 만드는 데 쓴다. 시즌이 끝나면 그 시즌 등록은 자동으로 내려간다(조회 때 시즌으로 거른다. 배치 작업 없음).

결과적으로 시즌 1 개막 직후에는 시장이 비어 있다. 시즌 1 선수가 은퇴하면서 매물이 생긴다.

### 등록·구매

| 항목 | 기본안 |
|---|---|
| 참여 자격 | 구글 연결된 구단주(지금 구단주 팀과 같은 `requireOwner`) |
| 가격 | 기준가 그대로 또는 직접 입력. 범위는 **기준가의 50%~300%**, 최저가 미만 불가 |
| 등록 수 | 카드 한 장에 등록 하나. 구단주당 동시 등록 20장 |
| 등록 중 카드 | 선발에 넣을 수 없다. 선발에 있으면 등록 전에 빼야 한다 |
| 취소 | 언제든 내릴 수 있다. 가격을 바꾸려면 내리고 다시 올린다 |
| 구매 | 내 카드는 살 수 없다. 자금이 모자라면 살 수 없다 |
| 수수료 | 판매 대금의 5%를 떼어 없앤다(자금이 빠져나가는 유일한 곳) |
| 산 카드 | 바로 선발에 넣을 수 있다. 다시 팔 수 있다. 방출은 안 된다 |
| 하루 상한 | 구단주당 구매 10건, 등록 20건(한국 시각 자정 기준) |
| 카드 표시 | 키운 사람(공개 이름 동의 범위 안에서), 출신 시즌, 기준가, 판매가, 이적 횟수 |

### 원자성

구매·방출은 각각 D1 `batch` 한 번으로 처리한다(5.4). 동시 구매, 재전송, 취소와 구매 경쟁에서 이중 지출·카드 복제가 없는지 테스트로 고정한다.

## 8. 자금과 악용 방지

- **단위:** 몸값과 같은 만 원 정수. 표기는 `fmtValue`.
- **들어오는 곳:** 방출뿐. 시작 자금은 0.
- **나가는 곳:** 구매(다른 구단주에게 옮겨 감), 수수료(없어짐).
- **원장:** `fund_ledger`(구단주, 증감, 종류: 방출·판매·구매·수수료, 참조 id, 시각)에 모두 남기고, `owner_funds.balance`는 원장 합과 같아야 한다. 운영 도구에서 불일치를 확인한다.

| 위험 | 막는 방법 |
|---|---|
| 싼 레전드를 사서 방출하는 차익 | 산 카드는 방출 불가. 방출은 키운 사람만 |
| 부계정으로 자금 몰아주기(쓸모없는 카드를 비싸게 사 주기) | 가격 상한 기준가의 300%, 하루 구매 상한, 구글 연결 필수, 같은 두 구단주 사이 반복 거래를 운영 도구에서 확인 |
| 프리시즌 은퇴 선수 일괄 방출로 자금 폭증 | 방출 지급률을 운영 수치로 두고, 시장을 연 뒤 잔액 분포를 보고 조정 |
| 자동 플레이 기록으로 자금 만들기 | 숨김 기록은 방출·등록 불가 |
| 클라이언트가 부풀린 기록 | 기존 은퇴 업로드 점검(`plausibility.ts`)을 통과한 값만 쓴다. 이상 기록으로 표시된 커리어는 방출·등록 불가 |

## 9. 서버 부담

- 시장 목록은 화면을 열 때만 부른다. 카드 정보는 목록 응답에 다 담고 카드마다 상세를 부르지 않는다.
- 목록은 포지션 필터·정렬(최신·가격·OVR)·커서 페이지(20장). 정렬마다 받치는 인덱스를 함께 낸다.
- 첫 페이지 기본 정렬만 엣지 캐시(30초)하고 등록·취소·구매 때 `purgeEdge`로 지운다.
- 내 자금·내 등록은 사용자마다 달라서 캐시하지 않고 `cachedGet`으로 메모한다. 등록·구매·방출 뒤 `apiFetch`가 메모를 비운다.
- 폴링 없음. 산 뒤에 목록을 다시 받는다.

## 10. 작업 단계

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1. 기준가 | `cardValue`, `cards` 테이블·기존 은퇴 백필, 라커룸 카드에 기준가 표시 | 3절 분포를 운영 소급 결과로 다시 확인 |
| 2. 소유권 | 라커룸·팀 편성을 `cards`로 전환(5.5), 지난 시즌 팀 조회 보존, 계정 병합·삭제 | 기존 팀·업적·랭킹 결과가 바뀌지 않음 |
| 3. 방출·자금 | 방출 API(단건·일괄), `owner_funds`·`fund_ledger`, 자금 표시 | 원장 합 = 잔액, 되돌리기 불가 확인 창 |
| 4. 이적시장 | 등록·취소·목록·구매, 수수료, 하루 상한, 웹·앱 화면 | 동시 구매 테스트, 요청 횟수 e2e |
| 5. 운영 도구 | 지급률·수수료율·가격 범위·최저가 조정, 잔액 분포·반복 거래 조회 | 배포 없이 수치 조정 |

단계 1~3은 시장 없이도 쓸모가 있다(라커룸 정리 + 자금 확인). 단계 4를 열기 전에 3의 잔액 분포를 보고 지급률을 정한다.

## 11. 남은 결정

기본안을 위에 적어 두었다. 바꾸려면 아래 항목을 고른다.

1. 거래 대상을 지금 시즌 카드로 한정할지, 아니면 산 카드는 출신 시즌과 관계없이 지금 시즌 팀에 넣게 할지. 후자는 "그 시즌 선수로만 팀을 꾸린다"는 시즌 경쟁 규칙을 바꾼다.
2. 방출 지급률 시작값. 은퇴 가치 그대로(1.0)면 3절처럼 기준가의 4배 안팎이 풀린다.
3. 가격 범위(50%~300%)와 수수료(5%).
4. 이미 다른 구단주에게 판 카드의 키운 사람 표시를 어디까지 보여 줄지(공개 이름을 끈 사람은 "익명").
5. 계정 삭제 시 처리. 기본안은 5.5 표 마지막 줄.
