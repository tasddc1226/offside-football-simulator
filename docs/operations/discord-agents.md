# 에이전트 팀 · 운영 알림 디스코드 (T-11-576 · T-11-578)

에이전트 네 역할(이운재 · 박지성 · 손흥민 · 안정환)과 운영 알림은 디스코드 서버 OFFSIDE Lab에서 돈다. 2026-10-29 슬랙(Offside-Lab)에서 옮기고 슬랙 쪽 코드 · 비밀값을 걷어냈다. 결정 배경은 [ADR-015](../adr/ADR-015-slack-agent-team.md)의 "디스코드 이전"을 본다.

## 구조

- **봇은 하나다.** 디스코드 앱 하나(봇 토큰 하나)가 채널마다 웹훅(`offside-agents`)을 만들고, 역할 이름을 웹훅 `username`으로 바꿔 쓴다. 역할마다 앱을 만들지 않는다.
- **받기는 게이트웨이.** 디스코드는 일반 글을 HTTP로 보내 주지 않는다. Durable Object `DiscordBridge`(객체 하나)가 게이트웨이 웹소켓을 붙잡고, 1분 알람과 5분 cron이 끊긴 연결을 다시 잇는다(RESUME).
- **에이전트 코드는 그대로다.** 코드는 슬랙 시절의 Web API 모양(`chat.postMessage` · `chat.update` · `reactions.add` · Block Kit 버튼)으로 부르고, `apps/agents/src/bridge.ts`가 디스코드로 옮긴다. 마크다운 표는 코드 블록으로, 2,000자가 넘는 답은 여러 글로 나눈다.
- **부르는 법**
  - 봇을 멘션하면(`@봇 …`) 주장(박지성)이 맡는다.
  - 특정 역할은 지금처럼 한글 이름으로 부른다(`@이운재 …`).
  - 스레드는 원글에서 열리고, 스레드 ID가 원글 ID와 같아서 `thread_ts` 자리에 그대로 들어간다.
- **버튼:** 승인 버튼은 Interactions Endpoint(`/discord/interactions`)로 온다. 운영자가 아니면 그 사람에게만 보이는 거절 답을 준다. 버튼 값은 `custom_id`(100자)에 다 들어가지 않아 브리지 저장소에 두고 열쇠만 보낸다.
- **알림 웹훅:** GitHub Actions(`slack-*.yml`)와 운영 API(결제 · 컵 · 리그 알림)는 디스코드 웹훅으로만 보낸다(글 하나, 멘션 끔). 워크플로 · 스크립트 · 비밀값 이름(`SLACK_*_WEBHOOK` · `BILLING_SLACK_WEBHOOK`)은 슬랙 시절 그대로다. 비밀값은 값을 읽을 수 없어 이름을 바꾸려면 웹훅을 다시 넣어야 한다.

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

## 2. Worker 값과 버튼 주소

1. `apps/agents/wrangler.jsonc` vars에 서버 · 앱 · 채널 값을 둔다. 모두 비밀값이 아니다.
   - `DISCORD_APP_ID` · `DISCORD_PUBLIC_KEY` · `DISCORD_GUILD_ID`
   - `OPERATOR_USER_ID`(서버 주인), `DESK_CHANNEL`, `APPROVAL_CHANNEL`, `ALERT_CHANNELS`
2. 에이전트 Worker를 배포한다(`pnpm --filter @offside/agents exec wrangler deploy`).
3. 개발자 포털 General Information의 **Interactions Endpoint URL**에 `https://agents.offside-lab.com/discord/interactions`를 넣고 저장한다. 디스코드가 서명한 확인 요청을 보내 통과해야 저장된다.

## 3. 채널 · 웹훅 · 비밀값 (운영자가 한 번 실행)

```bash
# 개발자 포털 Bot 탭에서 Reset Token으로 받은 토큰을 복사한 뒤
DISCORD_BOT_TOKEN=$(pbpaste) node apps/agents/scripts/discord-setup.mjs
pbcopy < /dev/null   # 클립보드 비우기
```

1. 봇 토큰은 `DISCORD_BOT_TOKEN`으로 받고, 없으면 숨김 입력으로 묻는다.
2. 채널 7개와 알림 채널 웹훅(`offside-notify`)을 만든다. 이미 있으면 그대로 쓴다.
   - 에이전트 채널: `agent-desk`, `agent-approvals`
   - 알림 채널: `offside-alerts`, `offside-daily`, `offside-purchases`, `offside-feedback`, `offside-releases`
3. 표준 입력으로 비밀값을 넣는다.
   - 에이전트 Worker: `DISCORD_BOT_TOKEN`
   - GitHub: `SLACK_*_WEBHOOK` 5개
   - 운영 API: `BILLING_SLACK_WEBHOOK`
   - 운영자 기기: `~/.config/offside-ops/hooks.json`(스토어 메일 알림)
4. 마지막 줄에 운영자 ID(서버 주인)와 채널 ID를 찍는다. 토큰과 웹훅 주소는 화면에 찍지 않는다.

Cloudflare 대시보드 알림(플랫폼 알림 5개 · 모니터 5개)은 저장소 밖이다. 대상 "OFFSIDE Discord infrastructure alerts"(종류 Discord)가 `#offside-alerts`의 `cloudflare` 웹훅으로 보낸다. 봇이 만든 `offside-notify`는 디스코드 화면에서 주소를 복사할 수 없어(앱이 만든 웹훅) 채널 설정 → 연동에서 따로 만들었다. Cloudflare 웹훅 대상은 주소를 고칠 수 없어서, 바꾸려면 새 대상을 만들고 알림마다 "대상 관리"에서 옮긴다.

## 4. 확인

`AGENTS_READ_TOKEN`이 있으면 연결 상태를 본다. 응답에 `socket: true`, `session: true`가 보이면 게이트웨이가 붙은 것이다.

```bash
curl -sS -X POST -H "Authorization: Bearer $AGENTS_READ_TOKEN" \
  'https://agents.offside-lab.com/internal/run?job=discord-status'
```

1. **역할 부르기:** `#agent-desk`에 `@이운재 …` · `@박지성 …` · `@손흥민 …` · `@안정환 …`를 쓴다. 스레드가 열리고 그 이름으로 답이 와야 한다(2026-10-29 네 역할 모두 확인).
2. **봇 부르기:** 봇을 멘션하면 박지성 이름으로 답이 와야 한다.
3. **멈춤:** 스레드에서 `@박지성 멈춰`를 쓰면 대기열이 비워져야 한다.
4. **승인 버튼:** 승인 카드의 버튼을 누르면 처리 결과 줄로 바뀌어야 한다.

## 비용

브리지 객체는 웹소켓을 붙잡고 있어서 늘 깨어 있다(128MB 기준 한 달 약 33만 GB-초). 유료 플랜에 포함된 40만 GB-초 안이지만 다른 객체와 합쳐 넘으면 넘은 만큼 나온다. 디스코드 자체는 무료이고 메시지 보관 기한이 없다.

## 슬랙을 닫은 기록 (2026-10-29)

1. **Cloudflare 알림:** 플랫폼 알림 5개 · 모니터 5개를 디스코드 대상으로 옮겼다. 슬랙 대상 "OFFSIDE Slack infrastructure alerts"는 쓰는 알림이 없다.
2. **Worker 비밀값:** `SLACK_*_BOT_TOKEN` · `SLACK_*_SIGNING_SECRET` 8개를 지웠다.
3. **코드(T-11-578):** 슬랙 이벤트 · 버튼 주소(`/slack/*`), 슬랙 클라이언트 · 서명 확인, `CHAT_PLATFORM` · `AGENT_APP_IDS` · `AGENT_BOT_USERS`, 슬랙 앱 manifest(`tooling/slack-agents`)를 지웠다. 알림 웹훅은 슬랙 주소를 거절한다.
4. **저장소 밖에 남은 것:** 슬랙 워크스페이스 Offside-Lab과 슬랙 앱 4개. 지우는 일은 운영자가 슬랙에서 직접 한다(앱: api.slack.com/apps → 앱 → Delete App, 워크스페이스: 워크스페이스 설정 → 워크스페이스 삭제).

슬랙으로 되돌리려면 이 커밋들을 되돌리고 슬랙 앱 · 비밀값을 다시 만들어야 한다.
