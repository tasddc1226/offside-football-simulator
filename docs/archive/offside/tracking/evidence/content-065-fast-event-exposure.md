# FAST 사건 노출 교정 근거 — ruleset 1.7.1 / content 0.6.5

검증 기준: `eb95aeff12b0136339003328df692c7fe2c69cac`의 운영 pair `1.7.0/0.6.4`에서
새 커리어는 FAST로 고정되지만 모든 EVENT 슬롯이 optional이라 `isOpenableInFastMode`에서 제거됐다.
root가 한 번도 열리지 않으므로 EVT-*-121/122 후속도 시작할 수 없었다. 운영 UI 자연 플레이에서도
동일 pair로 17시즌(만 36세) 동안 새 root가 0회였다는 coordinator 관찰이 있다. 이 문서는 배포 완료
증거가 아니라 교정 PR의 결정론적 로컬 검증 범위다.

## 변경 경계

- `1.7.1`은 `1.7.0` 복사본에서 version과 step 4·5 EVENT `required`만 바꾼다.
- `0.6.5`는 `0.6.4`의 이벤트·챕터·narrative를 바이트 동일하게 복사하고 호환 pair만 바꾼다.
- 성장, 은퇴, Legacy 1.2, 대표팀, 리그 원장 정책과 모든 과거 version 파일은 그대로 둔다.
- EVENT 슬롯 두 개만 FAST에서 추가로 열릴 수 있으므로 실제 일반 선택 증가량은 시즌당 `+0..2`다.

## 자연 진행 다중 seed 표본

테스트는 state 조작이나 `season:null` PRO fixture 없이 각 seed마다 `CREATE_CAREER` → 두 단계 선수 입력
→ `CONFIRM_PLAYER` → onboarding 사건/첫 계약 → `START_SEASON(FAST)` → 역할 결정 → 실제 경기 진행을
재생한다. 모든 ADVANCE에 실제 `selectChapterCandidates` 결과를 전달하고 step 3 MAJOR 챕터도 팩의 실제
결정/선택지/outcome으로 `RESOLVE_CHAPTER`한 뒤 step 4로 진행한다. 고정 seed 96개(W 64, GK 32)의
결과는 다음과 같다.

| 항목                                       |             결과 |
| ------------------------------------------ | ---------------: |
| W root 노출                                |   36/64 (56.25%) |
| GK root 노출                               |      16/32 (50%) |
| 전체 root 노출                             | 52/96 (54.1667%) |
| step 4 root 뒤 linked follow-up 노출       |               31 |
| step 4 root 뒤 강제 부상 interruption      |                4 |
| step 5에서 처음 열린 root                  |               17 |
| root 미노출                                |               44 |
| 동일 노출 seed의 1.7.0/0.6.4 baseline root |             0/52 |

노출 root 분포는 W `EVT-MEDIA-120` 15회, `EVT-REL-120` 16회, `EVT-DEV-120` 3회,
`EVT-CON-120` 2회이며 GK는 `EVT-MEDIA-120` 14회, `EVT-CON-120` 2회다. GK 표본에는 GK 금지
조건이 있는 DEV/MATCH/MGR/REL root가 한 번도 섞이지 않았다. 대표 linked 경로는
`EVT-MEDIA-120` → `EVT-MEDIA-121`이며 같은 seed 재실행의 root snapshot hash가 동일함을 테스트가
고정한다. 신 pair에서 root를 연 52개 seed를 과거 pair로 같은 자연 경로에 다시 넣으면 root는 0회다.

최종 회귀 테스트는 병렬 부하에도 개별 timeout 안에서 끝나도록 같은 경로의 고정 표본을 W 16개와
GK 8개로 제한하고, W root 7개(MEDIA 4, REL 3), GK 허용 root 4개(MEDIA 4), linked follow-up 6개,
부상 interruption 1개, step 5 root 4개, 무노출 13개를 assertion으로 고정한다. 이 11개 노출 seed의
`1.7.0/0.6.4` baseline은 모두 root 0개다. 위 96개 표는 별도로 수행한 전체 분포 측정 결과다.

## 알려진 제한

후속 후보는 저장 queue가 아니라 timeline의 마지막 `EVENT_RESOLVED`에서 파생된다. 따라서 root가
step 5에 처음 열리면 다음 EVENT 슬롯이 없고, step 4 root 뒤 step 5 강제 부상이 먼저 열리면 부상
해소 기록이 마지막 사건이 되어 기존 후속을 덮는다. 이번 교정은 EVENT 슬롯 노출만 다루며 새 persistent
follow-up queue나 저장 마이그레이션은 포함하지 않는다.

## 회귀 게이트

- loader/schema/API/web/release registries에 `1.7.1/0.6.5`를 additive 등록한다.
- contracts와 engine-client의 리그 원장 검증은 `1.7.0`과 `1.7.1` 모두에 적용한다.
- `1.7.1/0.6.5`의 은퇴 artifact는 Legacy 1.2를 사용한다.
- 기존 `1.7.0/0.6.4`와 golden fixture 테스트로 과거 replay, 리그 원장, 은퇴 동작을 보존한다.

## 로컬 검증 결과

Node `22.23.1`에서 content validation, lint, typecheck, dependency lint, build, web bundle budget과
변경 범위의 content/contracts/engine-client/API/web/release 테스트가 통과했다. engine-client의 기존
transfer/loan replay·fork·import golden 11개도 단독 재실행에서 통과했다.

전체 `pnpm test`는 sandbox 실행에서 `tsx` IPC socket과 Wrangler log 쓰기가 `EPERM`으로 막혔고,
권한을 좁혀 재실행했을 때 병렬 부하로 기존 engine-client golden 2개가 5초 timeout을 넘겨 전체 명령은
green이 아니었다. 같은 파일을 단독 실행하면 11/11 통과했으므로 제품 assertion 실패로 분류하지 않되,
전체 명령의 실패 사실은 그대로 남긴다. 96개 자연 진행 테스트도 같은 호스트 부하 중 60초 timeout이
실제 428초 뒤 보고돼 assertion까지 도달하지 못했으며, 최종 24개 bounded test는 1.16초에 15/15
통과했다. 브라우저·staging·production 검증과 배포는 수행하지 않았다.
