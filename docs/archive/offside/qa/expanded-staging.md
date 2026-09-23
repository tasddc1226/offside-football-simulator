# Expanded QA 실서버 리허설 — 2026-09-05

## 실행 대상과 결과

- 배포 커밋: `36cc9c5bb79cee456381ab98d5fe407f8693e06e` (PR #95).
- [확장 배포 실행](https://github.com/tasddc1226/offside-football-simulator/actions/runs/33966826212): 성공.
- [웹](https://offside-web-expanded.tasddc1569.workers.dev),
  [서비스 시즌 응답](https://offside-api-expanded.tasddc1569.workers.dev/v1/service-seasons/current).
- 실제 응답: `svc_phase34_qa`, `PHASE 3+4 QA`, `PRESEASON`, `isTest: true`,
  ruleset `1.0.0`, content pack `0.3.0`.
- 기존 `e2e:staging`을 expanded profile, Chromium 360×780, worker 1, retries 0으로 **한 번** 실행했다.
  API 스텁·Snapshot 주입·DEV seed 강제 없이 새 QA 커리어 두 개로 진행했다.

| 검사 | 결과 | 실제 관찰 |
| --- | --- | --- |
| 서비스 시즌 manifest / 허용 CORS | 통과 | id·이름·버전·테스트 여부 일치 |
| FAST 생성 → 첫 계약 → 한 시즌 → 결산 | 통과 | 이벤트 제목: `이적 이야기가 들려옵니다` |
| CHAPTER 생성 → 첫 계약 → 한 시즌 → 결산 | 통과 | 이벤트 제목: `어떤 말을 남길까요?`, `커리어의 갈림길` |

총 3개 통과, 약 1.1분. 개별 흐름은 약 32초이며 분석 큐 대기 12초를 포함한다.
이는 자동화 시간이지 사람의 플레이 시간·콘텐츠 분량·재미에 대한 판정이 아니다.
ego 브라우저에서도 온보딩과 동일 서비스 시즌 응답을 확인했다. 360px 온보딩의 가로 overflow는 없었다.

## 데이터와 한계

| 모드 | 생성한 QA careerId |
| --- | --- |
| FAST | `18db9548-7a61-4fcd-89b9-4139d68e3493` |
| CHAPTER | `783ebc6c-1d7e-40a3-b0eb-dade049af193` |

- 복구 코드 발급은 실제 API를 사용했으며 원문은 로그·문서에 남기지 않았다.
- 기존 사용자 기록과 위 QA 기록 모두 삭제하지 않았다. 로컬 원격 D1 읽기는 자격증명 미설정으로
  실행되지 않았다. 최종 서버 revision·버전 행 검사 및 QA 데이터 정리는 미완료로 남긴다.
  CI secret을 추출하거나 새 토큰/권한을 추가하지 않았다.
- 분석 `clientId`는 두 흐름 모두 미확보다. 분석 이벤트의 DB 적재나 실제 플레이 시간 계측 성공을
  이 실행만으로 주장하지 않는다.
- CHAPTER 모드 시즌 완주가 모든 핵심 경기 챕터 또는 희귀 이벤트 전수 도달을 뜻하지 않는다.
  대표팀·부상·해외 확장 전체 경로, 실계정 Google 연결, 다른 기기 복구는 별도 검증이다.
- `playtested: false`/PROTOTYPE의 콘텐츠 출시 판정과 일반 staging/production 기본 팩은 바꾸지 않았다.
- 이 배포는 #91·#92 이전 커밋이다. 이번 결과를 두 PR의 수정 후 배포 검증으로 재사용하지 않는다.

## 발견 사항 및 후속

- [#101](https://github.com/tasddc1226/offside-football-simulator/issues/101): 실제 시즌은 PHASE 3+4 QA지만
  온보딩의 공용 안내가 `LINE TEST 시즌입니다.`로 고정됐다. 데이터 오류가 아닌 표시 혼선이다.
- #91은 전체 CI·프리뷰 성공 후 main `47a0f64`에 병합했다. #92는 해당 main을 통합한 새 head로
  CI를 다시 확인한다. 이후 최신 main을 expanded에 배포해 수정 화면을 확인하되, 불필요하게
  새 커리어를 반복 생성하지 않는다.
- Phase 5는 사용자 재개 지시에 따라 별도 Draft #77에서 밸런스 재설계 중이다. 이 QA 통과를
  Phase 5 완료나 참조집단 발행 근거로 사용하지 않는다.
