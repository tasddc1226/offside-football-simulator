# ADR-004. 규칙·이벤트 콘텐츠 포맷

- 상태: 확정 (2026-09-02)
- 관련: [이벤트 엔진](../development/04-event-engine.md), [콘텐츠 README](../content/README.md), [ADR-007](ADR-007-hosting-and-infra.md)

## 결정

| 항목 | 선택 |
|---|---|
| 포맷 | JSON. 이벤트 정의, 팀·리그 데이터, ruleset manifest 모두 JSON 파일 |
| 스키마 | `packages/content`의 Zod 스키마가 정본. 빌드와 로드 시 검증 |
| 조건 DSL | 04 문서의 JSON 연산자 트리. 스크립트 실행 없음 |
| 저작 위치 | 리포지토리 안 `packages/content/packs/<contentPackVersion>/` 와 `packages/content/rulesets/<rulesetVersion>/` |
| 빌드 산출물 | 팩 하나를 단일 JSON 번들로 합치고 `manifest.json`에 checksum·버전·호환 `clientMinVersion` 기록 |
| 배포 | 웹 Static Assets Worker의 `/content/<version>/bundle.json`. 과거 버전은 R2에 영구 보관 |
| 캐시 | 버전이 경로에 들어가므로 immutable 캐시. `manifest.json`만 짧은 캐시 |
| 문구 | narrative token(`{name:이/가}`) 규칙을 렌더러가 처리. 한국어 우선, 문자열 키는 다국어 확장 가능 |

## 검증 파이프라인

1. `pnpm content:validate`: 스키마, ID·version 유일성, 참조 무결성, outcome 가중치, cooldown, 후속 순환, 선택지 중복 문구.
2. `pnpm content:simulate`: 고정 seed로 팩을 1,000회 실행해 결정론 hash와 노출 분포 리포트를 만든다.
3. CI에서 1·2가 통과해야 팩 번들이 만들어진다. 번들 checksum이 manifest와 다르면 배포가 실패한다.

## 이유

- JSON은 에이전트가 생성·검토하기 쉽고 diff가 명확하다.
- 코드 생성 방식은 콘텐츠 변경마다 앱 배포가 필요하다. 정적 번들은 앱과 독립적으로 배포된다.
- 클라이언트가 팩을 내려받아 실행하므로(ADR-003) 서버 측 콘텐츠 API가 필요 없다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| YAML | 한국어 문장에 들여쓰기 오류가 잦고 스키마 도구가 약함 |
| TypeScript 코드로 이벤트 정의 | 타입 안전하지만 앱 배포와 결합되고 운영 CMS로 확장하기 어려움 |
| 서버 DB에 콘텐츠 저장 | 로컬 우선 실행과 맞지 않음 |

## 결과

- 종이 프로토타입의 이벤트 10개가 첫 팩 `content-pack 0.1.0`이 된다.
- `rulesetVersion`·`contentPackVersion`은 Career 생성 시 고정되며, 클라이언트는 필요한 과거 버전 번들을 내려받아 오래된 Career를 계속 실행한다.
