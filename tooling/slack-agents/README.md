# 슬랙 에이전트 앱 manifest (ADR-015)

[ADR-015](../../docs/adr/ADR-015-slack-agent-team.md)의 역할 에이전트 네 개를 Offside-Lab 슬랙에 앱으로 만들 때 쓰는 설정이다. ADR의 `@ops` · `@plan` · `@dev` · `@mkt`는 슬랙에서 `@offside-ops` · `@offside-plan` · `@offside-dev` · `@offside-mkt`로 보인다.

| 파일 | 앱 이름 | 봇 이름 | 역할에만 더한 권한 |
|---|---|---|---|
| `manifests/ops.yaml` | OFFSIDE Ops | `offside-ops` | `files:write`(점검 화면), `groups:history` · `groups:read`(비공개 `#offside-purchases` 읽기) |
| `manifests/plan.yaml` | OFFSIDE Plan | `offside-plan` | 없음 |
| `manifests/dev.yaml` | OFFSIDE Dev | `offside-dev` | `files:write`(화면 확인 스크린샷) |
| `manifests/mkt.yaml` | OFFSIDE Mkt | `offside-mkt` | `files:write`(문구 · 이미지 초안) |

네 앱 공통 권한은 멘션 받기(`app_mentions:read`), 참여한 공개 채널 읽기(`channels:history` · `channels:read`), 글쓰기(`chat:write`), 운영자 DM(`im:history` · `im:write`), 진행 표시 이모지(`reactions:write`), 운영자 확인(`users:read`)이다. 채널 만들기 · 초대 · 관리자 권한은 주지 않는다. 채널에는 운영자가 직접 초대한다.

## 0단계: 앱 만들기 (지금)

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

## 1단계: 이벤트 받기 · 승인 버튼 켜기 (Worker 배포 뒤)

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
