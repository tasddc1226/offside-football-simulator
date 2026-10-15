# 슬랙 에이전트 앱 manifest (ADR-015)

[ADR-015](../../docs/adr/ADR-015-slack-agent-team.md)의 역할 에이전트 네 개를 Offside-Lab 슬랙에 앱으로 만들 때 쓰는 설정이다. ADR의 `@ops` · `@plan` · `@dev` · `@mkt`는 슬랙에서 한국 축구 레전드 이름으로 보인다(T-11-281): 운영 이운재(골문 지키기), 기획 박지성(경기 전체 읽기), 개발 손흥민(마무리), 마케팅 안정환(방송). 슬랙 봇 표시 이름은 한글을 받지 않아 로마자(`@Lee Woon-jae` …)로 두고, Worker가 글을 올릴 때 `username`으로 한글 이름(`이운재 · 운영` …)을 붙인다(`chat:write.customize`). 넘기기 줄(`→ @ops:`) · 이벤트 주소 · 비밀값 이름은 역할 키 그대로다.

| 파일 | 앱 이름 | 봇 이름 | 역할에만 더한 권한 |
|---|---|---|---|
| `manifests/ops.yaml` | 이운재 · 운영 | `Lee Woon-jae` | `files:write`(점검 화면), `groups:history` · `groups:read`(비공개 `#offside-purchases` 읽기) |
| `manifests/plan.yaml` | 박지성 · 기획 | `Park Ji-sung` | 없음 |
| `manifests/dev.yaml` | 손흥민 · 개발 | `Son Heung-min` | `files:write`(화면 확인 스크린샷) |
| `manifests/mkt.yaml` | 안정환 · 마케팅 | `Ahn Jung-hwan` | `files:write`(문구 · 이미지 초안) |

네 앱 공통 권한은 멘션 받기(`app_mentions:read`), 참여한 공개 채널 읽기(`channels:history` · `channels:read`), 글쓰기(`chat:write` · 작성자 이름 `chat:write.customize`), 운영자 DM(`im:history` · `im:write`), 진행 표시 이모지(`reactions:write`), 운영자 확인(`users:read`)이다. 채널 만들기 · 초대 · 관리자 권한은 주지 않는다. 채널에는 운영자가 직접 초대한다.

## 한글로 부르기 · 프로필 사진 (2026-10-15, T-11-283)

- **한글로 부르기.** 슬랙 멘션 자동완성은 봇의 영어 표시 이름만 찾는다. 그래서 운영자가 채널 · 스레드에 `@이운재 오늘 가입 수`처럼 한글 이름이나 역할 이름(`@운영` · `@기획` · `@개발` · `@마케팅`)을 글로 쓰면 Worker가 그 역할의 멘션으로 받는다(`message.channels` 이벤트, `env.ts`의 `ROLE_CALLS`). 다른 역할을 부른 답글에는 스레드 주인이 답하지 않는다. 에이전트 넘기기 줄도 `→ @이운재:` 꼴을 받는다.
- **프로필 사진.** 앱 아이콘은 위키미디어 공용의 자유 이용 사진을 잘라 **Basic Information → App icon**에 올렸다(저장소에는 넣지 않는다). 출처:
  - 이운재: "Suwon ACL 2009 Squad.jpg", 신유식, CC BY-SA 4.0 (2009)
  - 박지성: "Ji-Sung Park vs Fulham (cropped).jpg", Magnus D, CC BY 2.0 (2010)
  - 손흥민: "Best Footballer in Asia 2022 Son Heung-min (cropped).jpg", Ujishadow, CC BY-SA 4.0 (2023)
  - 안정환: "Ahn Jung-hwan.JPG", MSV Duisburg, CC BY-SA 3.0 (2006)

## 0단계: 앱 만들기 (2026-10-15 완료)

지금 manifest에는 이벤트 받기 · 버튼 설정이 없다. 받는 주소(Worker)가 아직 없어서, 넣으면 슬랙이 주소를 확인하다 실패한다.

1. https://api.slack.com/apps → **Create New App** → **From a manifest** → 워크스페이스 **Offside-Lab** 선택.
2. `manifests/<역할>.yaml` 내용을 YAML 탭에 붙여 넣고 만든다. 네 번 반복한다.
3. 앱마다 **Install to Workspace** → 허용.
4. 앱마다 두 값을 받아 둔다. 채팅 · 저장소 · 메모에 붙이지 않는다.
   - **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`)
   - **Basic Information → Signing Secret**
5. 슬랙에서 `#agent-desk` · `#agent-approvals` 채널을 만들고 네 봇을 초대한다(`/invite @Lee Woon-jae` …). 운영 · 기획 봇은 알림 채널(`#offside-alerts` · `#offside-daily` · `#offside-feedback` · `#offside-releases`)에도, 운영 봇은 `#offside-purchases`에도 초대한다.

받은 값은 1단계에 Worker 비밀값으로 넣는다(`apps/agents`에서 실행, 값은 프롬프트에 직접 입력).

```sh
pnpm exec wrangler secret put SLACK_OPS_BOT_TOKEN
pnpm exec wrangler secret put SLACK_OPS_SIGNING_SECRET
# PLAN · DEV · MKT도 같은 이름 꼴로
```

## 1단계: `@ops`(이운재) 연결 (2026-10-15, T-11-277)

Worker는 `apps/agents`(`agents.offside-lab.com`)다. `manifests/ops.yaml`에 이벤트 주소를 넣었고, 운영 봇은 `#offside-alerts`에 초대했다.

- **비밀값(Worker `offside-agents`).** `ANTHROPIC_<ROLE>_API_KEY`(Console `offside-agents` 워크스페이스 키), `SLACK_<ROLE>_BOT_TOKEN`, `SLACK_<ROLE>_SIGNING_SECRET`, `CF_D1_READ_TOKEN`(D1 읽기 권한만 있는 Cloudflare API 토큰), `CF_MCP_TOKEN`(Cloudflare MCP용 읽기 전용 토큰, 권한은 ADR-015 인프라 절). `GITHUB_TOKEN`은 없으면 공개 API로 읽는다.
- **배포.** `pnpm --filter @offside/agents deploy`. 역할을 열 때는 `wrangler.jsonc`의 `ENABLED_ROLES`에 더한다.
- **하는 일.** `#offside-alerts` 웹훅 경보(정상 복구 알림 · 24시간 안의 같은 경보 제외)와 운영자 멘션 · 그 스레드 답글을 받아 스레드에 답한다. 답 아래 줄에 턴 수 · 비용 · 그날 누적이 붙는다.

## 2단계: `@plan`(박지성) 연결 · 유저 반응 살피기 (2026-10-15, T-11-277)

`manifests/plan.yaml`에 이벤트 주소를 넣었다. `ENABLED_ROLES`는 `ops,plan`.

- **유저 반응 살피기.** 매시간 47분(cron) 새 게임 댓글(운영 D1 읽기), 라운지 채팅(`offside-api`의 `GET /v1/internal/agents/chat`, 토큰이 맞을 때만 열린다), 디시 마이너 갤러리 `offsidegame`의 새 글 · 댓글을 모아 `@plan`에게 넘긴다. 디시는 웹훅 · RSS가 없고 Cloudflare에서 읽으면 빈 응답이 잦아, `slack-operations.yml`(매시 27분)이 `apps/agents/scripts/dc-push.ts`로 공개 목록 첫 쪽 · 새 글 · 댓글 수가 늘어난 글(한 번에 8개)을 읽어 Worker에 넣어 두고 47분에 함께 정리한다(링크는 지우고 작성자는 가명). 새 글이 없거나 웃음 · 기호뿐이면 Claude를 부르지 않고, 검토할 글(버그 의심 · 개선 제안 · 요구사항)이 없으면 슬랙에 올리지 않는다. 있으면 `#agent-desk`에 정리를 올린다. 닉네임 · 프로필 ID는 넘기지 않고 작성자 가명만 쓴다.
- **넘기기.** 에이전트 답의 줄 머리에 `→ @ops: 확인할 것`이 있으면 같은 스레드에서 그 역할이 이어 받는다(Worker 안에서 넘기고 슬랙 이벤트는 거치지 않는다). 스레드마다 6번까지. 운영자 답글은 그 스레드를 연 역할만 받는다.
- **주기 작업 보고(@ops).** 매일 08:50 KST(`50 23 * * *`) `#agent-desk`에 지난 24시간 결과와 앞으로 24시간 예정을 올린다. `schedules` 도구가 GitHub Actions 예약 워크플로(cron · 최근 결과)와 Worker cron(`offside-api` · `offside-agents`)을 모으고, Worker cron 결과는 Cloudflare MCP로 Workers 로그의 `job` 오류를 센다. 운영자가 멘션해도 같은 도구로 답한다.
- **시험 실행.** `POST https://agents.offside-lab.com/internal/run?job=reactions|report`(디시 넣기는 `dc-cursor` · `dc-push`)(헤더 `Authorization: Bearer <AGENTS_READ_TOKEN>`). `job=reactions&dry=1`은 커서를 옮기지 않고 출처별 건수 · 오류만 돌려준다.
- **비밀값 추가.** 같은 `AGENTS_READ_TOKEN`(임의 문자열)을 `offside-api`(`--env production`) · `offside-agents` Worker와 GitHub Actions 비밀값에 넣는다. 값은 채팅 읽기 토큰이자 작성자 가명의 소금이다.

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
- `message.groups`는 운영 봇(`@ops`)에만 넣는다(다른 앱은 `groups:history` 권한이 없다).
- 승인 버튼은 그 카드를 올린 봇의 앱으로 들어온다. Worker는 버튼을 누른 사람이 운영자인지 사용자 ID로 확인한다.

## 앱 수

무료 플랜은 앱 · 워크플로를 합쳐 10개까지다. 지금 OFFSIDE Purchase Alerts · Google Calendar · Google Drive 3개에 이 4개를 더하면 7개다.
