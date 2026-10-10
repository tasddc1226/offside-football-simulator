# 스토어 등록 정보 (앱 1.1.1, T-11-119)

2026-10-06 1.1.1 심사 준비로 쓴 App Store Connect·Google Play 등록 문구다. 한국어(ko)·영어(en-US·en-GB)·일본어(ja)다. en-GB는 en-US와 같고 이름·키워드의 soccer/football만 바꾼다(아래 2·3절).
콘솔 입력·스크린샷 업로드·심사 제출은 이 문서로 하지 않는다. 사용자나 오케스트레이터가 콘솔에서 따로 하고, 한 일은 PR·보드에 남긴다.

글자 수는 `node`로 센 값이다(`[...s].length`, 괄호 안은 UTF-8 바이트). 문구를 고치면 다시 센다.

## 1. 개요

1.1.1에서 바뀌는 것:

- 안드로이드 알림 아이콘을 v7 로고(흰 OFF + 오프사이드 라인)로 바꿨다. 지금까지는 전용 아이콘이 없어 앱 아이콘으로 대체됐다. iOS 알림은 앱 아이콘(v7)을 그대로 쓴다.
- 앱 이름이 기기 언어를 따른다. 한국어 기기는 "오프사이드", 그 밖의 언어(영어·일본어 포함)는 "OFFSIDE".
- 화면·게임 문구 영어 지원(T-11-102·T-11-106, OTA로 이미 나감)과 일본어 지원(T-11-140, OTA·웹으로 먼저 나간다). 사진·추적 권한 문구도 한국어·영어·일본어 세 벌이 됐다(`apps/mobile/locales/`).

콘솔에서 고칠 곳:

| 콘솔                | 항목                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| App Store Connect   | 이름·부제(앱 정보, 현지화 en-US·en-GB·ja 추가), 프로모션 텍스트·설명·키워드·이 버전의 새로운 기능·스크린샷(1.1.1 버전 페이지, ko·en-US·en-GB·ja) |
| Google Play Console | 기본 스토어 등록정보(앱 이름·간단한 설명·자세한 설명·스크린샷·그래픽 이미지)와 en-US·en-GB·ja-JP 번역, 1.1.1 출시 노트(ko-KR·en-US·en-GB·ja-JP)  |

## 2. App Store Connect

### 한국어 (ko)

- 이름 (16자/30): `오프사이드: 축구 선수 커리어`
- 부제 (20자/30): `고3부터 은퇴까지, 한 선수로 살아요`
- 프로모션 텍스트 (90자/170):

  ```
  시즌 1이 열렸어요. 고교 3학년 선수로 시작해 프로 입단, 해외 이적, 국가대표를 거쳐 은퇴까지 가요. 이번 업데이트부터 영어와 일본어로도 플레이할 수 있어요.
  ```

- 키워드 (57자/100, 145바이트): `축구게임,풋볼,시뮬레이션,선수키우기,육성,K리그,국가대표,이적,은퇴,명예의전당,텍스트게임,스포츠,해외파`
  App Store Connect가 바이트로 세어 넘친다고 하면 뒤(`해외파`, `스포츠`, `텍스트게임` …)부터 뺀다.
- 설명: 아래 [한국어 설명](#한국어-설명)
- 이 버전의 새로운 기능:

  ```
  - 영어와 일본어로도 플레이할 수 있어요. 기기 언어를 따라 시작하고, 설정에서 바꿀 수 있어요.
  - 공지와 릴리즈 노트를 영어·일본어로 볼 수 있고, 댓글과 채팅은 내 언어로 번역해 볼 수 있어요.
  - 내 선수가 도트 아바타로 나와요. 커리어 화면, 은퇴 리포트, 명예의 전당 시상대에서 볼 수 있어요.
  - 홈에서 구단 가치 TOP 3를 볼 수 있고, 팀 랭킹을 구단 가치 순으로 정렬할 수 있어요.
  - 확률 도감에서 잠재력·강화 확률과 밸런스 변경 이력을 볼 수 있어요.
  - 한국어가 아닌 기기에서는 앱 이름이 OFFSIDE로 보여요.
  - 알림과 사진 권한 안내가 기기 언어에 맞게 나와요.
  ```

### 영어 (en-US)

- Name (26/30): `OFFSIDE: Soccer Career Sim`
- Subtitle (30/30): `From high school to retirement`
- Promotional Text (159/170):

  ```
  Season 1 is live. Pick any nationality, start in high school, turn pro, move abroad, play for your country and retire as a legend. Now in English and Japanese.
  ```

- Keywords (99/100): `football,simulator,life,rpg,story,choices,transfer,national team,legend,retire,hall of fame,manager`
  이름에 있는 단어(offside·soccer·career·sim)는 키워드에 다시 넣지 않는다. 미국 스토어 검색은 soccer가 기본이라 이름에 넣고, football은 키워드로 받는다.
- Description: [English description](#english-description)
- What's New in This Version:

  ```
  - OFFSIDE is now available in English and Japanese. It follows your device language, and you can switch languages in Settings.
  - Notices and release notes are now in English and Japanese, and you can translate comments and chat into your language.
  - Your player now appears as a pixel avatar on the career screen, the retirement report and the Hall of Fame podium.
  - Home now shows the top 3 clubs by value, and team rankings can be sorted by club value.
  - The odds guide now shows potential and boost odds and the balance change history.
  - The app name shows as OFFSIDE outside Korean.
  - Notification and photo permission prompts follow your device language.
  ```

### 영어 (en-GB)

영국·호주 등 영어권 스토어용. en-US와 같고 아래만 다르다.

- Name (28/30): `OFFSIDE: Football Career Sim`
- Keywords (97/100): `soccer,simulator,life,rpg,story,choices,transfer,national team,legend,retire,hall of fame,manager`

### 일본어 (ja)

- 名前 (19자/30): `OFFSIDE: サッカー選手キャリア`
- サブタイトル (20자/30): `高校3年から引退まで、ひとりの選手として`
- プロモーションテキスト (70자/170):

  ```
  シーズン1開幕。好きな国籍を選び、韓国の高校3年生から始めて、プロ入り、海外移籍、代表入りを経て引退まで。日本語でも遊べるようになりました。
  ```

- キーワード (38자/100, 90바이트): `育成,シミュレーション,人生,移籍,代表,引退,殿堂,スポーツ,RPG,物語`
  이름에 있는 サッカー·選手·キャリア는 다시 넣지 않는다. 일본어는 글자당 3바이트라 100바이트 안에 맞춘다. 리그 상표(Kリーグ)는 넣지 않는다(5절).
- 説明: 아래 [日本語の説明](#日本語の説明)
- このバージョンの新機能:

  ```
  - 日本語と英語でも遊べるようになりました。端末の言語に合わせて始まり、設定で切り替えられます。
  - お知らせとリリースノートを日本語と英語で読めるようになり、コメントとチャットは自分の言語に翻訳できます。
  - 自分の選手がドット絵のアバターで登場します。キャリア画面、引退レポート、殿堂の表彰台で見られます。
  - ホームでクラブ価値TOP 3を見られるようになり、チームランキングをクラブ価値順に並べ替えられます。
  - 確率図鑑でポテンシャル・強化の確率とバランス変更履歴を見られます。
  - 韓国語以外の端末ではアプリ名がOFFSIDEと表示されます。
  - 通知と写真の権限の案内が端末の言語で表示されます。
  ```

## 3. Google Play

### 한국어 (ko-KR)

- 앱 이름 (16자/30): `오프사이드: 축구 선수 커리어`
- 간단한 설명 (45자/80): `고3부터 은퇴까지, 훈련·이적·이벤트 선택으로 한 축구 선수의 커리어를 만들어요.`
- 자세한 설명: [한국어 설명](#한국어-설명)과 같다.
- 출시 노트 (1.1.1):

  ```
  - 영어와 일본어로도 플레이할 수 있어요. 설정에서 언어를 바꿀 수 있어요.
  - 댓글과 채팅을 내 언어로 번역해 볼 수 있어요.
  - 내 선수가 도트 아바타로 나와요. 은퇴 리포트와 명예의 전당에도 나와요.
  - 확률 도감에서 잠재력·강화 확률과 밸런스 변경 이력을 볼 수 있어요.
  - 알림 아이콘을 새 로고로 바꿨어요.
  - 한국어가 아닌 기기에서는 앱 이름이 OFFSIDE로 보여요.
  ```

### 영어 (en-US)

- App name (26/30): `OFFSIDE: Soccer Career Sim`
- Short description (80/80): `Build a soccer player’s career from high school to retirement, choice by choice.`
- Full description: [English description](#english-description)과 같다.
- Release notes (1.1.1):

  ```
  - OFFSIDE is now available in English and Japanese. Switch languages in Settings.
  - Translate comments and chat into your language.
  - Your player now appears as a pixel avatar, including in the Hall of Fame.
  - The odds guide now shows potential and boost odds and balance history.
  - Notifications now use the new OFFSIDE logo.
  - The app name shows as OFFSIDE outside Korean.
  ```

### 영어 (en-GB)

en-US와 같고 아래만 다르다.

- App name (28/30): `OFFSIDE: Football Career Sim`
- Short description (79/80): `Build one footballer’s career from high school to retirement, choice by choice.`

### 일본어 (ja-JP)

- アプリ名 (19자/30): `OFFSIDE: サッカー選手キャリア`
- 簡単な説明 (51자/80): `高校3年から引退まで、トレーニングと移籍、イベントの選択でひとりのサッカー選手のキャリアをつくります。`
- 詳しい説明: [日本語の説明](#日本語の説明)과 같다.
- リリースノート (1.1.1):

  ```
  - 日本語と英語でも遊べるようになりました。設定で言語を切り替えられます。
  - コメントとチャットを自分の言語に翻訳できます。
  - 自分の選手がドット絵のアバターで登場します。殿堂にも登場します。
  - 確率図鑑でポテンシャル・強化の確率とバランス変更履歴を見られます。
  - 通知アイコンを新しいロゴに変えました。
  - 韓国語以外の端末ではアプリ名がOFFSIDEと表示されます。
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
고교 시즌이 끝나면 프로 입단이나 대학 진학을 정하고, 시즌이 끝날 때마다 잔류·재계약·이적 중에서 골라요. 성적이 좋으면 일본, 미국, 유럽 리그에서도 제의가 와요. 고른 국적의 대표팀에 뽑히면 월드컵·올림픽·아시안게임 같은 국제 대회에 나가고, 대한민국 선수는 병역도 거쳐요.

■ 은퇴와 명예의 전당
은퇴하면 통산 기록·트로피·수상으로 레전드 점수와 등급이 매겨지고 잠재력이 공개돼요. 만 30세 이상에 은퇴한 선수는 명예의 전당에 올라요. 한 구단에서 레전드급으로 활약하면 등번호가 영구결번될 수 있어요.

■ 구단주 팀
로그인하면 구단주가 되어 은퇴한 내 선수와 이적시장에서 영입한 선수로 11명을 편성해요. 다른 구단주 팀과 경기하고, 친구와 친선전도 치를 수 있어요.

■ 한국어·영어·일본어
설정에서 언어를 바꿀 수 있어요. 댓글과 채팅은 내 언어로 번역해 볼 수 있어요.

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
After high school, turn pro or go to university. At the end of each season, stay, re-sign or move. Play well and offers arrive from Japan, the US and Europe's top leagues. Pick any nationality, get called up by that country and play in the World Cup, the Olympics and other international tournaments. Korean players also have to handle military service.

■ Retirement and the Hall of Fame
When you retire, your career totals, trophies and awards earn a legend score and grade, and your potential is revealed. Players who retire at 30 or older enter the public Hall of Fame. Become a club legend and your shirt number may be retired.

■ Owner team
Sign in to become a club owner. Build an XI from your retired players and players bought on the transfer market, take on other owners' teams and play friendlies with friends.

■ Korean, English and Japanese
Switch languages in Settings. Comments and chat can be translated into your language.

Your progress is saved on this device. Export a backup code or file in Settings to continue on another device.
Contact: contact@offside-lab.com
```

### 日本語の説明

```
今度の人生はサッカーだ。
高校3年生から引退まで、ひとりの選手のキャリアを自分でつくるサッカー選手キャリアシミュレーションです。シーズンごとに選んだトレーニングとイベントの選択が積み重なり、選手の物語になります。

■ 選手をつくる
名前、背番号、国籍、ポジションと詳細ポジション、利き足、得意な能力値、成長タイプを決めると、能力値の合計が同じ候補が3人現れます。その中のひとりで高校3年のシーズンを始めます。ポテンシャルは引退するときに明かされます。

■ シーズンの進行と成長
1シーズンはプレシーズン、前半戦、後半戦に分かれます。区間ごとにトレーニングの方向と自己投資を選ぶと、試合結果と出場・ゴール・アシスト・評価点が記録されます。最初のシーズンを終えると、資金を使ってポテンシャル強化に挑戦できます。

■ 確率のあるイベントと試合の名場面
シーズン中にイベントが起き、選択肢ごとに実際の成功確率が表示されます。PK、1対1、PK戦はタイミングゲージで決まります。いくつかのストーリーは複数のシーズンにわたって続きます。

■ 移籍、海外進出、代表
高校卒業後はプロ入りか大学進学を選びます。シーズンが終わるたびに残留、再契約、移籍を決めます。活躍すれば日本、アメリカ、ヨーロッパのトップリーグからオファーが届きます。選んだ国籍の代表に選ばれれば、ワールドカップやオリンピックなどの国際大会にも出場します。韓国の選手は兵役にも向き合います。

■ 引退と殿堂
引退すると、通算成績、トロフィー、受賞歴からレジェンドスコアとランクが決まり、ポテンシャルが明かされます。30歳以上で引退した選手は公開の殿堂に入ります。クラブのレジェンドになれば背番号が永久欠番になることもあります。

■ オーナーチーム
ログインするとクラブのオーナーになれます。引退した自分の選手と移籍市場で獲得した選手で11人を組み、ほかのオーナーのチームと対戦したり、フレンドと親善試合をしたりできます。

■ 日本語・英語・韓国語
設定で言語を切り替えられます。コメントとチャットは自分の言語に翻訳できます。

進行状況はこの端末に保存されます。設定でバックアップコードやファイルを書き出すと、別の端末で続きを遊べます。
お問い合わせ: contact@offside-lab.com
```

## 4. 스크린샷 문구 (7장)

순서대로 쓴다. 제목은 크게, 부제는 한 줄로 작게. 이미지는 `apps/mobile/store/`(문구 `frames.json`, 렌더러·촬영 방법은 그 README)로 만든다.
App Store는 6.9"(1320×2868), Google Play는 휴대전화(1080×2160)와 그래픽 이미지(1024×500, 1번 문구)를 올린다.

2026-10-07 main(#561까지) 기준으로 7장을 한국어·영어·일본어 모두 다시 찍었다. 시뮬레이터 기기 언어·지역을 그 언어(ko-KR·en-US·ja-JP)로 두고 찍어 선수 생성 화면의 국적 기본값이 대한민국·USA·日本으로 나온다. 일본어 커리어는 일본 국적 선수(같은 시드)다. 6장 "재촬영 필요" 표시는 이것으로 해소됐다.

| #   | 장면                | 한국어 제목                 | 한국어 부제                              | English headline              | English sub                                    |
| --- | ------------------- | --------------------------- | ---------------------------------------- | ----------------------------- | ---------------------------------------------- |
| 1   | 홈·진행 중 커리어   | 이번 생은 축구다            | 고3부터 은퇴까지, 한 선수로 살아요       | One player. One whole career. | From high school to retirement                 |
| 2   | 선수 생성           | 나만의 선수를 직접 만들어요 | 국적을 고르면 그 나라 대표로 뛰어요      | Build your own player         | Pick any nation and play for its national team |
| 3   | 1대1 타이밍 게이지  | 결정적인 순간은 내 손으로   | 1대1·페널티킥은 타이밍 게이지로 판정해요 | Big moments, your timing      | One-on-ones and penalties use a timing gauge   |
| 4   | 선수 능력치 레이더  | 시즌마다 자라는 내 선수     | 훈련과 자기 투자로 능력치를 키워요       | Grow every season             | Train and invest to build attributes           |
| 5   | 시즌 리뷰·월드컵    | 모든 시즌이 기록으로 남아요 | 골·도움·평점부터 월드컵까지              | Every season on the record    | Goals, ratings, awards and World Cups          |
| 6   | 이적 시장·해외 제의 | 해외 이적, 국가대표까지     | 일본·미국·유럽 리그에서 제의가 와요      | Transfers abroad, World Cups  | Offers from Japan, the US and Europe           |
| 7   | 은퇴·레전드 리포트  | 은퇴하면 명예의 전당에      | 레전드 점수와 잠재력이 공개돼요          | Retire into the Hall of Fame  | Legend score and potential revealed            |

일본어 문구는 `frames.json`의 `ja`에 있다(1 今度の人生はサッカーだ · 2 自分だけの選手を一からつくる(国籍を選べば、その国の代表でプレー) · 3 決定的な瞬間は自分の手で · 4 シーズンごとに成長する選手 · 5 すべてのシーズンが記録に残る · 6 海外移籍、代表入りまで · 7 引退したら殿堂へ). 일본어 스크린샷은 앱을 일본어로 두고 찍은 `shots/ja/`로 만든다.

## 5. 체크리스트

- 카테고리(게임 > 스포츠·시뮬레이션)와 연령 등급 설문은 1.1.0과 같다. 바꿀 내용 없음.
- 개인정보처리방침 `https://offside-lab.com/legal/privacy/`, 지원 URL·문의 `contact@offside-lab.com`은 그대로 둔다. en-US 현지화에도 같은 주소를 넣는다.
- 실제 리그·대회 로고나 구단 엠블럼이 스크린샷에 나오지 않게 한다. 설명에서도 특정 리그 상표를 제목·키워드로 쓰지 않는다.
- 평점·다운로드 수·순위 같은 수치는 넣지 않는다.
- 스토어 문구를 바꾸면 웹 공개 가이드·FAQ와 사실이 어긋나지 않는지 본다(`apps/web/scripts/seo.mjs`).

## 6. 심사 재개 전 확인 (main 반영 기록)

1.1.1 심사는 보류 중이다(1.1.0 패치 진행). 그 사이 main 변경을 이 브랜치에 합치고 아래에 남긴다.

| main 커밋                                                      | 1.1.1 영향                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #527 후보 잠재력·은퇴 25세                                     | 선수 생성 화면(2번)에 후보 잠재력 범위 광고 버튼. 문구 변경 없음                                                                                                                     |
| #528 도트 아바타                                               | 커리어 화면 상단 아바타. 새 기능 문구에 넣음. 게임 화면 머리(3·4번, 5·6번 시트 뒤)가 아바타 전 화면이라 **재촬영 필요**                                                              |
| #530 포지션별 OVR 안내                                         | 선수 생성·훈련 화면에 포지션별 OVR 설명. 2번 스크린샷(선수 생성) **재촬영 필요**                                                                                                     |
| #532 영어 화면 표시 수정                                       | 1.1.0 OTA로 먼저 나감. 이 브랜치의 같은 수정과 합쳐짐                                                                                                                                |
| #531 은퇴식 도트 선수                                          | 은퇴 리포트(7번)에 도트 선수. 새 기능 문구에 반영. 7번 스크린샷 **재촬영 필요**                                                                                                      |
| #533 명예의 전당 시상대 도트                                   | 명예의 전당 화면(스크린샷 없음). 새 기능 문구에 반영                                                                                                                                 |
| #534 영구결번 탭 시즌별 명예의 벽                              | 기록실 화면(스크린샷 없음). 작은 기능이라 새 기능 문구에는 넣지 않음                                                                                                                 |
| #537 첫 화면 번들 정리                                         | 화면 변화 없음                                                                                                                                                                       |
| #538 홈 구단 가치 TOP 3·팀 랭킹 정렬                           | 홈(1번) 화면에 새 섹션. App Store 새 기능 문구에 넣음. 1번 스크린샷 **재촬영 필요**                                                                                                  |
| #536 장기근속 업적·원클럽맨 상무 예외                          | 업적 추가(스크린샷 없음). 새 기능 문구에는 넣지 않음                                                                                                                                 |
| #542 홈 더보기·응원 카드, 설정 앱 버전, 명예의 전당 다듬기     | 홈(1번) 화면 변경, 위 재촬영에 포함. 영어 문구 함께 들어옴                                                                                                                           |
| #543 영구결번 유니폼 도트 액자                                 | 은퇴 화면 영구결번 표시·공유 카드 변경. 7번은 이미 재촬영 대상                                                                                                                       |
| #539 구단주 시즌 결산·등급·기록 배지                           | 구단주 화면(스크린샷 없음). 새 기능 문구에는 넣지 않음. 영어 문구 함께 들어옴                                                                                                        |
| #545 보상형 광고 불러오기 실패 안내·잠재력 강화 광고 하루 20번 | 광고 동작 변경(스크린샷 없음, 네이티브 변경 없음). 새 기능 문구에는 넣지 않음. 영어 문구 함께 들어옴                                                                                 |
| T-11-140 일본어 지원(별도 PR)                                  | 1.1.1에 일본어 앱 이름·권한 안내(`locales/ja.json`)와 일본어 스토어 문구·미리보기 문구를 넣음. 게임 안 일본어는 별도 PR로 OTA·웹 배포. 일본어 스크린샷 7장 새로 촬영 필요            |
| #546 보상형 광고 실패 시 광고 없이 보상(임시)                  | 광고 동작(스크린샷 없음, 네이티브 변경 없음)                                                                                                                                         |
| #548 웹 선수 탭 스카우트 평가                                  | 웹 전용. 앱 선수 탭은 한 줄 정리뿐이라 4번 재촬영 범위 그대로                                                                                                                        |
| #549 시즌 상대를 리그 실제 NPC 구단과 연결                     | 경기·순위 결과가 바뀜(골든 갱신). 5번 시즌 리뷰는 이미 재촬영 대상. 새 기능 문구에는 넣지 않음                                                                                       |
| #551 확률과 공정성 공개                                        | 확률 도감에 '확률과 공정성'(설정에도 링크), 은퇴 리포트에 잠재력 변화 과정, 선수 생성 광고 안내 문구 보강. 새 기능 문구에 넣음. 2번(선수 생성)·7번(은퇴 리포트)은 이미 재촬영 대상   |
| #550 K리그1 순위표 기반 구단 전력표                            | 새 시즌부터 상대 구단 전력이 실제 순위를 따름. 화면 변화 없음, 새 기능 문구에는 넣지 않음                                                                                            |
| #552 일본어 지원·기기 언어 기준 국적 기본값                    | 게임 안 일본어가 OTA·웹으로 나감. 선수 생성(2번) 국적 기본값이 기기 지역을 따름. 스토어 문구에 "국적을 골라 그 나라 대표로" 추가(en·ja 프로모션·설명). 일본어 스크린샷 7장 촬영 필요 |
| #556 친구 신청 배지·친구 푸시 이동                             | 친구 화면(스크린샷 없음). 새 기능 문구에는 넣지 않음                                                                                                                                 |
| #557 원클럽맨 판정 현역 복무 제외                              | 업적 판정(스크린샷 없음)                                                                                                                                                             |
| #560 공지·릴리즈 노트 번역, 댓글·채팅 번역 보기                | 새 기능 문구·설명 언어 항목에 넣음(ko·en·ja). 스크린샷 없음                                                                                                                          |
| #555 다른 유저 선수 이름을 지금 언어로                         | 홈 이적 소식·명예의 전당 표시(스크린샷 없음). 새 기능 문구에는 넣지 않음                                                                                                             |
| #553 시즌 결산 순위 일치·발롱도르 통산 표시                    | 시즌 리뷰(5번)·은퇴 리포트(7번)는 이미 재촬영 대상                                                                                                                                   |
| #559·#561 휴면 커리어 보관, 번역 본문 한도                     | 서버 전용. 앱 영향 없음                                                                                                                                                              |
| #558 시즌 1 제1회 오프사이드 컵                                | 홈에 컵 배너(대회 기간만), 구단주 컵 화면. 기간 한정이라 스크린샷·새 기능 문구에는 넣지 않음. 네이티브 변경 없음                                                                     |
| #565 구단 자금 리롤권 상점                                     | 구단주 상점·후보 선택(2단계) 다시 뽑기 안내. 2번 스크린샷은 1단계라 영향 없음. 새 기능 문구에는 넣지 않음                                                                            |

## 7. 앱 1.1.2 새 기능 (T-11-194)

1.1.2는 광고를 AppLovin MAX에서 AdMob으로 되돌린 빌드다(AppLovin 신규 퍼블리셔 계정 거절, 2026-10-09). 등록 정보 · 스크린샷은 1.1.1 그대로 두고 새 기능 문구만 바꾼다. iPhone Duo 스크린샷(안쪽 2007×2853, 언어별 7장)과 헤더 · 검색 결과 크리에이티브(ko · en-US · en-GB · ja)는 1.1.2 버전에 올렸다(2026-10-10).

- 한국어: 오프사이드 컵 승부예측과 대진표가 생겼어요. 맞히면 리롤권을 받아요. / 내 선수를 잠가 실수로 팔거나 방출하지 않게 할 수 있어요. / 앱 안정성을 개선했어요.
- English (en-US · en-GB): Predict OFFSIDE Cup matches and follow the bracket. Correct picks earn reroll tickets. / Lock your players so you never sell or release them by mistake. / Stability improvements.
- 日本語: オフサイドカップの勝敗予想とトーナメント表が加わりました。的中するとリロール券がもらえます。 / 選手をロックして、うっかり売却や放出をしないようにできます。 / アプリの安定性を改善しました。
