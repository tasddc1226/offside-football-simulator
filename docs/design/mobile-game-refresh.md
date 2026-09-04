# 모바일 게임 화면 개편

작성일: 2026-09-05

기준: `main` 커밋 `27292d4`

작업 브랜치: `design/tds-game-screens`

## 목표와 범위

현재 구현된 OFFSIDE 화면을 넓은 설정 폼·관리 화면에서, 상황을 읽고 다음 행동을 선택하는 모바일 축구 커리어 게임으로 재구성한다. 새로운 게임 기능이나 후속 Phase 화면을 추가하는 작업은 아니다. 아래 변경은 작업 브랜치의 구현 기록이며 main 병합·배포 완료를 뜻하지 않는다.

| Before | After | Why |
|---|---|---|
| 데스크톱에서 넓어지는 폼과 다열 정보 | 화면 크기와 관계없이 최대 480px의 중앙 게임 프레임 | 읽기와 선택의 시선을 유지 |
| 페이지 제목과 입력·수치의 연속 | 축구 모티프 도입부 → 맥락 카드 → 핵심 정보 → 행동 | 지금 어떤 장면인지 먼저 전달 |
| 짧은 옵션도 큰 세로 칸으로 반복 | 성별·주발은 세그먼트, 포지션·스타일은 선택 카드 | 선택에 필요한 공간을 내용에 맞춤 |
| 본문·통계·비교가 같은 위계 | 표면·여백·제목 크기로 구분하고 보조 정보는 펼치기 | 핵심 선택까지의 스크롤 부담 감소 |
| 화면 아래 흩어지는 다음 행동 | 공통 하단 sticky 행동 영역 | 현재 선택과 확정 행동 연결 |

구현 정본은 [시각 디자인 시스템](../development/13-visual-design-system.md), [tokens.css](../../packages/ui/src/tokens.css), [game.css](../../packages/ui/src/game.css)다. 게임 명령·저장·화면 진입 규칙은 기존 개발 명세가 정본이다.

## 참고 자료와 사용 경계

사용자 제공 `TDS_Mobile_for_Apps_in_Toss_(2602-3-2).fig`를 로컬에서 읽어 실제 UI Kit의 구조를 확인했다. 편집 가능한 버튼·입력·상태·목록·하단 행동 영역 등이 포함된 자료였으며, 단순 미리보기 이미지에만 의존하지 않았다.

파일에 포함된 라이선스는 앱인토스용 개발·디자인·프로토타입으로 사용 범위를 제한하고, 다른 프로젝트 사용이나 구성요소의 재가공·재배포를 금지한다고 명시한다. 이는 제공된 문구를 확인한 내용이며 법률 자문이나 별도 이용 허가가 아니다. 앱인토스 배포 또는 키트 직접 사용을 결정할 때는 적용 범위와 권한을 별도로 확인한다.

이번 작업은 **독립 구현**이다.

- 정보 계층, 읽기 편한 목록, 명확한 선택 상태, 충분한 터치 영역 같은 일반적인 모바일 UX 원칙을 참고했다.
- TDS 패키지, `.fig` 원본, 추출된 컴포넌트·아이콘·이미지·폰트·토큰을 저장소와 앱에 넣지 않는다.
- 원본 자료는 수정하거나 외부 서비스에 업로드하지 않았다. 원본·추출 자산을 재배포하지 않는다.
- 강조색 `#225AC4`, 블루·슬레이트 표면, 축구공·유니폼·피치 SVG는 OFFSIDE 구현용으로 직접 작성했다. 기존 Pretendard를 유지하며 Toss Product Sans를 추가하지 않는다.
- 브랜치 이름에 `tds`가 포함되어 있어도 TDS 채택·호환성 인증·앱인토스 제출 승인을 의미하지 않는다.

## 공통 구현 기준

| 영역 | 실제 적용 |
|---|---|
| 화면 프레임 | `PageShell`: 최대 480px, 최소 높이 `100dvh`, 본문 좌우 16px |
| 공통 메뉴 | 허브·온보딩·설정의 홈/설정 링크, 본문 건너뛰기. 커리어 화면에서는 정적 로고로 바꿔 기존 저장·뒤로 이동 방어를 우회하지 않음 |
| 도입부 | `ScreenIntro`: 작은 맥락 라벨, h1, 선택적 설명, 장식용 피치 SVG |
| 표면 | `os-panel`: padding 20px / radius 20px; 상황 카드는 `os-story-card` |
| 본문 | Pretendard, 기본 16 / 24, 제목 26 / 34, 캡션 13 / 18; 숫자 tabular-nums |
| 글자 확대 | 기존 125%/150% 설정을 루트 글자 크기에 연결. 150%에서 선택·비교·수치 카드를 재배치하며, 설정값과 저장 형식은 변경하지 않음 |
| 입력·선택 | 입력 최소 높이 48px, 선택은 테두리·체크·문구로 구분, 오류 라벨과 접근성 속성 유지 |
| 행동 | `os-action-dock`: 본문 흐름 안의 sticky 영역, 주요 버튼 52px 이상, safe-bottom 반영 |
| 비교 | 게임 프레임에서는 세로 카드; CompareCards의 넓은 표는 컨테이너 640px 이상에서만 표시 |
| 테마 | 라이트·다크·시스템 유지; 히어로는 같은 진한 표면, 본문은 테마 토큰으로 전환 |
| 모션 | 반복 화면 전환에 새 연출 없음; 버튼 pointer 누름만 짧은 scale, 모션 감소 시 제거 |
| 작은 화면 | 359px 이하 선택 카드·선수 보조 정보는 1열; 긴 이름·문구 줄바꿈 |
| 다이얼로그 | 최대 높이 안에서 스크롤, 제목과 닫기 영역 분리, 기존 포커스·확정 흐름 유지 |

`position: sticky`는 항목 전체를 무조건 화면에 띄우는 고정 overlay가 아니다. 필드 검증·오류 메시지와 함께 문서 흐름에 남긴다. 모바일 가상 키보드와 실제 safe-area 동작은 실기기에서 추가 확인해야 한다.

## 화면 단위 적용 지도

화면 ID와 경로는 기존 [SCREEN_ROUTES](../../apps/web/src/routes.ts)를 유지한다. 관련 파일은 실제 구현 위치다.

| 화면 | 적용된 구성 | 유지한 기능·데이터 | 소스 |
|---|---|---|---|
| SCR-034 온보딩 | 단계 표시, 게임 도입부, 플레이 원칙 카드, 하단 다음 행동 | 온보딩 단계·서비스 시즌 안내·시작 처리 | [onboarding.tsx](../../apps/web/src/routes/onboarding.tsx) |
| SCR-001 허브 | 게임 시작 도입부, 빈 상태 안내, 커리어 카드 목록 | 새 커리어·기존 커리어 이어하기·저장 상태 | [index.tsx](../../apps/web/src/routes/index.tsx) |
| SCR-002 선수 생성 | 기본 정보 패널, 성별·주발 세그먼트, 포지션군 탭과 선택 카드, 배경 선택 | 이름·성별·국적·주발·선호 포지션·배경 입력과 검증 | [create](../../apps/web/src/routes/career.$careerId.create.tsx) |
| SCR-003 스타일 | 선수 맥락 요약, 아키타입 선택 카드, 확인 행동 | 포지션별 선택 가능 스타일와 설명 | [style](../../apps/web/src/routes/career.$careerId.style.tsx) |
| SCR-004 확정 | 선수 프로필 검토 카드, 핵심 확인 정보, KICKOFF·복구 코드 안내 | 선수 확정·저장·복구 코드 처리와 실패 안내 | [confirm](../../apps/web/src/routes/career.$careerId.confirm.tsx) |
| SCR-007 진로 | 스토리 중심 선택, 정찰 범위와 선택적 진로 비교 | 실제 정찰 범위, 모든 경로별 성장·출전·제안 정보 | [path](../../apps/web/src/routes/career.$careerId.path.tsx) |
| SCR-008 입단 테스트 | 테스트 도입부·상황·선택, 진행 중 축구 모티프와 단계 카드 | 확정 후 저장, 기존 3단계 연출, 건너뛰기·모션 감소 | [tryout](../../apps/web/src/routes/career.$careerId.tryout.tsx) |
| SCR-013 이벤트 | 상황 카드, 선수 상태 펼치기, 위험·효과가 있는 선택 카드, 확정 | 선택 미리보기·단일 확정·중복 제출 방지·기존 콘텐츠 | [event](../../apps/web/src/routes/career.$careerId.event.tsx), [공통 본문](../../apps/web/src/shared/event-screen.tsx) |
| SCR-014 선택 결과 | 결과 도입부·등급·서사·효과·원인 태그, 하단 다음 | revision 기반 결과 복원, 재굴림 방지, 다음 이동 오류 처리 | [event result](../../apps/web/src/routes/career.$careerId.event_.result.tsx) |
| SCR-009 제안 | 팀·리그·등번호 헤더, 주급·기간·역할·적합도 요약, 추가 조건 펼치기 | 제안 목록·특징 판정·계약금·계약 검토 이동 | [offers](../../apps/web/src/routes/career.$careerId.offers.tsx) |
| SCR-010 계약 | 계약 조건·구단 약속·선수 서명 카드, 뒤로·사인 행동 | 제안 ID 검증·서명 명령·중복 처리 방지·계약 후 이동 | [contract](../../apps/web/src/routes/career.$careerId.contract.tsx) |
| SCR-005 프리시즌 | 모드와 훈련 계획을 분리한 선택 패널 | FAST/CHAPTER와 기존 훈련 값·선택 유지 | [preseason](../../apps/web/src/routes/career.$careerId.preseason.tsx) |
| SCR-011 시즌 준비 | 현재 조건·선택한 계획·예상 적용 시점을 분리한 검토 카드 | 시즌 시작 명령·즉시 효과와 결산 효과 구분 | [season prep](../../apps/web/src/routes/career.$careerId.season-prep.tsx) |
| SCR-012 역할 제안 | 감독의 맥락·제안 조건·예상 변화, 확인 또는 수락·거절 | KEEP·포지션·역할 제안별 기존 분기 | [role](../../apps/web/src/routes/career.$careerId.role.tsx) |
| SCR-029 대시보드 | 선수 카드·핵심 상태·지금 할 일을 우선, 일정표/라커룸/전술실/휴대폰/다이어리 탭 | pending 우선 이동·일정·관계·전술·계약·타임라인 데이터 | [career dashboard](../../apps/web/src/routes/career.$careerId.index.tsx) |
| SCR-033 능력치 | 선수 능력 요약과 세부 그룹·아키타입 비교 패널 | OVR/예상 퍼포먼스 구분, 기존 능력치·가중치 설명 | [attributes](../../apps/web/src/routes/career.$careerId.attributes.tsx) |
| SCR-031 경기 챕터 | 경기 도입부, 경기 맥락·상황 카드, 선택·결과 행동 | 진행 중 판단·단계 전환·저장된 결과 복원 | [chapter](../../apps/web/src/routes/career.$careerId.chapter.tsx) |
| SCR-015 시즌 결산 | 핵심 수치 2열 카드, 대회·포지션·약속·성장·비교 섹션 | 출전 집계·대회 결과·기존 비교·카운트업/건너뛰기·다음 이동 | [season result](../../apps/web/src/routes/career.$careerId.season-result.tsx) |
| SCR-030 설정 | 설정 도입부, 테마·글자·모션·모드·데이터 영역별 카드 | 동기화·복구·연결·삭제 확인·기존 접근성 설정 | [settings](../../apps/web/src/routes/settings.tsx) |
| 공통 셸·오류·모달 | 중앙 프레임·게임 메뉴·통일 표면과 버튼, 다이얼로그 스크롤 | 라우팅·로딩·빈 상태·오류 재시도·포커스 처리 | [root](../../apps/web/src/routes/__root.tsx), [PageShell](../../packages/ui/src/components/PageShell.tsx), [Dialog](../../packages/ui/src/components/Dialog.tsx) |

## 변경하지 않는 계약

- 도메인·API·DB 스키마·명령 payload·seed·능력치 계산·OVR·콘텐츠 팩을 변경하지 않는다.
- 선택을 누르는 것과 확정하는 것을 분리한다. 스타일·레이아웃 변경으로 선택 결과를 다시 계산하지 않는다.
- 정찰 범위·출전 수·계약 조건·시즌 결과는 기존 view와 상태에서 읽는다. 보기 쉬운 숫자를 임의로 만들거나 바꾸지 않는다.
- 저장 중 중복 제출·뒤로 이동, 오류 후 재시도, route loader의 redirect와 과거 결과 복원을 유지한다.
- 기존 플레이 데이터·설정·동기화·복구 코드를 초기화하지 않는다.
- KICKOFF / FULL TIME / THE LINE HAS MOVED의 브랜드 어휘와 오프사이드 라인의 세 사용 시점은 기존 계약을 유지한다. 장식 피치 도형은 오프사이드 라인 애니메이션을 대체하거나 호출하지 않는다.

## 이번 범위 밖

향후 Phase 5 이후 기능, 아직 없는 이적시장·임대 복귀 전용 화면, 은퇴·엔딩·아카이브·Legacy 상세·공유 카드·랭킹·구단 운영·해외 리그 화면을 새로 만든 것으로 보지 않는다. 관련 데이터나 기반 구조가 있더라도 전용 화면 구현·동작 검증과는 별개다.

앱인토스 SDK 추가, 콘솔 등록, TDS 라이브러리 채택, 운영 배포 설정, 라이선스 허가 취득도 이번 화면 개편에 포함하지 않는다. 기존에 열려 있던 게임 로직 이슈가 시각 개편만으로 해결되었다고 주장하지 않는다.

## 검증·인수 기준

완료 수치는 실제 실행 결과만 기록한다. 아래는 확인해야 할 범위이며 전체 통과를 미리 의미하지 않는다.

- 기존 웹·UI 단위 테스트와 화면 전환 테스트: 라벨·선택·데이터 의미 유지.
- 브라우저 흐름: 온보딩 → 선수 생성 → 이벤트 → 제안 → 계약 → 프리시즌 → 경기/결산.
- 라이트·다크·시스템, 모션 감소, 글자 확대와 360px/데스크톱에서 콘텐츠·터치 영역·하단 CTA 확인.
- 제안·진로·선수 상태의 접기 동작으로 데이터가 없어지지 않는지 확인.
- 이름·팀명·서사·선택지가 길 때 넘침·겹침·가로 스크롤 확인.
- 키보드 순서, focus-visible, 본문 건너뛰기, radio 선택 상태, 결과 aria-live, 다이얼로그 닫기·포커스 복귀 확인.
- `.fig`나 Toss 자산·폰트·토큰이 저장소 또는 번들에 추가되지 않았는지 확인.
- 캡처와 결과에는 확인한 화면·테마·viewport·테스트 조건을 명시하고 미검증 상태를 구분한다.

### 통합 QA 결과 — 2026-09-05

| 검사 | 실제 결과 |
|---|---|
| 웹 단위·통합 테스트 | 39개 파일 / 352개 통과 |
| 공통 UI 테스트 | 15개 파일 / 46개 통과 |
| 브라우저 전체 기본 suite | 85개 통과 / 6개 조건부 제외: 실제 API 인증·복구·서비스 시즌/분석 환경 및 preview 성능 모드 전용 |
| 신규 화면 회귀 검사 | 위 85개 중 9개. 320/360px·1440px, 실제 150% 글자 크기, 라이트/다크, 선택 키보드·크기 안정성, 다이얼로그 Escape/포커스, 결산 프레임 |
| 정적 검사 | 저장소 typecheck·lint, git diff --check 통과 |
| 프로덕션 웹 빌드 | 성공. 번들 검사 정의의 초기 JS 합계 99.19KB gzip / 예산 300KB; lazy chunk를 포함한 앱 전체 크기라는 뜻은 아님 |
| 색 대비 | 라이트/다크 30개 조합 통과. 텍스트 4.5:1, 비텍스트 3:1 기준 |
| 수동 브라우저 확인 | 독립 로컬 API의 새 커리어 저장됨, 라이트/다크 화면, 생성 화면·대표 자동 캡처 확인 |

브라우저 검사에는 온보딩부터 첫 계약, FAST/CHAPTER 시즌, 결산·다음 시즌, forced injury 이벤트, 저장 재시도·결과 hash 회귀가 포함된다. 실제 휴대폰 가상 키보드·OS safe-area, 실계정 Google 인증, 원격 배포는 검증하지 않았다. 엔진·API·콘텐츠·계약 스키마·배포 workflow의 diff는 없다.

실행 명령: `pnpm --filter @offside/web test`, `pnpm --filter @offside/ui test`, `E2E_PORT=5213 pnpm --filter @offside/web e2e --workers=2`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @offside/web build`, `pnpm --filter @offside/web check:bundle`, `pnpm --filter @offside/ui check:contrast`. Node 22를 사용했다. 중간 실패는 제목 레벨·카드 개수 assertion을 새 구조에 맞게 수정한 뒤 전체 suite를 재실행했으며, 위 결과는 최종 실행 기준이다.

### 대표 화면 캡처

`mobile-refresh.spec.ts`의 격리된 Playwright 컨텍스트에서 실제 UI를 캡처했다. 이미지 안의 선수·경기 데이터는 테스트 플레이이며, API를 의도적으로 503으로 처리하는 fixture의 "저장 다시 시도 중" 표시는 운영 저장 장애를 뜻하지 않는다. 별도 로컬 API를 연결한 수동 미리보기에서는 "저장됨"을 확인했다. 긴 페이지 캡처의 sticky CTA는 촬영 당시 viewport 위치에 나타난다.

| 화면 | 조건 | 캡처 |
|---|---|---|
| 선수 생성 | 360px, 라이트, 100% 글자 | [PNG](screens/mobile-refresh/create-light-360.png) |
| 계약 뒤 대시보드 | 360px, 라이트, 100% 글자 | [PNG](screens/mobile-refresh/dashboard-light-360.png) |
| 시즌 결산 | 360px, 라이트, 100% 글자 | [PNG](screens/mobile-refresh/season-result-light-360.png) |
| 허브 삭제 확인 | 360px, 다크, 확인창만 열고 삭제하지 않음 | [PNG](screens/mobile-refresh/hub-dark-dialog.png) |

### 독립 로컬 미리보기

기존 `localhost:5173` 플레이와 쿠키·IndexedDB가 겹치지 않도록 웹/API 모두 `127.0.0.1`의 별도 포트를 쓴다. 별도 작업 복제본에서 실행했으므로 로컬 D1도 기존 작업 폴더와 분리된다. 원격 D1이나 배포 설정은 변경하지 않는다.

첫 준비는 `pnpm install --frozen-lockfile`, `pnpm --filter @offside/api db:migrate`, `pnpm --filter @offside/api db:seed`다. Node 22를 사용한다. 이후 서로 다른 터미널에서 실행한다.

```sh
pnpm --filter @offside/api exec wrangler dev --ip 127.0.0.1 --port 8789 --var ALLOWED_ORIGINS:http://127.0.0.1:5182 --var WEB_APP_URL:http://127.0.0.1:5182 --var GOOGLE_REDIRECT_URI:http://127.0.0.1:8789/v1/auth/google/callback
```

```sh
VITE_API_BASE_URL=http://127.0.0.1:8789 pnpm --filter @offside/web exec vite --host 127.0.0.1 --port 5182 --strictPort
```

미리보기 주소: `http://127.0.0.1:5182/`. 기존 사용자의 설정을 바꾸지 않고 이 미리보기에서만 라이트 테마를 선택했다.
