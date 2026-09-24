# 2026-09-19 PR #261–#265 통합 검증

참조: #241·#242·#243·#244·#246·#247·#250·#169, SCR-007·SCR-012·SCR-015·SCR-031, ADR-002·003·004, TEST-E2E-010.

## 반영 범위

| PR                                                                        | 변경                                                         | 검증 대상 head | main squash |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------- | ----------- |
| [#261](https://github.com/tasddc1226/offside-football-simulator/pull/261) | 서사 표시·라커룸 힌트·재활 맥락                              | e71f8e4        | 0bb014b     |
| [#263](https://github.com/tasddc1226/offside-football-simulator/pull/263) | 복구 안내를 첫 계약 뒤로 이동, 시즌 시작 전 0/N 표시         | a9fed46        | 6d5527e     |
| [#262](https://github.com/tasddc1226/offside-football-simulator/pull/262) | 1.7.3/0.6.7 같은 스탯 그룹 인접 포지션 fallback·공유 preview | 765ac5a        | 15e7158     |
| [#264](https://github.com/tasddc1226/offside-football-simulator/pull/264) | 1.7.4/0.6.8 챕터 회전·베테랑 사건, contracts 왕복            | 0b9d806        | 675317a     |

각 PR은 직전 main을 병합한 뒤 검증하고 squash로 반영했다. #264는 #262의 머지 이후 main을 base로 변경했다. 버전 registry 충돌은 두 신규 pair를 모두 보존하도록 정리했으며 해당 파일들은 #264 원래 head d9da026과 동일하다. 과거 룰셋·팩 디렉터리 변경은 0건이다.

## 검증 방법

Node 22.22.1, pnpm 11.25.0. frozen install → lint → lint:deps → typecheck → content:validate → 전체 단위 → SEO → build → bundle → contrast 순으로 실행했다. 단위 테스트 범위는 그대로 두고 시스템 부하를 줄이기 위해 웹을 worker 2개로 실행했다. #264에서는 API도 기본 병렬 실행의 timeout 뒤 worker 2개로 전체 재실행했다.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm lint:deps
pnpm typecheck
pnpm content:validate
pnpm exec turbo run test --filter='!@offside/web' --concurrency=1
pnpm --filter @offside/web exec vitest run --maxWorkers=2
pnpm --filter @offside/web exec node --test scripts/seo.test.mjs
pnpm build
pnpm --filter @offside/web check:bundle
pnpm --filter @offside/ui check:contrast
```

최종 코드 head #264 `0b9d806`에서 전체 검사 통과. 최종 단위 합계 **2,913건**: domain 970, content 486, contracts 222, engine-client 110, API 230, web 672, UI 108, fixtures 45, platform 51, scripts 19. SEO 별도 통과. PR quick checks는 [#261](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35442851167), [#263](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35443491393), [#262](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35443631047), [#264](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35444178995) 모두 성공했다.

## E2E 결과와 수정

- #261 시즌 결과 PUT 응답 유실 검사가 온보딩 전환 애니메이션과 초기 로딩으로 30초를 초과했다. 그 시나리오에 reduced motion을 적용해 3회 반복 통과했다. 카운트업 검사에서는 온보딩만 모션을 줄이고 시즌 결산 전에 원래 모션으로 복구했다. 결과 화면 spec 3/3 통과. assertion 삭제나 timeout 증가는 없다.
- #263 전체 Playwright 실행: **96 passed / 14 failed / 7 skipped**. 첫 계약 뒤 이동한 복구 화면을 session-length 검사에도 반영했다. 해당 검사 2건과 SCR-015 접근성·sync(c) 재실행은 **4/4 통과**했다. 최소 조작 시간 추정 59.5초, 자동화 측정 2.367초는 실제 사용자의 플레이 시간이 아니다.
- #262: 역할 제안 접근성, 시즌 전체 진행·중복 시작 방지·다음 시즌, 결과·저장 응답 유실, 브라우저 Worker golden hash **9/9 통과**.
- #264: 챕터 판단→결과→새로고침·뒤로 가기의 RNG/revision 보존 및 Web Worker golden hash **3/3 통과**. 이 E2E는 기존 기본 pair 회귀이며, 새 pair의 회전 동작은 단위·아래 CLI 재생으로 확인했다.

전체 E2E가 녹색이라는 의미는 아니다. main c2e942e에서도 재현됐던 기존 실패 11건은 #207·#190 후속으로 남긴다.

| 기존 실패                                                       | 건수 |
| --------------------------------------------------------------- | ---: |
| app-motion: 온보딩 제목, 법적 문서 뒤로 가기, 대시보드 스와이프 |    3 |
| injury: career-12 forced pending                                |    1 |
| presentation-regressions: 이전 진로 선택지 개수 기대            |    2 |
| resilience: 재시도 배지·이전 중간 문구 기대                     |    2 |
| transfer: FREE_AGENT·LOAN_RETURN·STAY 흐름                      |    3 |

#264 API의 notices limit·retirement evaluation pin 검사 2건은 첫 기본 병렬 실행에서 5초 timeout으로 실패했다(228/230 통과). 같은 head에서 API 전체를 worker 2개로 재실행해 230/230 통과했다. 이때 검증 조건·제한 시간·코드는 바꾸지 않았다.

#197 NATIONAL_TEAM 20시즌 탐색은 #263 전체 웹 단위에서 부하성 timeout이 1회 발생했으나 같은 파일 전체를 단독 재실행해 7/7 통과했다. #262 전체 체인은 재실행 없이 통과했다. 기본 skip을 추가하거나 제한 시간을 늘리지 않았다.

## 브라우저 직접 확인

Ego의 로컬 Vite·실제 Web Worker·IndexedDB를 사용했다. 실제 뷰포트는 **400px**였으며 수동 360px 확인으로 기재하지 않는다. 자동 E2E는 저장소의 모바일 뷰포트 설정을 사용했다.

- 새 커리어 → 진로 → 첫 프로 계약 → 복구 안내 → 실패 상태 새로고침 → 계속 → 시즌 시작 전 0/12 대시보드. 성공 발급과 새로고침은 API stub을 사용하는 first-contract E2E가 검증했다.
- seed `issue-242-mf-1`, 1.7.3/0.6.7 자연 명령에서 CM→DM 제안이 발생했다. UI 수락 예고의 신뢰 +5·계약 약속 유지가 저장 결과 DM / trust 45 / ROTATION / 4000bp와 일치했고, 새로고침 뒤 진행할 수 있었다. 가로 넘침이 없었다.

## 새 콘텐츠 결정론 검사

#264 통합 head `0b9d806`에서 1.7.4/0.6.8 커리어 4개(GK·DF·MF·FW 각각 1개)를 14시즌씩, 총 56시즌 재생했다. 실패 0, 실행 8.782초. `--verify`는 seed 3개를 두 번 실행해 최종 hash를 대조하고, seed 1개를 순수 SHA-256과 Node crypto로 각각 재생해 같은 hash를 확인했다.

```sh
pnpm sim:career --ruleset 1.7.4 --pack 0.6.8 --seeds 4 \
  --seed-prefix integration-0919 --seasons 14 --position all \
  --mode CHAPTER --policy opportunity --jobs 1 \
  --out /tmp/offside-0919-264-sim --verify
```

| seed                    | 최종 stateHash                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| `integration-0919:GK:0` | `b6b6684777e411f86e08bfd326cd089b2e9c9763fe2282f059f55ced23a6290a` |
| `integration-0919:DF:1` | `a99cd9fdf49310a42af9722166bb481fdd5582d80fae12ae3eb49c81ef966831` |
| `integration-0919:MF:2` | `a24c44aa8e6748cad2ae7e0980c73be423121aa8241363b421e444272f022be0` |
| `integration-0919:FW:3` | `1ea2f549d7002547a9c2837e1a1b45fa87f2ea75ade1fe4818c2392f68dfe13a` |

최종 head에서 수행한 소규모 재생·결정론 확인이며, 전체 밸런스 분포나 자연 은퇴 검증은 아니다. 기존 개발 단계의 20~30 matched seeds 비교를 이 head에서 다시 실행한 결과로 기재하지 않는다.

## 배포 경계와 후속

#262 main의 [스테이징 run 35444157243](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35444157243)은 성공했다. 최종 코드 main `675317a`의 [스테이징 run 35444597655](https://github.com/tasddc1226/offside-football-simulator/actions/runs/35444597655)도 정적 검사·핵심 저장/재생 테스트·빌드·배포·health/UI smoke까지 성공했다.

최종 운영 읽기 확인: `/v1/health` 정상, `/v1/service-seasons/current`는 `svc_season_1`, ACTIVE, isTest=false, endsAt=null, **1.7.2/0.6.6**. 이번 세션은 Production Release를 실행하지 않았다.

1.7.3/0.6.7 및 1.7.4/0.6.8은 등록된 pair이며 운영 신규 커리어 기본값으로 활성화하지 않았다. 모든 0출전 상황의 해결이나 경기 수 보장은 아니다. 거절 시 기존 포지션·계약은 유지되므로 출전 0이 계속될 수 있고, 계약 생성의 formation slot 경고·약속 정정은 후속 범위다.

새 팩의 playtested는 false다. 강제 부상 사건 반복, POST_DEBUT 영구 태그, 추가 밸런스 표본·실사용자 측정은 남아 있다. 구현 PR 병합만으로 관련 이슈의 모든 수용 조건 또는 운영 반영을 완료로 취급하지 않는다.
