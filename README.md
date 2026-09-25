# OFFSIDE — 풀타임: 휘슬이 울릴 때까지

> 고3 축구선수의 한 생을 살아보는 브라우저 커리어 게임.
> 훈련을 고르고, 이벤트마다 선택하고, 이적·병역·국가대표를 거쳐 은퇴까지.

**플레이: [offside-lab.com](https://offside-lab.com)** · 릴리즈 기록: [Releases](../../releases)

## 게임 개요

- 고교 3학년에서 시작해 은퇴할 때까지 시즌 단위(프리시즌·전반기·후반기)로 진행한다.
  훈련, 선택형 텍스트 이벤트, 이적 시장, 병역(상무·특례), 국가대표(A매치·월드컵·
  아시안게임·올림픽)가 커리어를 바꾼다.
- 리그는 고교·대학·K3·K리그2·K리그1부터 J1리그·MLS·에레디비시·리그 1·분데스리가·
  세리에 A·라리가·프리미어리그까지 13개. 구단은 가상 이름을 쓴다(구단명은 유저가
  직접 바꿔 쓸 수 있다).
- 선수는 34개 세부 능력치를 갖고, 육각형 레이더와 포지션별 OVR로 요약해 보여 준다.
- 은퇴한 커리어는 명예의 전당(공개 순위)에 오른다. 공지·업데이트 게시판에는 댓글을 달 수 있다.

## 구조

게임은 전부 브라우저에서 돈다. 서버는 게임을 시뮬레이션하지 않고, 기록 보관과
공유 기능만 맡는다.

| 위치                   | 내용                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`             | Svelte 5 SPA (Vite). 게임 로직은 `src/game/*`(순수 TS, 시드 RNG를 세이브에 저장), 화면은 `src/ui/*`. 세이브는 `localStorage`. Cloudflare Workers Static Assets로 배포                      |
| `apps/api`             | Hono on Cloudflare Workers + D1(Drizzle). 익명 프로필·Google 로그인·복구 코드, 커리어·시즌 요약 적재, 명예의 전당, 공지·업데이트 게시판과 댓글, 구단명 커스텀, 서버 밸런스 설정, 운영 도구 |
| `packages/contracts`   | API 요청·응답 Zod 스키마와 밸런스 스펙(`@offside/contracts/balance`)                                                                                                                       |
| `tooling/fulltime-sim` | 헤드리스 밸런스 시뮬레이터. `apps/web/src/game/*`을 그대로 import해 대량 커리어를 돌리고 원작 풀타임 v4 기준선과 비교한다                                                                  |
| `tooling/scripts`      | 의존 방향 검사, 운영 배포 보조 스크립트 등                                                                                                                                                 |
| `docs/`                | `adr/`(아키텍처 결정), `tracking/`(보드·결정 로그), `operations/`(런북), `archive/offside/`(원작 문서, 참고용)                                                                             |

pnpm workspaces + Turborepo 모노레포. Node ≥ 22.13, TypeScript strict.

## 개발

```bash
pnpm install
pnpm db:migrate           # 로컬 D1 마이그레이션 (apps/api)
pnpm dev                  # web(vite) + api(wrangler dev)

pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build   # 머지 전 검증 체인
pnpm --filter @offside/web e2e                                              # Playwright e2e

pnpm --filter @offside/fulltime-sim sim 20000 random <tag>   # 밸런스 시뮬레이션
pnpm --filter @offside/fulltime-sim check-parity <tag>      # 원작 v4 기준선 비교
```

## 배포와 릴리즈

- PR → CI(`ci.yml`, self-hosted runner) → squash 머지 → main push가 staging에 배포된다.
- 운영은 수동 워크플로 [`deploy-production.yml`](.github/workflows/deploy-production.yml)로 배포한다.
  `preflight`(읽기 전용)로 확인한 뒤 같은 SHA로 `deploy`를 실행한다.
- 운영 배포가 성공하면 **릴리즈 태그 `vYYYY.MM.DD.N`**(KST 날짜 + 그날 순번)과 GitHub 릴리즈가
  자동으로 만들어진다. 릴리즈 노트는 직전 릴리즈 이후 머지된 PR 목록이다.
- 절차와 점검 항목: [`docs/operations/production-release.md`](docs/operations/production-release.md).

## 작업 규칙

자세한 규칙은 [`CLAUDE.md`](CLAUDE.md)와 [`AGENTS.md`](AGENTS.md)에 있다. 요점:

- 세이브 포맷을 바꾸면 기존 `localStorage` 세이브를 읽는 마이그레이션을 함께 낸다.
- 밸런스에 영향을 주는 변경은 `tooling/fulltime-sim`으로 전후를 비교한다. 운영 중 조정할
  수치는 코드 대신 운영 도구의 서버 밸런스 설정으로 바꾼다.
- 백엔드는 필요할 때만 부른다(엣지 캐시·웹 메모·세션 지연 조회).
- 작업 ID는 `T-<Phase>-<번호>`, 브랜치·PR 제목도 이 ID로 시작한다.

## 원작 OFFSIDE 아카이브

2026-09-24 Phase 9에서 원작 OFFSIDE(React + TanStack SPA, Web Worker 결정론 시뮬레이터,
콘텐츠 팩, 서버 체크포인트 동기화)를 지금의 확률·이벤트 기반 게임 **풀타임**으로 전면
교체했다([ADR-013](docs/adr/ADR-013-fulltime-replacement.md)). 원작 문서는
[`docs/archive/offside/`](docs/archive/offside/README.md)에, 원작의 마지막 main 커밋은
`offside-final` 태그에 남아 있다.
