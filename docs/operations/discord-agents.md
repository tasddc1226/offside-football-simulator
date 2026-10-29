# 에이전트 팀 디스코드 이전 (T-11-576)

슬랙(Offside-Lab, 무료 플랜)에서 돌던 에이전트 네 역할(이운재 · 박지성 · 손흥민 · 안정환)과 운영 알림 채널을 디스코드 서버로 옮기는 절차다. 결정 배경은 [ADR-015](../adr/ADR-015-slack-agent-team.md)의 "디스코드 이전"을 본다.

## 구조

- **봇은 하나다.** 디스코드 앱 하나(봇 토큰 하나)가 채널마다 웹훅(`offside-agents`)을 만들고, 역할 이름을 웹훅 `username`으로 바꿔 쓴다. 슬랙처럼 역할마다 앱을 만들지 않는다.
- **받기는 게이트웨이.** 디스코드는 일반 글을 HTTP로 보내 주지 않는다. Durable Object `DiscordBridge`(객체 하나)가 게이트웨이 웹소켓을 붙잡고, 1분 알람과 5분 cron이 끊긴 연결을 다시 잇는다(RESUME).
- **에이전트 코드는 그대로다.** 코드는 슬랙 Web API 모양(`chat.postMessage` · `chat.update` · `reactions.add` · Block Kit 버튼)으로 부르고, `CHAT_PLATFORM=discord`면 `apps/agents/src/bridge.ts`가 디스코드로 옮긴다. 마크다운 표는 코드 블록으로, 2,000자가 넘는 답은 여러 글로 나눈다.
- **부르는 법**
  - 봇을 멘션하면(`@봇 …`) 주장(박지성)이 맡는다.
  - 특정 역할은 지금처럼 한글 이름으로 부른다(`@이운재 …`).
  - 스레드는 원글에서 열리고, 스레드 ID가 원글 ID와 같아서 슬랙의 `thread_ts` 자리에 그대로 들어간다.
- **버튼:** 승인 버튼은 Interactions Endpoint(`/discord/interactions`)로 온다. 운영자가 아니면 그 사람에게만 보이는 거절 답을 준다. 버튼 값은 `custom_id`(100자)에 다 들어가지 않아 브리지 저장소에 두고 열쇠만 보낸다.
- **알림 웹훅:** GitHub Actions(`slack-*.yml`)와 운영 API(결제 · 컵 · 리그 알림)는 슬랙 주소 대신 디스코드 웹훅 주소를 받으면 디스코드 형식으로 보낸다. 비밀값 이름(`SLACK_*_WEBHOOK` · `BILLING_SLACK_WEBHOOK`)은 그대로 둔다.

## 1. 디스코드 서버와 앱 만들기 (운영자)

1. **서버를 만든다.** 디스코드 앱에서 새 서버를 만든다(예: `OFFSIDE Lab`).
2. **개발자 모드를 켠다.** 사용자 설정 → 고급 → 개발자 모드를 켠다. 서버 이름과 내 프로필을 우클릭해 **서버 ID**와 **내 사용자 ID**를 복사해 둔다.
3. **앱을 만든다.** [개발자 포털](https://discord.com/developers/applications)에서 New Application을 누른다(예: `OFFSIDE Agents`).
   - General Information의 **Application ID**와 **Public Key**를 복사한다.
   - Bot 탭에서 Reset Token으로 **봇 토큰**을 받는다. 토큰은 아래 4단계에서 터미널에 직접 넣고, 채팅이나 파일에 옮기지 않는다.
   - 같은 탭의 Privileged Gateway Intents에서 **Message Content Intent**를 켠다.
   - Public Bot은 끈다.
4. **봇을 서버에 초대한다.** 아래 주소에서 `<APP_ID>`를 바꿔 연다.

   ```
   https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot&permissions=309774601296
   ```

   초대 주소가 주는 권한은 다음과 같다.
   - 채널 보기 · 관리, 웹훅 관리
   - 메시지 보내기 · 기록 읽기, 링크 첨부
   - 반응 달기
   - 공개 스레드 만들기, 스레드에 메시지 보내기

## 2. 코드 배포

1. 이 작업 PR을 머지한다. `apps/agents/wrangler.jsonc` vars에는 OFFSIDE Lab 서버 · 앱 값이 이미 들어 있다. 셋 다 비밀값이 아니다.
   - `DISCORD_APP_ID`
   - `DISCORD_PUBLIC_KEY`
   - `DISCORD_GUILD_ID`
2. 운영 배포(`deploy-production.yml`)로 운영 API를 배포한다. 결제 · 컵 · 리그 알림이 디스코드 주소를 받을 수 있게 된다.
3. 에이전트 Worker를 배포한다(`pnpm --filter @offside/agents exec wrangler deploy`). `CHAT_PLATFORM`이 아직 `"slack"`이라 슬랙은 그대로 돈다.
4. 개발자 포털 General Information의 **Interactions Endpoint URL**에 `https://agents.offside-lab.com/discord/interactions`를 넣고 저장한다. 디스코드가 서명한 확인 요청을 보내 통과해야 저장된다.

## 3. 채널 · 웹훅 · 비밀값 (운영자가 한 번 실행)

이 단계는 2단계 배포가 끝난 뒤에 실행한다. 그 전에 알림 비밀값을 디스코드 주소로 바꾸면 옛 코드가 주소를 거절한다.

```bash
node apps/agents/scripts/discord-setup.mjs
```

1. 봇 토큰을 숨김 입력으로 받는다. 개발자 포털 Bot 탭의 Reset Token으로 받은 값을 넣는다.
2. 채널 7개와 알림 채널 웹훅(`offside-notify`)을 만든다. 이미 있으면 그대로 쓴다.
   - 에이전트 채널: `agent-desk`, `agent-approvals`
   - 알림 채널: `offside-alerts`, `offside-daily`, `offside-purchases`, `offside-feedback`, `offside-releases`
3. 표준 입력으로 비밀값을 넣는다.
   - 에이전트 Worker: `DISCORD_BOT_TOKEN`
   - GitHub: `SLACK_*_WEBHOOK` 5개
   - 운영 API: `BILLING_SLACK_WEBHOOK`
   - 운영자 기기: `~/.config/offside-ops/hooks.json`(스토어 메일 알림)
4. 마지막 줄에 운영자 ID(서버 주인)와 채널 ID를 찍는다. 토큰과 웹훅 주소는 화면에 찍지 않는다.

이 단계가 끝나면 GitHub Actions와 운영 API 알림은 디스코드로 간다. 경보 첫 정리는 다음 단계부터 디스코드에서 달린다.

Cloudflare 대시보드 알림(플랫폼 알림 · SQL 모니터)은 저장소 밖이다. 알림 대상 웹훅을 `offside-alerts` 웹훅 주소 끝에 `/slack`을 붙인 주소로 바꾼다. 디스코드의 슬랙 호환 주소라 슬랙 형식 본문을 받는다.

## 4. 전환

`apps/agents/wrangler.jsonc`를 바꾸는 PR을 내고, 머지 뒤 Worker를 배포한다.

| 값                 | 바꿀 값                         |
| ------------------ | ------------------------------- |
| `CHAT_PLATFORM`    | `"discord"`                     |
| `OPERATOR_USER_ID` | 내 디스코드 사용자 ID           |
| `DESK_CHANNEL`     | `agent-desk` 채널 ID            |
| `APPROVAL_CHANNEL` | `agent-approvals` 채널 ID       |
| `ALERT_CHANNELS`   | `offside-alerts` 채널 ID        |
| `AGENT_APP_IDS`    | `""`(역할 글은 웹훅으로 거른다) |
| `AGENT_BOT_USERS`  | `""`                            |

배포 뒤 확인한다.

```bash
curl -sS -X POST -H "Authorization: Bearer $AGENTS_READ_TOKEN" \
  'https://agents.offside-lab.com/internal/run?job=discord-status'
```

1. **연결 확인:** 응답에 `socket: true`, `session: true`가 보이면 게이트웨이가 붙은 것이다.
2. **봇 부르기:** `#agent-desk`에 `@봇 상태 한 줄로 알려 줘`를 쓴다. 👀 반응이 붙고, 박지성 이름으로 스레드 답이 와야 한다.
3. **역할 부르기:** 그 스레드에서 `@이운재 오늘 오류 수`를 쓴다. 이운재 이름으로 답이 와야 한다.
4. **멈춤:** `@박지성 멈춰`를 쓰면 대기열이 비워져야 한다.
5. **승인 버튼:** 다음 승인 카드가 오면 버튼을 눌러 처리 결과 줄로 바뀌는지 본다.

## 되돌리기

1. `CHAT_PLATFORM`을 `"slack"`으로, 위 ID들을 아래 슬랙 값으로 되돌려 배포한다.
   - `OPERATOR_USER_ID`: `U0C9BAYGT8Q`
   - `DESK_CHANNEL`: `C0C9E9WRVA6`, `APPROVAL_CHANNEL`: `C0C9GCJPYAV`, `ALERT_CHANNELS`: `C0C8FEU657G`
   - `AGENT_APP_IDS`: `A0C987NV8HZ,A0C9CFUM98E,A0C996C6R3P,A0C9E9PELTC`
   - `AGENT_BOT_USERS`: `U0C987SP9MH,U0C9J5P80JG,U0C996EN269,U0C8Z49E58F`
   - 슬랙을 닫은 뒤라면 슬랙 앱 4개의 이벤트 · 상호작용 주소를 다시 켜고, 봇 토큰 · 서명 비밀값을 다시 넣는다.
2. 알림 웹훅 비밀값은 슬랙 주소로 다시 넣는다.

진행 중이던 스레드 · 작업 카드는 플랫폼마다 따로라 넘어가지 않는다. 전환 전에 열린 카드는 슬랙에서 닫거나 디스코드에서 다시 연다.

## 비용

브리지 객체는 웹소켓을 붙잡고 있어서 늘 깨어 있다(128MB 기준 한 달 약 33만 GB-초). 유료 플랜에 포함된 40만 GB-초 안이지만 다른 객체와 합쳐 넘으면 넘은 만큼 나온다. 디스코드 자체는 무료이고 메시지 보관 기한이 없다(슬랙 무료 플랜은 90일).

## 슬랙 정리

1. 전환하고 2주 동안 문제가 없으면 슬랙 앱 4개의 이벤트 · 상호작용 주소를 끈다.
2. 그다음 `SLACK_*_BOT_TOKEN` · `SLACK_*_SIGNING_SECRET` Worker 비밀값을 지운다.
3. 슬랙 코드 경로(`/slack/*`)를 지우는 일은 별도 작업으로 한다.
