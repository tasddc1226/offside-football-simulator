# T-10-083: GA4 최소 행동 측정 기획

작성일: 2026-09-28 · 상태: 기획 / 구현·운영 설정 미적용

확인 기준: 원격 main `bfb8317248c229f98eb15e38710673e432dce5ec`.

## 1. 목적과 범위

Cloudflare의 트래픽·성능·Workers/D1 사용량 모니터링은 유지한다.
GA4는 홍보 유입이 실제 플레이로 이어지는지, 첫 커리어를 진행하고 다시 시작하는지
판단하는 데 사용한다. 방문 수를 한 대시보드 더 만들기 위한 도입은 아니다.

첫 단계는 웹 스트림 1개와 핵심 행동 이벤트에 한정한다. 광고 연동, Google Signals,
User-ID, 서버 측 태깅, BigQuery, 별도 분석 DB, 모든 클릭·턴·경기 추적은 제외한다.
이 문서는 측정 계약의 제안이며 실제 GA 속성 생성·개인정보 고지·배포는 구현 단계에서 처리한다.

판단할 질문:

1. 유입 채널별로 방문한 사람 중 실제 선수를 생성하는 비율은 얼마인가?
2. 생성 → 첫 시즌 완료 → 은퇴 사이에서 얼마나 진행하고 어디에서 멈추는가?
3. 은퇴한 사람이 다음 커리어를 시작하는가? 다른 포지션·유형도 선택하는가?
4. 커리어 공유 버튼을 누른 뒤 링크 복사까지 성공하는가?

## 2. 현재 코드와 연결 후보

| 확인한 코드 | 현재 동작 | 측정 설계에 주는 제약 |
|---|---|---|
| `apps/web/src/main.ts`, `ui/App.svelte` | Svelte SPA 초기화와 내부 화면 분기 | URL만으로 모든 화면 전환을 알 수 없음 |
| `apps/web/src/ui/actions.ts`의 `startCareer` | newGame → save → game 화면 | 생성 버튼 클릭이 아니라 실제 새 커리어 생성 후 측정 |
| 같은 파일의 `endSeason` 호출 경로 | 시즌 종료 → uploadSeason → save | 첫 종료 전환에서 측정, 보고서 다시 열기는 제외 |
| 같은 파일의 `doRetire` | retire → 업로드 요청 → save → retired 화면 | 실제 은퇴와 은퇴 화면 열람을 구분 |
| `apps/web/src/ui/helpers.ts`, `game/outbox.ts` | 비동기 업로드·재시도·옛 은퇴 기록 업로드 | outbox 성공을 플레이 이벤트 발생 기준으로 삼지 않음 |
| `apps/web/src/ui/ShareBar.svelte` | 링크 유효성 확인 후 클립보드 복사 | 버튼 클릭, 복사 성공, 실제 SNS 게시를 구분 |
| `apps/web/src/ui/helpers.ts`의 `APP_VERSION` | 빌드 커밋 식별자 | 배포별 관측 구분에 재사용 가능 |

apps/packages에서 gtag·dataLayer·Google Analytics/GTM 식별자·Cloudflare beacon 참조를
검색했으나 일치하는 연결 코드를 찾지 못했다. 이것은 소스 점검 결과이며 대시보드 자동 삽입이나
별도 운영 설정까지 확인한 것은 아니다. 프로덕션 네트워크 점검으로 이중 설치 여부를 확인한다.

## 3. 초기 이벤트 계약

공통값은 `measurement_version=1`, `app_version`이다. 게임 이벤트에는 가능한 경우
`position`(FW/MF/DF/GK), `player_trait`(early/late/iron/star), `balance_version`을 붙인다.
값은 고정 열거형/버전으로 제한하고 모르는 값은 `unknown`으로 처리한다.

| 이벤트 | 발생 조건 | 범위·중복 규칙 | 추가 값 |
|---|---|---|---|
| `page_view` | 최초 화면과 주요 화면의 실제 전환 | 하나의 전환에서 1회. 재렌더는 제외 | 정규화한 화면 URL·제목 |
| `career_start` | startCareer가 새 상태를 만들고 저장을 시도한 후 게임 화면으로 전환 | 커리어당 1회. 후보 뽑기·이어서 하기는 제외 | `start_context`, `position_changed`, `trait_changed` |
| `first_season_complete` | 새 커리어의 첫 시즌 종료 기록이 생성됨 | 커리어당 1회. 학교 마지막 시즌도 포함 | `career_origin` |
| `career_retire` | doRetire에서 실제 은퇴 기록 생성 | 커리어당 1회. 옛 기록 소급 업로드·조회 제외 | `career_origin`, `completed_seasons_bucket` |
| `career_share_click` | 활성 공유 버튼의 사용자 클릭 | 비활성 중 재클릭 제외. 별도 재시도는 새 시도 | `share_method=copy_link` |
| `career_share_copy_success` | 해당 시도의 clipboard write가 resolve | 시도당 1회. 실패/수동 복사 안내는 제외 | `share_method=copy_link` |

새 커리어 시작은 별도 이벤트를 또 보내지 않고 `career_start.start_context`로 구분한다:
`first_observed`, `after_retirement`, `replace_active`, `unknown`.
`after_retirement`는 직전 커리어 은퇴 이후 최초의 새 생성에만 붙이며, 과거에 은퇴 경험이
있다는 이유로 모든 생성을 반복 플레이로 분류하지 않는다. 상태를 잃었으면 unknown이다.
`first_observed`는 해당 브라우저에서 처음 관측했다는 뜻이지 생애 첫 플레이어라는 뜻이 아니다.

`position_changed`/`trait_changed`는 after_retirement일 때 직전 은퇴 선수와 비교한
true/false/unknown이다. 후속 생성 정보를 사용자 입력 원문으로 보내지 않는다.
`career_origin`은 측정 활성 상태에서 생성 이벤트를 기록한 `observed_start`와
기존 세이브/도중 동의 등 생성부터 관측하지 못한 `preexisting_or_unknown`을 구분한다.
완료 시즌 수는 0/1/2–5/6–10/11+ 구간으로 보낸다. 은퇴 이벤트는 명예의 전당 등재를 뜻하지 않는다.

초기 핵심 이벤트(key event)는 `career_start`, `career_retire` 두 개만 제안한다.
복사 성공은 실제 공유 게시나 유입 성과로 이름 붙이지 않는다. 이미지 저장·네이티브 공유 등은
실제로 반영된 경로를 확인한 뒤 별도 계약으로 추가한다.

## 4. 지표·보고서 정의

GA의 측정 가능한 브라우저 사용자 단위로 집계한다. 계정 수·실제 사람 수와 동일시하지 않는다.
시간대는 Asia/Seoul, 주간 관찰을 기본으로 하고 최초 2주는 계측 검증·기준선 수집에 사용한다.

| 지표 | 정의 / 관측 기간 | 해석 |
|---|---|---|
| 방문 → 시작 | 같은 세션에서 page_view 뒤 career_start가 있는 세션 / 페이지를 본 세션 | 세션 유입 source/medium 기준 비교 |
| 시작 → 첫 시즌 | 시작 주의 career_start 사용자 중 24시간 내 first_season_complete가 이어진 사용자 / 시작 사용자 | 성숙한 24시간 표본만 포함 |
| 시작 → 은퇴 | 시작 주의 사용자 중 7일 내 career_retire가 이어진 사용자 / 시작 사용자 | observed_start만 포함, 성숙한 7일 표본 |
| 은퇴 → 재시작 | 은퇴 주의 사용자 중 7일 내 after_retirement 시작이 있는 사용자 / 은퇴 사용자 | 중복 사용자 제거, 단순 생성 이벤트 수 나눗셈 금지 |
| 재시작 다양성 | after_retirement 생성 중 position_changed=true 건수 / 비교값이 알려진 해당 생성 건수 | 유형 변경도 같은 방식, unknown 건수 별도 표시 |
| 공유 복사 성공 | 복사 성공 이벤트 수 / 공유 클릭 이벤트 수 | 시도 기준, 실제 외부 게시율 아님 |
| D1/D7 재방문 | 시작 코호트 중 KST 다음 날/7일 뒤에 활동한 사용자 비율 | 24시간/168시간 경과 정의와 혼용하지 않음 |

첫 세 보고서는 (1) 채널별 시작 전환, (2) 순서가 있는 진행 퍼널,
(3) 은퇴 후 재시작과 다양성으로 구성한다. UTM 캠페인, 포지션, 유형, 버전으로 필요할 때 나눈다.
GA 탐색에서 동일 세션·순서·시간 제한을 정확히 표현할 수 있는지 실제 표본으로 검증하고,
지원하지 않는 조합을 비슷한 기본 지표로 바꿔 같은 이름을 붙이지 않는다.

MVP는 GA에 careerId를 보내지 않으므로 진행 퍼널은 **사용자 행동 흐름**이며 동일 선수의
완주율을 보증하지 않는다. 한 사람이 중간에 선수를 바꾸면 여러 커리어의 행동이 연결될 수 있다.
정확한 동일 커리어 완주 분석이 필요해지면 기존 게임 기록의 집계 또는 별도 분석 키 설계를
후속으로 검토한다. 이를 위해 D1 조회 API를 이번 범위에 추가하지 않는다.

진행 중인 사람을 즉시 이탈자로 세지 않는다. 관측 창이 끝난 코호트만 비교하고 각 비율에
분자·분모를 같이 표시한다. 동의 거부·차단·오프라인·쿠키 삭제·기기 변경으로 누락/분리가 생긴다.
표본이 적거나 게임 버전/유입 구성 변화가 큰 때는 개선의 인과관계를 단정하지 않는다.

## 5. 홍보 링크 규칙

직접 게시하는 링크는 `utm_source`(threads, instagram, geeknews 등),
`utm_medium`(social, community), `utm_campaign`(launch, retirement_share 등)을
소문자 고정 목록으로 붙인다. 예: `?utm_source=threads&utm_medium=social&utm_campaign=retirement_share`.
필요한 게시물 구분만 제한된 `utm_content`로 쓰며 계정명·DM 내용·사용자 ID는 넣지 않는다.

기본 보고서는 세션 유입 기준이다. 최초 유입 기준 보고서는 별도로 이름 붙인다.
자발적인 이용자 공유에는 UTM이 없거나 원래 홍보 UTM이 그대로 남을 수 있다.
referrer가 없으면 direct로 남을 수 있으므로 자발적 공유를 모두 찾는 도구라고 설명하지 않는다.
내부 화면 링크에 UTM을 붙여 원래 유입을 덮어쓰지 않는다.

## 6. 수집·개인정보·실패 처리 제안

- 첫 도입은 기본 동의 방식: 분석 동의 전에는 Google 태그 로드/전송을 하지 않는다.
  거부해도 게임은 동일하게 작동하고 설정에서 변경할 수 있게 한다. 동의 전 행동을 나중에 소급 전송하지 않는다.
- 철회 시 이후 전송 중단과 분석용 저장 데이터 정리 경로를 제공한다. 이미 서버에 수집된 기록의
  삭제와 브라우저 데이터 삭제는 다르므로 실제 지원 절차를 고지한다.
- 동의 문구·개인정보처리방침·적용 지역 요건은 배포 전에 검토한다. Consent Mode 자체가 법적 요건을
  모두 충족시켜 주는 것으로 간주하지 않는다. 광고 목적 수집·광고 개인화는 초기 범위에서 끈다.
- 선수명, 닉네임, 이메일, 복구 코드, 토큰, profileId/careerId, 세이브 원문, DM, 자유 입력을 보내지 않는다.
  User-ID 연결이나 기기 간 식별 통합도 하지 않는다.
- URL의 query/hash와 공유 경로의 개별 ID, 문서 제목·referrer에도 개인 식별 정보가 섞일 수 있다.
  페이지 URL/제목은 고정 화면 값으로 정규화하고 캠페인 값만 검증해 보존한다.
  referrer는 필요한 출처 정보만 남기며 OAuth/복구 URL 원문을 전송하지 않는다.
- 향상된 측정의 폼·사이트 검색·외부 링크 등 자동 수집은 초기에는 끄고 필요한 이벤트만 허용한다.
  자동 page_view 및 history 기반 수집도 끄고 초기/전환 모두 한 경로에서 수동 전송한다.
  home/create/game/retired/owner/hof/shared_career 정도의 화면만 측정하고 모든 탭·모달은 추적하지 않는다.
- 분석 모듈은 UI 계층의 성공한 상태 전환에서 호출한다. 순수 게임 로직·RNG에 삽입하지 않는다.
  전송 실패·광고 차단이 저장·게임 진행·클립보드 동작에 영향을 주거나 토스트를 만들면 안 된다.
- 기존 save()는 성공 값을 반환하지 않으므로 저장 시도 뒤 호출만으로 영구 저장 성공을 보증하지 않는다.
  측정 실패 때문에 기존 저장 계약을 바꾸지 않고, 구현 시 오류 경로를 확인해 허위 성공을 방지한다.
- careerId는 중복 억제용 로컬 키로만 사용한다. 완료 이벤트별 표시를 별도 분석 저장소에서 관리하고
  활성 커리어 + 최근 30일 최대 200개 커리어까지만 보관하는 안을 검토한다. 게임 세이브에 섞지 않는다.
  다중 탭 경합·표시 만료·저장소 삭제로 중복이 생길 수 있어 exactly-once를 보증하지 않는다.
- 완료 표시 후 전송 시도하는 best-effort 방식으로 시작한다. 자체 영구 전송 큐·과거 재전송은 만들지 않는다.
  오프라인 누락은 허용하며 outbox 재시도와 중복되지 않는다. GA의 임의 event_id만으로 중복 제거를 기대하지 않는다.

보존 기간은 GA 이벤트/사용자 데이터 2개월을 초기 제안으로 두고 실제 속성 설정을 확인한다.
장기 코호트나 시즌 분석 필요성이 생기면 보존 기간을 다시 결정한다.
분석 동의 비율을 측정하려고 거부 사용자에게 분석 이벤트를 보내지 않는다.

## 7. 비용·운영과 구현 단계

GA 웹 태그로 직접 전송하며 분석 때문에 Workers 중계·D1 쓰기·세션 조회·추가 폴링을 만들지 않는다.
태그는 비동기로 로드하고 초기 번들·렌더링·INP 영향을 배포 전후 비교한다.
측정 ID가 없거나 운영 호스트가 아니면 기본 비활성이다. 개발/스테이징은 별도 테스트 속성을 사용한다.
운영자의 디버그 방문은 테스트 속성/명시적 개발 설정으로 분리하며 공개 URL 파라미터로 임의 디버그를 켜지 않는다.

1. 정의 확정: 이벤트·분모·관측 기간·동의/고지·보존 정책 확인.
2. 테스트 속성: 중앙 분석 어댑터, 정규화/허용값, 중복 억제, 5개 행동 이벤트 경로와 페이지뷰 구현.
3. 검증: DebugView·네트워크·기존 저장/복구 흐름·실제 테스트 커리어로 대조.
4. 운영 적용: 운영 속성과 호스트 제한, 보고서 구성, 수집 시작일 기록. 한 번에 태그 설치 경로 하나만 사용.
5. 첫 2주 점검 후 주간 보고: 채널별 시작, 진행 흐름, 반복 플레이. 수치 자체보다 다음 개선 결정을 기록.

[구단주 칭호 기획 PR #365](https://github.com/tasddc1226/offside-football-simulator/pull/365)와는
독립 도입한다. 퀘스트 선택/달성 이벤트는 기능 출시 뒤 추가하며 미구현 기능을 지금 측정하지 않는다.

## 8. 구현 시 수용 기준

- 생성 취소·후보 재뽑기·이어하기는 career_start 0회, 실제 생성은 1회.
- 첫 시즌 보고서 재열기·새로고침과 같은 은퇴 재조회·outbox 재시도는 완료 이벤트를 추가하지 않음.
- 기존 세이브 로드/소급 업로드는 과거 생성·종료를 재생하지 않음. 이후 실제 은퇴는 기존 커리어로 구분.
- 은퇴 후 새 생성, 현역 덮어쓰기, 상태 유실의 start_context를 각각 검증.
- 복사 실패는 click만 발생하고 성공 이벤트는 없음. 성공해도 실제 SNS 게시라고 표시하지 않음.
- 최초·내부 화면 전환의 page_view가 자동 수집과 중복되지 않음.
- 동의 전/거부/철회 후 Google 네트워크 요청 없음. 차단·타임아웃에도 플레이·저장·공유 정상.
- 네트워크 payload의 URL·제목·referrer·자동 이벤트에도 이름·토큰·개별 ID·자유 입력 없음.
- 다중 탭·리로드의 중복 억제를 시험하고 best-effort 한계를 문서화.
- 로컬/스테이징·헤드리스 시뮬레이션은 운영 속성으로 전송하지 않음. 추가 Workers/D1 요청 없음.
- 동일 시드/선택 결과와 기존 세이브 복구 유지. 번들 예산 및 관련 UI 테스트 통과.
- 테스트 이벤트 개수·순서·버전·UTM이 DebugView와 실제 보고서에 반영됨을 각각 확인.

## 9. 공식 참고 자료

확인일: 2026-09-28. 서비스 설정·정책은 구현 시 다시 확인한다.

- [Cloudflare 분석 종류](https://developers.cloudflare.com/analytics/types-of-analytics/)
- [GA4 사용자 정의 이벤트](https://support.google.com/analytics/answer/12229021)
- [GA4 퍼널 탐색](https://support.google.com/analytics/answer/9327974)
- [캠페인 URL/UTM](https://support.google.com/analytics/answer/10917952)
- [SPA 측정](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
- [수동 페이지뷰](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [PII 전송 방지](https://support.google.com/analytics/answer/6366371)
- [Consent Mode 개요](https://developers.google.com/tag-platform/security/concepts/consent-mode)

이번 PR은 문서만 추가한다. GA 계정·태그·동의 UI·DB·코드·운영 배포는 변경하지 않는다.
