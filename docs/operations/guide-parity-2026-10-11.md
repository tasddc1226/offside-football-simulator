# T-11-202 공개 게임 가이드 대조

2026-10-11 main `66d970b4`의 규칙 기준. PR 전 main `faaab542`의 CI 변경까지 반영했다. 대상은 웹 `/guide/`, `/faq/`, `/fairness/`와
앱 설정이 여는 동일 웹 페이지다. 게임 판정·확률·저장 형식은 바꾸지 않는다.

## 확인된 차이와 수정

| 주제               | 기존 설명의 문제                                      | 현재 동작과 수정 근거                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 자기 투자 특훈     | 잠재력을 넘지 못한다고 단정                           | `packages/game/src/training.ts`의 `growthFactor`는 잠재력에 따른 성장 배율에 양의 최솟값을 둔다. 상한이 아닌 성장 속도 기준으로 수정                                                                                       |
| 유료 상품 확률     | FAQ가 모든 결제의 확률이 같다고 단정                  | `packages/game/src/premiumScout.ts`의 `premiumPot`·`scoutOdds`: 프리미엄은 A 이상 1명 보장, 각 후보의 S 확률 2배. 일반 리롤·강화권과 구분                                                                                  |
| 리롤 횟수          | 하루 최대 5회라는 전체 사용 제한처럼 설명             | `packages/app-core/src/ad-reroll.ts`, `packages/contracts/src/balance-spec.ts`, `apps/api/src/db/repos/itemShop.ts`, `apps/api/src/routes/cup.ts`: 광고 보상과 일일 구매 한도는 별개이며 보유 티켓 전체의 사용 한도가 아님 |
| 영구결번           | 먼저 자격을 채우면 확보하는 것처럼 설명               | `packages/contracts/src/retired-numbers.ts`, `apps/api/src/db/repos/retiredNumbers.ts`: 공개 이름·30세 이상 은퇴, 6시즌·포지션 기준, 적격 상위 2개 구단, 서비스 시즌별 구단·번호 선점. 현역 중 예약 없음                   |
| 영구결번 도전 현황 | 은퇴할 때만 확인할 수 있는 설명                       | `packages/app-core/src/i18n/ko/gameCareer.ts`: 커리어 탭에서 완료·동기화된 시즌 기준의 재적 시즌·기여도·번호 점유 확인                                                                                                     |
| 팀 편성            | 이번 시즌 은퇴 선수만 쓸 수 있는 설명                 | `packages/contracts/src/owner-team.ts`의 `TEAM_WILDCARD_MAX`, `apps/api/src/db/repos/ownerTeams.ts`의 `listEligibleCareers`: 지난 시즌 선수 최대 3명. `service-seasons.ts`: 은퇴 날짜가 아닌 최초 업로드로 시즌 귀속       |
| 컵 무승부          | 조별 예선도 승부차기로 읽히는 설명                    | `apps/api/src/team/cup.ts`: 토너먼트에서만 동점 시 승부차기. 조별 예선 무승부 명시                                                                                                                                         |
| 서비스 시즌 길이   | FAQ는 무조건 4주 후 종료, 가이드는 컵 연장 안내       | `apps/api/src/cron/seasonGauge.ts`, `packages/contracts/src/season-gauge.ts`: 미완료 컵의 결승 다음 날 0시 KST까지 연장 가능. FAQ 보완                                                                                     |
| 공개 은퇴 기록     | 저장 안내가 모든 은퇴를 명예의 전당에 공개한다고 설명 | `apps/api/src/db/repos/careers.ts`의 `isPublicRetired`: 30세 이상. 짧은 커리어는 내 선수에만 남는다는 본문과 통일                                                                                                          |
| 메뉴·누적 기록     | 이전 '구단주 화면' 경로, 내 선수·명예관 안내 누락     | `apps/web/src/ui/Owner.svelte`, `packages/app-core/src/i18n/ko/owner.ts`, `ownerProfile.ts`: 내 구단 → 팀 관리·내 선수·명예관 경로 보완                                                                                    |

기존 FAQ의 구단 기여도 설명은 유지하고 장기 재적·군 복무 제외 조건을 명확히 했다.
검색용 FAQ JSON-LD와 화면 본문은 같은 질문·답을 사용하며 회귀 검사로 일치를 확인한다.

## 확인 범위와 남은 한계

- 선수 생성·잠재력 공개, 훈련, 잠재력 강화, 은퇴 연령, 카드 기준가·구단 가치,
  팀·컵·서비스 시즌 관련 안내를 현재 구현과 대조했다. 이번 변경은 확인된 불일치와 경로 누락을 고친다.
- `/fairness/`는 이미 프리미엄 스카우트 예외를 안내하고 있어 본문을 바꾸지 않았다.
- 공개 정적 페이지는 현재 한국어 고정이다. 수정한 규칙 설명은 `i18n/ko|en|ja/publicGuide.mjs`에
  세 언어로 보관한다. SEO 빌드가 Node에서 직접 실행되므로 런타임 `ns()` 대신 일반 ESM을 사용하며,
  앱 언어 번들에 추가하지 않는다. 영어·일본어 사전을 넣었다는 것이 페이지 전체 언어 전환을 뜻하지 않는다.
- 법적 문서의 공개 범위 표현은 별도 검토 대상이며 이번 가이드 변경에 포함하지 않는다.
- 앱 설정은 같은 `/guide/`를 브라우저로 연다. 네이티브 화면 변경은 없으며 iOS/Android 실기기 재검증은 하지 않았다.

## 검증

- `node --test apps/web/scripts/seo.test.mjs`: FAQ 본문/JSON-LD 일치, 사전 키·값 대응 포함.
- `pnpm lint:i18n`, `pnpm lint:deps`, 변경 소스 ESLint·Prettier, 릴리즈 노트 99건 형식 검사 통과.
- 웹 타입 검사 오류 0건(기존 경고 2건). 웹 빌드와 `check:bundle:prod` 통과.
- 웹 빌드 통과. 로컬 가이드 390px·320px, FAQ 320px에서 가로 넘침 0, 본문 줄바꿈·링크 확인.
