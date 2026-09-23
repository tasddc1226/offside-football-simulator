# T-5-003 후속: 명시적 은퇴와 로컬 Archive 원자 저장

이 브리프는 로컬 은퇴 기반 통합 당시의 이력이다. 이후 승인된 한국 모듈·서버 보관·
Legacy·화면 통합은 [현재 실행 상태](../phase-5-plan.md)와
[런타임 통합 명세](../../development/19-phase5-runtime-integration.md)를 따른다.

요청: 단순 작업은 Luna에 위임하고 Phase 5 마무리.
기준 main: `3f39511`, 기존 독립 코어 커밋 `99d1121`.
마감 중 확인한 최신 main: `35a283a` (추적 보드·감사/후속 브리프 문서만 변경, 제품 코드 동일).
상태: **로컬 은퇴 기반 통합; Phase 5 전체 완료 아님.**

## 구현 계약

- `RETIRE { choice: 'RETIRE' | 'COACH_EPILOGUE' }` strict payload.
- ACTIVE/확정 선수/최소 1개 결산/활성 시즌 없음/pending 없음에서만 명시적 확정 가능.
  첫 시즌 이전·시즌 중 은퇴는 이번 경로에서 거부한다. 부분 시즌 폐기 정책은 만들지 않는다.
- 성공 시 revision +1, RETIREMENT checkpoint, RETIRED 상태, 은퇴 Timeline 항목.
  RNG·나이·속성·결산 기록은 그대로다. 코치 선택은 에필로그 표시용이며 감독 게임이 아니다.
- 나이만으로 강제 은퇴시키거나 테스트 전용 압력 계수를 운영 정책으로 승격하지 않는다.
  기존 마지막 계약/하부리그 순수 계획은 실제 계약 소비 기능과 구분한다.
- 엔진의 동일 RW 트랜잭션에 Archive/snapshot/log/career/idempotency 저장.
  중간 저장 실패는 전부 rollback. 동일 명령 재요청은 기존 결과, 다른 선택·career로
  commandId 재사용은 충돌. 새 요청에는 명령 fingerprint를 저장한다.
- 로컬 Archive는 `phase5:archive:v1:<careerId>`에 한 번만 삽입한다. 기존 내용을 덮어쓰지
  않으며 명시적 career 삭제 시 함께 제거한다. 읽기 때 소유자·정본 schema/hash·원본
  snapshot 일치 여부를 검사한다. 이는 원격 서버 인증이나 부정행위 방지 증거가 아니다.
- Registry 미설정/미등록 버전은 은퇴 저장 전 거부. 실제 manifest checksum을 참조하므로
  parsed 객체/default/Map을 재해싱한 별도 식별자와 혼용하지 않는다.
- 기존 웹 엔진에는 registry resolver와 RETIRED Timeline 라벨만 연결했다.
  사용자용 은퇴 버튼/새 화면/브라우저 UX는 이번 통합에 없다.

## 위임과 검토

Luna: 14개 엔딩·5개 밴드 표시 카탈로그, strict RETIRE 계약 테스트,
4포지션 20시즌 실제 엔진 테스트, 로컬 저장 경쟁·복구 테스트.

주 에이전트: 상태 전환, 공통 타입, 저장 원자성, 버전/원본 검증, 공유 소비처 타입 대응.
Luna가 만든 artifact 재해싱안은 기존 manifest checksum 계약과 달라 그대로 채택하지
않고 기존 registry를 참조하도록 수정했다. 기존 golden 파일은 갱신하지 않는다.

## 검증 범위와 한계

- `retire-command.test.ts`: 두 확정 선택, 상태·revision·RNG 불변, 잘못된 경계/원본 거부,
  RETIRED/ARCHIVED의 일반 명령 거부.
- `long-career.test.ts`: GK/DF/MF/FW 각 실제 20시즌, RETIRE, Archive 검증, 256 KiB
  상한. 합성 history 복제가 아니다. 성장 golden curve나 모든 사건 경로 검증은 아니다.
- `aging-curve.test.ts`: ruleset 1.0.0의 4포지션 대표 archetype, 8개 연령 지점,
  4개 능력군 명시값과 노쇠 1회 적용 회귀. 새 운영 밸런스나 모든 archetype 승인과 구분한다.
- `retirement-archive.test.ts`: 두 EngineClient/MemoryLocalStore에 동일 요청 100회,
  다른 요청 CAS, 잘못된 ID 재사용, registry 누락, 후속 저장 실패 rollback,
  새 엔진의 재시도, 다른 소유자 읽기 차단, 은퇴 후 명령 거부.
- platform `retirement-archive.test.ts`: fake-indexeddb 위 실제 Dexie 어댑터의 두 연결,
  100회 동일 요청, 서로 다른 요청 CAS, close/reopen, 실패 rollback. 3회 반복 통과.
- 서버 D1의 100회 경쟁, 원격 소유권·기기 간 복구, Legacy/ARCHIVED 원자 확정은 아직
  검증하지 않았다.

### 검증 중 발견한 Dexie 어댑터 문제

MemoryLocalStore는 통과했지만, 기존 Dexie 래퍼에서는 은퇴의 중첩 await 이후 쓰기가
원래 트랜잭션 컨텍스트를 잃어 독립 저장될 수 있었다. 두 연결의 중복 요청에서 command log
unique 충돌, 실패 rollback에서 다음 revision snapshot 잔존을 재현했다.

`createDexieLocalStore`의 scope callback을 native async 함수로 만들고 모든 테이블을
`transaction.table(...)`에 명시적으로 바인딩해 해결했다. 테스트에서 재시도로 문제를
가리거나 성공 조건을 완화하지 않았다. 기존 LocalStore 계약 테스트도 유지한다.

### 실제 브라우저 저장 검증 (2026-09-05)

`ego-browser`의 격리 작업 공간, 로컬 5195 서버, Chromium 150, 실제 IndexedDB/Dexie,
inlineSimulator로 확인했다. 실제 shipped manifest checksum과 기존 1시즌 fixture를 사용했다.

- 두 DB 연결, 동일 RETIRE 100회: 실제 확정 1회 / replay 99회.
- close/reopen 후 Archive 조회 및 revision 보존 성공.
- 강제 log append 실패: career/snapshot revision 불변, Archive/idempotency 미저장.
- 별도 생성한 UUID 테스트 DB 2개만 삭제. 기존 사용자 DB는 수정/삭제하지 않았다.
- 확인 hash: `9d60afc46c8edb542ded9a0d2feb4f116435087d046a1ef1fc74fe9cbddf5cbd`.

이 검증은 저장 경로에 대한 실제 브라우저 검증이며, Web Worker·은퇴 화면 클릭 E2E나
모바일 실기기·원격 복구 검증으로 확대 해석하지 않는다.

## 다음 완료 게이트

최종 자동 검증: 전체 패키지 테스트 10/10 성공(캐시 1개), 1분 30.7초.
domain 57파일/819개, engine-client 12파일/90개, platform 6파일/51개,
web 42파일/397개, API 27파일/181개 테스트 통과.
전체 lint/typecheck 19/19, 의존 경계 lint, 콘텐츠 checksum 검증, build 통과.
신규 소스 포맷·diff 공백·상대 문서 링크 17개도 확인했다. 기존 golden은 변경하지 않았다.

정규화에 필요한 실제 업적·관계 궤적·수입·대표팀 출전 정본과 정책 registry,
14종 실제 달성 fixture, 서버 Archive, SCR-025~028, 40,000개 참조 분포,
한국 모듈 범위 결정이 남는다. 독립 계산기/문구/이 테스트 통과로 전체 완료를 선언하지 않는다.

`35a283a`의 다른 세션 계획에는 T-4-006/008/009/010/011 및 감사 후속 T-4-012~014가
진행 중이다. 이번 수정은 해당 작업을 대체하지 않는다. 특히 후속 `simulate.ts` 통합과
대시보드 문구 병합 때에는 이 커밋의 RETIRE 분기·terminal guard·Timeline 라벨을 보존해야 한다.
