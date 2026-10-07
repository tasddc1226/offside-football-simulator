# 스토어 등록 정보 (앱 1.1.1, T-11-119)

2026-10-06 1.1.1 심사 준비로 쓴 App Store Connect·Google Play 등록 문구다. 한국어(ko)와 영어(en-US) 두 벌이다.
콘솔 입력·스크린샷 업로드·심사 제출은 이 문서로 하지 않는다. 사용자나 오케스트레이터가 콘솔에서 따로 하고, 한 일은 PR·보드에 남긴다.

글자 수는 `node`로 센 값이다(`[...s].length`, 괄호 안은 UTF-8 바이트). 문구를 고치면 다시 센다.

## 1. 개요

1.1.1에서 바뀌는 것:

- 안드로이드 알림 아이콘을 v7 로고(흰 OFF + 오프사이드 라인)로 바꿨다. 지금까지는 전용 아이콘이 없어 앱 아이콘으로 대체됐다. iOS 알림은 앱 아이콘(v7)을 그대로 쓴다.
- 앱 이름이 기기 언어를 따른다. 한국어 기기는 "오프사이드", 그 밖의 언어는 "OFFSIDE".
- 화면·게임 문구 영어 지원(T-11-102·T-11-106, OTA로 이미 나감). 사진 접근 권한 문구도 한국어·영어 두 벌이 됐다.

콘솔에서 고칠 곳:

| 콘솔                | 항목                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App Store Connect   | 이름·부제(앱 정보, 현지화 en-US 추가), 프로모션 텍스트·설명·키워드·이 버전의 새로운 기능·스크린샷(1.1.1 버전 페이지, ko·en-US) |
| Google Play Console | 기본 스토어 등록정보(앱 이름·간단한 설명·자세한 설명·스크린샷·그래픽 이미지)와 en-US 번역, 1.1.1 출시 노트(ko-KR·en-US)        |

## 2. App Store Connect

### 한국어 (ko)

- 이름 (16자/30): `오프사이드: 축구 선수 커리어`
- 부제 (20자/30): `고3부터 은퇴까지, 한 선수로 살아요`
- 프로모션 텍스트 (85자/170):

  ```
  시즌 1이 열렸어요. 고교 3학년 선수로 시작해 프로 입단, 해외 이적, 국가대표를 거쳐 은퇴까지 가요. 이번 업데이트부터 영어로도 플레이할 수 있어요.
  ```

- 키워드 (57자/100, 145바이트): `축구게임,풋볼,시뮬레이션,선수키우기,육성,K리그,국가대표,이적,은퇴,명예의전당,텍스트게임,스포츠,해외파`
  App Store Connect가 바이트로 세어 넘친다고 하면 뒤(`해외파`, `스포츠`, `텍스트게임` …)부터 뺀다.
- 설명: 아래 [한국어 설명](#한국어-설명)
- 이 버전의 새로운 기능:

  ```
  - 영어로도 플레이할 수 있어요. 기기 언어가 한국어가 아니면 영어로 시작하고, 설정에서 바꿀 수 있어요.
  - 내 선수가 도트 아바타로 나와요. 커리어 화면, 은퇴 리포트, 명예의 전당 시상대에서 볼 수 있어요.
  - 홈에서 구단 가치 TOP 3를 볼 수 있고, 팀 랭킹을 구단 가치 순으로 정렬할 수 있어요.
  - 한국어가 아닌 기기에서는 앱 이름이 OFFSIDE로 보여요.
  - 알림과 사진 권한 안내가 기기 언어에 맞게 나와요.
  ```

### 영어 (en-US)

- Name (28/30): `OFFSIDE: Football Career Sim`
- Subtitle (30/30): `From high school to retirement`
- Promotional Text (154/170):

  ```
  Season 1 is live. Start as a high school player, turn pro, move abroad, play for your country and retire as a legend. OFFSIDE is now available in English.
  ```

- Keywords (99/100): `soccer,simulator,rpg,story,choices,transfer,national team,legend,retire,hall of fame,sports,manager`
- Description: [English description](#english-description)
- What's New in This Version:

  ```
  - OFFSIDE is now available in English. It starts in English when your device language isn't Korean, and you can switch languages in Settings.
  - Your player now appears as a pixel avatar on the career screen, the retirement report and the Hall of Fame podium.
  - Home now shows the top 3 clubs by value, and team rankings can be sorted by club value.
  - The app name shows as OFFSIDE outside Korean.
  - Notification and photo permission prompts follow your device language.
  ```

## 3. Google Play

### 한국어 (ko-KR)

- 앱 이름 (16자/30): `오프사이드: 축구 선수 커리어`
- 간단한 설명 (45자/80): `고3부터 은퇴까지, 훈련·이적·이벤트 선택으로 한 축구 선수의 커리어를 만들어요.`
- 자세한 설명: [한국어 설명](#한국어-설명)과 같다.
- 출시 노트 (1.1.1):

  ```
  - 영어로도 플레이할 수 있어요. 설정에서 언어를 바꿀 수 있어요.
  - 내 선수가 도트 아바타로 나와요. 은퇴 리포트와 명예의 전당에도 나와요.
  - 알림 아이콘을 새 로고로 바꿨어요.
  - 한국어가 아닌 기기에서는 앱 이름이 OFFSIDE로 보여요.
  ```

### 영어 (en-US)

- App name (28/30): `OFFSIDE: Football Career Sim`
- Short description (79/80): `Build one footballer’s career from high school to retirement, choice by choice.`
- Full description: [English description](#english-description)과 같다.
- Release notes (1.1.1):

  ```
  - OFFSIDE is now available in English. Switch languages in Settings.
  - Your player now appears as a pixel avatar, including in the Hall of Fame.
  - Notifications now use the new OFFSIDE logo.
  - The app name shows as OFFSIDE outside Korean.
  ```

## 설명 본문

### 한국어 설명

```
이번 생은 축구다.
고교 3학년 선수로 시작해 은퇴할 때까지, 한 선수의 커리어를 직접 만드는 축구 선수 커리어 시뮬레이션이에요. 매 시즌 고른 훈련과 이벤트 선택이 쌓여 선수의 이야기가 돼요.

■ 선수 만들기
이름, 등번호, 국적, 포지션과 세부 포지션, 주발, 주력 능력치, 성장 특성을 정하면 능력치 총합이 같은 후보 3명이 나와요. 그중 한 명으로 고교 3학년 시즌을 시작해요. 잠재력은 은퇴할 때 공개돼요.

■ 시즌 진행과 성장
한 시즌은 프리시즌, 전반기, 후반기로 나뉘어요. 구간마다 훈련 방향과 자기 투자를 고르면 경기 결과와 출전·골·도움·평점이 기록돼요. 첫 시즌을 마친 뒤부터는 자금으로 잠재력 강화에 도전할 수 있어요.

■ 확률 이벤트와 경기 장면
구간마다 이벤트가 나오고, 선택지마다 실제 성공 확률이 보여요. 페널티킥·1대1·승부차기는 타이밍 게이지로 판정해요. 여러 시즌에 걸쳐 이어지는 스토리도 있어요.

■ 이적, 해외 진출, 국가대표
고교 시즌이 끝나면 프로 입단이나 대학 진학을 정하고, 시즌이 끝날 때마다 잔류·재계약·이적 중에서 골라요. 성적이 좋으면 일본, 미국, 유럽 리그에서도 제의가 와요. 대표팀에 뽑히면 월드컵·올림픽·아시안게임 같은 국제 대회에 나가고, 대한민국 선수는 병역도 거쳐요.

■ 은퇴와 명예의 전당
은퇴하면 통산 기록·트로피·수상으로 레전드 점수와 등급이 매겨지고 잠재력이 공개돼요. 만 30세 이상에 은퇴한 선수는 명예의 전당에 올라요. 한 구단에서 레전드급으로 활약하면 등번호가 영구결번될 수 있어요.

■ 구단주 팀
로그인하면 구단주가 되어 은퇴한 내 선수와 이적시장에서 영입한 선수로 11명을 편성해요. 다른 구단주 팀과 경기하고, 친구와 친선전도 치를 수 있어요.

■ 한국어·영어
설정에서 언어를 바꿀 수 있어요.

진행 상황은 이 기기에 저장돼요. 환경설정에서 백업 코드나 파일을 내보내면 다른 기기에서 이어 할 수 있어요.
문의: contact@offside-lab.com
```

### English description

```
Live one football life, from high school to retirement.
OFFSIDE is a football (soccer) player career simulation. Start as a final-year high school player in Korea and build one player's whole career through training, transfers and the choices you make in each event.

■ Create your player
Pick a name, shirt number, nationality, position and role, preferred foot, key attributes and growth type. You get three candidates with the same total rating. Choose one and kick off your final high school season. Potential stays hidden until you retire.

■ Seasons and growth
Each season runs in three parts: preseason, first half and second half. Choose your training focus and self-investment, and the matches play out with appearances, goals, assists, ratings and league tables recorded. After your first season you can spend funds to try boosting your potential.

■ Odds-based events and match moments
Events pop up as the season goes on, and every option shows its real success chance. Penalties, one-on-ones and shootouts are decided with a timing gauge. Some stories carry on across several seasons.

■ Transfers, moving abroad, national team
After high school, turn pro or go to university. At the end of each season, stay, re-sign or move. Play well and offers arrive from Japan, the US and Europe's top leagues. Get called up and play in the World Cup, the Olympics and other international tournaments. Korean players also have to handle military service.

■ Retirement and the Hall of Fame
When you retire, your career totals, trophies and awards earn a legend score and grade, and your potential is revealed. Players who retire at 30 or older enter the public Hall of Fame. Become a club legend and your shirt number may be retired.

■ Owner team
Sign in to become a club owner. Build an XI from your retired players and players bought on the transfer market, take on other owners' teams and play friendlies with friends.

■ English and Korean
Switch languages in Settings.

Your progress is saved on this device. Export a backup code or file in Settings to continue on another device.
Contact: contact@offside-lab.com
```

## 4. 스크린샷 문구 (7장)

순서대로 쓴다. 제목은 크게, 부제는 한 줄로 작게. 이미지는 `apps/mobile/store/`(문구 `frames.json`, 렌더러·촬영 방법은 그 README)로 만든다.
App Store는 6.9"(1320×2868), Google Play는 휴대전화(1080×2160)와 그래픽 이미지(1024×500, 1번 문구)를 올린다.

| #   | 장면                | 한국어 제목                 | 한국어 부제                              | English headline              | English sub                                  |
| --- | ------------------- | --------------------------- | ---------------------------------------- | ----------------------------- | -------------------------------------------- |
| 1   | 홈·진행 중 커리어   | 이번 생은 축구다            | 고3부터 은퇴까지, 한 선수로 살아요       | One player. One whole career. | From high school to retirement               |
| 2   | 선수 생성           | 나만의 선수를 직접 만들어요 | 국적·체격·포지션·성장 특성까지 정해요    | Build your own player         | Nation, build, position and growth type      |
| 3   | 1대1 타이밍 게이지  | 결정적인 순간은 내 손으로   | 1대1·페널티킥은 타이밍 게이지로 판정해요 | Big moments, your timing      | One-on-ones and penalties use a timing gauge |
| 4   | 선수 능력치 레이더  | 시즌마다 자라는 내 선수     | 훈련과 자기 투자로 능력치를 키워요       | Grow every season             | Train and invest to build attributes         |
| 5   | 시즌 리뷰·월드컵    | 모든 시즌이 기록으로 남아요 | 골·도움·평점부터 월드컵까지              | Every season on the record    | Goals, ratings, awards and World Cups        |
| 6   | 이적 시장·해외 제의 | 해외 이적, 국가대표까지     | 일본·미국·유럽 리그에서 제의가 와요      | Transfers abroad, World Cups  | Offers from Japan, the US and Europe         |
| 7   | 은퇴·레전드 리포트  | 은퇴하면 명예의 전당에      | 레전드 점수와 잠재력이 공개돼요          | Retire into the Hall of Fame  | Legend score and potential revealed          |

## 5. 체크리스트

- 카테고리(게임 > 스포츠·시뮬레이션)와 연령 등급 설문은 1.1.0과 같다. 바꿀 내용 없음.
- 개인정보처리방침 `https://offside-lab.com/legal/privacy/`, 지원 URL·문의 `contact@offside-lab.com`은 그대로 둔다. en-US 현지화에도 같은 주소를 넣는다.
- 실제 리그·대회 로고나 구단 엠블럼이 스크린샷에 나오지 않게 한다. 설명에서도 특정 리그 상표를 제목·키워드로 쓰지 않는다.
- 평점·다운로드 수·순위 같은 수치는 넣지 않는다.
- 스토어 문구를 바꾸면 웹 공개 가이드·FAQ와 사실이 어긋나지 않는지 본다(`apps/web/scripts/seo.mjs`).

## 6. 심사 재개 전 확인 (main 반영 기록)

1.1.1 심사는 보류 중이다(1.1.0 패치 진행). 그 사이 main 변경을 이 브랜치에 합치고 아래에 남긴다.

| main 커밋                                                      | 1.1.1 영향                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| #527 후보 잠재력·은퇴 25세                                     | 선수 생성 화면(2번)에 후보 잠재력 범위 광고 버튼. 문구 변경 없음                                                        |
| #528 도트 아바타                                               | 커리어 화면 상단 아바타. 새 기능 문구에 넣음. 게임 화면 머리(3·4번, 5·6번 시트 뒤)가 아바타 전 화면이라 **재촬영 필요** |
| #530 포지션별 OVR 안내                                         | 선수 생성·훈련 화면에 포지션별 OVR 설명. 2번 스크린샷(선수 생성) **재촬영 필요**                                        |
| #532 영어 화면 표시 수정                                       | 1.1.0 OTA로 먼저 나감. 이 브랜치의 같은 수정과 합쳐짐                                                                   |
| #531 은퇴식 도트 선수                                          | 은퇴 리포트(7번)에 도트 선수. 새 기능 문구에 반영. 7번 스크린샷 **재촬영 필요**                                         |
| #533 명예의 전당 시상대 도트                                   | 명예의 전당 화면(스크린샷 없음). 새 기능 문구에 반영                                                                    |
| #534 영구결번 탭 시즌별 명예의 벽                              | 기록실 화면(스크린샷 없음). 작은 기능이라 새 기능 문구에는 넣지 않음                                                    |
| #537 첫 화면 번들 정리                                         | 화면 변화 없음                                                                                                          |
| #538 홈 구단 가치 TOP 3·팀 랭킹 정렬                           | 홈(1번) 화면에 새 섹션. App Store 새 기능 문구에 넣음. 1번 스크린샷 **재촬영 필요**                                     |
| #536 장기근속 업적·원클럽맨 상무 예외                          | 업적 추가(스크린샷 없음). 새 기능 문구에는 넣지 않음                                                                    |
| #542 홈 더보기·응원 카드, 설정 앱 버전, 명예의 전당 다듬기     | 홈(1번) 화면 변경, 위 재촬영에 포함. 영어 문구 함께 들어옴                                                              |
| #543 영구결번 유니폼 도트 액자                                 | 은퇴 화면 영구결번 표시·공유 카드 변경. 7번은 이미 재촬영 대상                                                          |
| #539 구단주 시즌 결산·등급·기록 배지                           | 구단주 화면(스크린샷 없음). 새 기능 문구에는 넣지 않음. 영어 문구 함께 들어옴                                           |
| #545 보상형 광고 불러오기 실패 안내·잠재력 강화 광고 하루 20번 | 광고 동작 변경(스크린샷 없음, 네이티브 변경 없음). 새 기능 문구에는 넣지 않음. 영어 문구 함께 들어옴                    |
