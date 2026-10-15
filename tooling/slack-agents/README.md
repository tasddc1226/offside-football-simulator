# 슬랙 에이전트 앱 manifest (ADR-015)

[ADR-015](../../docs/adr/ADR-015-slack-agent-team.md)의 역할 에이전트 네 개를 Offside-Lab 슬랙에 앱으로 만들 때 쓰는 설정이다. ADR의 `@ops` · `@plan` · `@dev` · `@mkt`는 슬랙에서 한국 축구 레전드 이름으로 보인다(T-11-281): 운영 이운재(골문 지키기), 기획 박지성(경기 전체 읽기), 개발 손흥민(마무리), 마케팅 안정환(방송). 슬랙 봇 표시 이름은 한글을 받지 않아 로마자(`@Lee Woon-jae` …)로 두고, Worker가 글을 올릴 때 `username`으로 한글 이름(`이운재 · 운영` …)을 붙인다(`chat:write.customize`). 넘기기 줄(`→ @ops:`) · 이벤트 주소 · 비밀값 이름은 역할 키 그대로다.

| 파일                  | 앱 이름         | 봇 이름         | 역할에만 더한 권한                                                                           |
| --------------------- | --------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `manifests/ops.yaml`  | 이운재 · 운영   | `Lee Woon-jae`  | `files:write`(점검 화면), `groups:history` · `groups:read`(비공개 `#offside-purchases` 읽기) |
| `manifests/plan.yaml` | 박지성 · 기획   | `Park Ji-sung`  | 없음                                                                                         |
| `manifests/dev.yaml`  | 손흥민 · 개발   | `Son Heung-min` | `files:write`(화면 확인 스크린샷)                                                            |
| `manifests/mkt.yaml`  | 안정환 · 마케팅 | `Ahn Jung-hwan` | `files:write`(문구 · 이미지 초안)                                                            |

네 앱 공통 권한은 멘션 받기(`app_mentions:read`), 참여한 공개 채널 읽기(`channels:history` · `channels:read`), 글쓰기(`chat:write` · 작성자 이름 `chat:write.customize`), 운영자 DM(`im:history` · `im:write`), 진행 표시 이모지(`reactions:write`), 운영자 확인(`users:read`)이다. 채널 만들기 · 초대 · 관리자 권한은 주지 않는다. 채널에는 운영자가 직접 초대한다.

## 한글로 부르기 · 프로필 사진 (2026-10-15, T-11-283)

- **한글로 부르기.** 슬랙 멘션 자동완성은 봇의 영어 표시 이름만 찾는다. 그래서 운영자가 채널 · 스레드에 `@이운재 오늘 가입 수`처럼 한글 이름이나 역할 이름(`@운영` · `@기획` · `@개발` · `@마케팅`)을 글로 쓰면 Worker가 그 역할의 멘션으로 받는다(`message.channels` 이벤트, `env.ts`의 `ROLE_CALLS`). 다른 역할을 부른 답글에는 스레드 주인이 답하지 않는다. 에이전트 넘기기 줄도 `→ @이운재:` 꼴을 받는다.
- **프로필 사진.** 앱 아이콘은 위키미디어 공용의 자유 이용 사진을 잘라 **Basic Information → App icon**에 올렸다(저장소에는 넣지 않는다). 출처:
  - 이운재: "Suwon ACL 2009 Squad.jpg", 신유식, CC BY-SA 4.0 (2009)
  - 박지성: "Ji-Sung Park vs Fulham (cropped).jpg", Magnus D, CC BY 2.0 (2010)
  - 손흥민: "Best Footballer in Asia 2022 Son Heung-min (cropped).jpg", Ujishadow, CC BY-SA 4.0 (2023)
  - 안정환: "Ahn Jung-hwan.JPG", MSV Duisburg, CC BY-SA 3.0 (2006)

## 말투 (2026-10-15, T-11-284)

역할 설명(`apps/agents/roles/<역할>.md`)의 `## 말투`가 그 선수의 공개된 말투를 정한다. 말투는 첫 문장 · 맺음 문장에만 입히고, 보고 형식 · 수치 · 넘기기 줄 · `검토할 반응 없음`은 그대로다. 실제 선수인 척하거나 일화 · 인용을 지어내지 않는다.

| 역할                                               | 말투                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 운영 이운재                                        | 과묵 · 침착. 결론 한 문장, 책임은 자기 쪽으로("뒤는 제가 볼게요"). 골문 비유는 한 답에 한 번까지                           |
| 기획 박지성                                        | 겸손 · 담백. 수치와 근거로, 판단과 한계를 같이. 유저 반응을 존중하고 빠뜨린 곳을 챙긴다                                    |
| 개발 손흥민 (3단계에 역할 설명을 만들 때 넣는다)   | 밝고 긍정적. 동료 공을 먼저 말하고, 끝까지 마무리("PR까지 넣었어요"). 과한 감탄 · 이모지는 빼고 한 답에 한 번만 힘을 준다  |
| 마케팅 안정환 (3단계에 역할 설명을 만들 때 넣는다) | 재치 · 입담. 공지 초안은 가볍고 귀에 붙게, 운영자에게 하는 말은 능청스럽되 짧게. 유저 대상 문구는 copy-style 정본을 따른다 |

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
- **하는 일.** `#offside-alerts` 웹훅 경보(정상 복구 알림 · 24시간 안의 같은 경보 제외)와 운영자 멘션 · 그 스레드 답글을 받아 스레드에 답한다. 답 아래 줄에 턴 수 · 비용 · 그날 누적이 붙는다. 경보 첫 정리는 Haiku 5.5, 아침 보고는 Sonnet 5.5(`report_digest` 한 번으로 자료를 모은다), 운영자 지시 · 그 스레드 답글은 Opus 5.5가 한다(T-11-289). 답 아래 줄 맨 앞에 쓴 모델이 붙는다.

## 2단계: `@plan`(박지성) 연결 · 유저 반응 살피기 (2026-10-15, T-11-277)

`manifests/plan.yaml`에 이벤트 주소를 넣었다. `ENABLED_ROLES`는 `ops,plan`.

- **유저 반응 살피기.** 3시간마다 47분(cron, Haiku 5.5) 새 게임 댓글(운영 D1 읽기), 라운지 채팅(`offside-api`의 `GET /v1/internal/agents/chat`, 토큰이 맞을 때만 열린다), 디시 마이너 갤러리 `offsidegame`의 새 글 · 댓글을 모아 `@plan`에게 넘긴다. 디시는 웹훅 · RSS가 없고 Cloudflare에서 읽으면 빈 응답이 잦아, `slack-operations.yml`(매시 27분)이 `apps/agents/scripts/dc-push.ts`로 공개 목록 첫 쪽 · 새 글 · 댓글 수가 늘어난 글(한 번에 8개)을 읽어 Worker에 넣어 두고 47분에 함께 정리한다(링크는 지우고 작성자는 가명). 새 글이 없거나 웃음 · 기호뿐이면 Claude를 부르지 않고, 검토할 글(버그 의심 · 개선 제안 · 요구사항)이 없으면 슬랙에 올리지 않는다. 있으면 `#agent-desk`에 정리를 올린다. 닉네임 · 프로필 ID는 넘기지 않고 작성자 가명만 쓴다.
- **넘기기.** 에이전트 답의 줄 머리에 `→ @ops: 확인할 것`이 있으면 같은 스레드에서 그 역할이 이어 받는다(Worker 안에서 넘기고 슬랙 이벤트는 거치지 않는다). 스레드마다 6번까지. 운영자 답글은 그 스레드를 연 역할만 받는다.
- **주기 작업 보고(@ops).** 매일 08:50 KST(`50 23 * * *`) `#agent-desk`에 지난 24시간 결과와 앞으로 24시간 예정을 올린다. `schedules` 도구가 GitHub Actions 예약 워크플로(cron · 최근 결과)와 Worker cron(`offside-api` · `offside-agents`)을 모으고, Worker cron 결과는 Cloudflare MCP로 Workers 로그의 `job` 오류를 센다. 운영자가 멘션해도 같은 도구로 답한다.
- **시험 실행.** `POST https://agents.offside-lab.com/internal/run?job=reactions|report`(디시 넣기는 `dc-cursor` · `dc-push`)(헤더 `Authorization: Bearer <AGENTS_READ_TOKEN>`). `job=reactions&dry=1`은 커서를 옮기지 않고 출처별 건수 · 오류만 돌려준다.
- **비밀값 추가.** 같은 `AGENTS_READ_TOKEN`(임의 문자열)을 `offside-api`(`--env production`) · `offside-agents` Worker와 GitHub Actions 비밀값에 넣는다. 값은 채팅 읽기 토큰이자 작성자 가명의 소금이다.

## 고객 문의: `@plan`이 문의 메일 정리 · 답장 초안 (2026-10-16, T-11-291)

- **하는 일.** 매시 7분(cron) 문의 Gmail에서 `contact@offside-lab.com`으로 온 새 메일(`SUPPORT_QUERY`)을 읽어, 새 메일이 있을 때만 `@plan`(Sonnet 5.5)이 분류 · 요약해 `#agent-desk`에 올린다. 답장이 필요하면 `support_draft`가 Gmail 초안을 만들고 `#agent-approvals`에 승인 카드를 올린다. 운영자가 "승인하고 보내기"를 눌러야 보내고, "버리기"면 초안을 지운다. 운영자 지시 · 그 스레드 답글에서는 `support_recent`(최근 문의 목록) · `support_thread`도 쓴다.
- **받는 사람.** 초안의 받는 사람은 그 스레드에서 마지막으로 문의한 사람(Reply-To 우선)으로 Worker가 정한다. 모델은 주소를 고르지 못한다. 보내기 직전에 초안의 받는 사람이 처음과 같은지 다시 보고, 다르면 보내지 않는다. 마지막 메일이 우리 답이면 초안을 만들지 않는다.
- **보내는 사람.** `SUPPORT_FROM` = `오프사이드 <contact@offside-lab.com>`. Gmail "다른 주소에서 메일 보내기" 별칭(Cloudflare SMTP, DKIM 자동)과 같아야 그 별칭으로 나간다. 도메인이 DMARC p=reject라 contact@는 Cloudflare를 거쳐야 한다.
- **권한.** Google Cloud 프로젝트 `offside-agents`(게임 Google 로그인 프로젝트와 따로)의 OAuth 앱 "OFFSIDE 문의 에이전트"(외부 · 프로덕션 게시, 인증 안 받음 · 운영자 본인만 씀). 범위는 `gmail.readonly` · `gmail.compose`뿐. 테스트 상태로 두면 갱신 토큰이 7일마다 끊겨 프로덕션으로 게시했다.
- **비밀값.** `GMAIL_CLIENT_ID` · `GMAIL_CLIENT_SECRET` · `GMAIL_REFRESH_TOKEN`(Worker). 다시 연결할 때는 `apps/agents`에서 `GMAIL_CLIENT_ID=… GMAIL_CLIENT_SECRET=… node scripts/gmail-auth.ts`를 돌리고 브라우저에서 문의 Gmail로 동의한다(토큰은 화면에 찍지 않고 `wrangler secret put`으로 바로 넣는다). 클라이언트 비밀번호를 잃었으면 Google Cloud에서 클라이언트를 새로 만든다.
- **시험(2026-10-16).** 우리 도메인 주소(qa@, 답장 주소 contact@)에서 보낸 시험 문의로 초안 → 카드 → 승인 → 「오프사이드 <contact@offside-lab.com>」 발송까지 확인했다. contact@에서 보낸 메일은 Gmail이 보낸 메일로 표시해 시험 문의로 쓸 수 없다.
- **Gmail MCP.** Google 공식 Gmail MCP(`gmailmcp.googleapis.com`)는 Developer Preview(가입 승인 필요)이고 보내기 도구가 없어 쓰지 않았다. 같은 범위로 Gmail API를 Worker가 직접 부른다.

## 3단계: `@dev`(손흥민) 연결 · 승인 버튼 (2026-10-15, T-11-285)

`manifests/dev.yaml`에 이벤트 · 버튼 주소를 넣었다. `ENABLED_ROLES`는 `ops,plan,dev`. 구조는 ADR-015 인프라 절 "3단계 결정"을 본다.

- **흐름.** 운영자가 `@손흥민 …`(또는 `@개발`)으로 고칠 일을 맡긴다 → `@dev`가 지시를 정리해 `agent-dev.yml`을 띄운다 → Actions의 Claude Code가 고치고 커밋 → 고정 스크립트가 `agent-dev/<run>` 브랜치 · PR을 연다 → 스레드에 PR 링크 → CI가 끝나면 스레드에 알리고, 통과면 `#agent-approvals`에 **승인하고 머지 / 거절** 카드 → 운영자가 누르면 squash 머지. 운영 배포는 따로 한다.
- **한도.** Actions 작업 한 번 $5 · 80턴(`--max-budget-usd`, `DEV_RUN_BUDGET_USD`와 같은 값), `@dev` 하루 $20(`DAILY_BUDGET_DEV_USD`, Actions 비용 포함). 한 번에 하나씩 돈다(`concurrency`).
- **비밀값 · 설정.**
  - GitHub Actions: `ANTHROPIC_DEV_API_KEY`(Console `offside-dev-actions` 키), `AGENT_APP_PRIVATE_KEY`(GitHub App 키), 변수 `AGENT_APP_ID`. `AGENTS_READ_TOKEN`은 결과를 Worker에 알릴 때 쓴다.
  - Worker: `GITHUB_APP_PRIVATE_KEY`(같은 키를 PKCS#8로 바꾼 것, `openssl pkcs8 -topk8 -nocrypt`), 변수 `GITHUB_APP_ID` · `GITHUB_APP_INSTALLATION_ID`.
- **GitHub App `offside-dev-agent`.** 이 저장소에만 설치. 권한은 contents · pull_requests · actions 쓰기, checks · metadata 읽기. workflows 권한이 없어 `.github/workflows`를 바꿀 수 없다.
- **main 보호.** 저장소 규칙 "main 보호 (ADR-015 에이전트)": PR 없이 바꾸기 · 강제 push · 삭제 금지. 저장소 관리자는 예외라 운영자 작업 방식은 그대로다.

## 다음 단계: 다른 역할 (Worker 배포 뒤)

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
