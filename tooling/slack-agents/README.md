# 슬랙 에이전트 앱 manifest (ADR-015)

[ADR-015](../../docs/adr/ADR-015-slack-agent-team.md)의 역할 에이전트 네 개를 Offside-Lab 슬랙에 앱으로 만들 때 쓰는 설정이다. ADR의 `@ops` · `@plan` · `@dev` · `@mkt`는 슬랙에서 `@offside-ops` · `@offside-plan` · `@offside-dev` · `@offside-mkt`로 보인다.

| 파일 | 앱 이름 | 봇 이름 | 역할에만 더한 권한 |
|---|---|---|---|
| `manifests/ops.yaml` | OFFSIDE Ops | `offside-ops` | `files:write`(점검 화면), `groups:history` · `groups:read`(비공개 `#offside-purchases` 읽기) |
| `manifests/plan.yaml` | OFFSIDE Plan | `offside-plan` | 없음 |
| `manifests/dev.yaml` | OFFSIDE Dev | `offside-dev` | `files:write`(화면 확인 스크린샷) |
| `manifests/mkt.yaml` | OFFSIDE Mkt | `offside-mkt` | `files:write`(문구 · 이미지 초안) |

네 앱 공통 권한은 멘션 받기(`app_mentions:read`), 참여한 공개 채널 읽기(`channels:history` · `channels:read`), 글쓰기(`chat:write`), 운영자 DM(`im:history` · `im:write`), 진행 표시 이모지(`reactions:write`), 운영자 확인(`users:read`)이다. 채널 만들기 · 초대 · 관리자 권한은 주지 않는다. 채널에는 운영자가 직접 초대한다.

## 0단계: 앱 만들기 (2026-10-15 완료)

지금 manifest에는 이벤트 받기 · 버튼 설정이 없다. 받는 주소(Worker)가 아직 없어서, 넣으면 슬랙이 주소를 확인하다 실패한다.

1. https://api.slack.com/apps → **Create New App** → **From a manifest** → 워크스페이스 **Offside-Lab** 선택.
2. `manifests/<역할>.yaml` 내용을 YAML 탭에 붙여 넣고 만든다. 네 번 반복한다.
3. 앱마다 **Install to Workspace** → 허용.
4. 앱마다 두 값을 받아 둔다. 채팅 · 저장소 · 메모에 붙이지 않는다.
   - **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`)
   - **Basic Information → Signing Secret**
5. 슬랙에서 `#agent-desk` · `#agent-approvals` 채널을 만들고 네 봇을 초대한다(`/invite @offside-ops` …). `@offside-ops` · `@offside-plan`은 알림 채널(`#offside-alerts` · `#offside-daily` · `#offside-feedback` · `#offside-releases`)에도, `@offside-ops`는 `#offside-purchases`에도 초대한다.

받은 값은 1단계에 Worker 비밀값으로 넣는다(`apps/agents`에서 실행, 값은 프롬프트에 직접 입력).

```sh
pnpm exec wrangler secret put SLACK_OPS_BOT_TOKEN
pnpm exec wrangler secret put SLACK_OPS_SIGNING_SECRET
# PLAN · DEV · MKT도 같은 이름 꼴로
```

## 1단계: `@offside-ops` 연결 (2026-10-15, T-11-275)

Worker는 `apps/agents`(`agents.offside-lab.com`)다. `manifests/ops.yaml`에 이벤트 주소를 넣었고, `@offside-ops`는 `#offside-alerts`에 초대했다.

- **비밀값(Worker `offside-agents`).** `ANTHROPIC_<ROLE>_API_KEY`(Console `offside-agents` 워크스페이스 키), `SLACK_<ROLE>_BOT_TOKEN`, `SLACK_<ROLE>_SIGNING_SECRET`, `CF_D1_READ_TOKEN`(D1 읽기 권한만 있는 Cloudflare API 토큰), `CF_MCP_TOKEN`(Cloudflare MCP용 읽기 전용 토큰, 권한은 ADR-015 인프라 절). `GITHUB_TOKEN`은 없으면 공개 API로 읽는다.
- **배포.** `pnpm --filter @offside/agents deploy`. 역할을 열 때는 `wrangler.jsonc`의 `ENABLED_ROLES`에 더한다.
- **하는 일.** `#offside-alerts` 웹훅 경보(정상 복구 알림 · 24시간 안의 같은 경보 제외)와 운영자 멘션 · 그 스레드 답글을 받아 스레드에 답한다. 답 아래 줄에 턴 수 · 비용 · 그날 누적이 붙는다.

## 2단계: `@offside-plan` 연결 · 유저 반응 살피기 (2026-10-15, T-11-275)

`manifests/plan.yaml`에 이벤트 주소를 넣었다. `ENABLED_ROLES`는 `ops,plan`.

- **유저 반응 살피기.** 매시간 17분(cron) 새 게임 댓글(운영 D1 읽기)과 라운지 채팅(`offside-api`의 `GET /v1/internal/agents/chat`, 토큰이 맞을 때만 열린다)을 모아 `@plan`에게 넘긴다. 새 글이 없거나 웃음 · 기호뿐이면 Claude를 부르지 않고, 검토할 글(버그 의심 · 개선 제안 · 요구사항)이 없으면 슬랙에 올리지 않는다. 있으면 `#agent-desk`에 정리를 올린다. 닉네임 · 프로필 ID는 넘기지 않고 작성자 가명만 쓴다.
- **넘기기.** 에이전트 답의 줄 머리에 `→ @ops: 확인할 것`이 있으면 같은 스레드에서 그 역할이 이어 받는다(Worker 안에서 넘기고 슬랙 이벤트는 거치지 않는다). 스레드마다 6번까지. 운영자 답글은 그 스레드를 연 역할만 받는다.
- **비밀값 추가.** 두 Worker에 같은 `AGENTS_READ_TOKEN`(임의 문자열)을 넣는다: `offside-api`(`--env production`)와 `offside-agents`. 값은 채팅 읽기 토큰이자 작성자 가명의 소금이다.

## 다음 단계: 다른 역할 · 승인 버튼 (Worker 배포 뒤)

`apps/agents` Worker가 배포되면 앱마다 **App Manifest** 편집에서 `settings`를 아래로 바꾼다. `<role>`은 `ops` · `plan` · `dev` · `mkt`다. 주소는 1단계에서 확정한다.

```yaml
settings:
  event_subscriptions:
    request_url: https://agents.offside-lab.com/slack/<role>/events
    bot_events:
      - app_mention
      - message.channels
      - message.im
      # ops만: 비공개 #offside-purchases 메시지
      - message.groups
  interactivity:
    is_enabled: true
    request_url: https://agents.offside-lab.com/slack/<role>/interactive
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

- 앱마다 Signing Secret이 달라서 주소를 역할별로 나눈다.
- `message.groups`는 `@offside-ops`에만 넣는다(다른 앱은 `groups:history` 권한이 없다).
- 승인 버튼은 그 카드를 올린 봇의 앱으로 들어온다. Worker는 버튼을 누른 사람이 운영자인지 사용자 ID로 확인한다.

## 앱 수

무료 플랜은 앱 · 워크플로를 합쳐 10개까지다. 지금 OFFSIDE Purchase Alerts · Google Calendar · Google Drive 3개에 이 4개를 더하면 7개다.
