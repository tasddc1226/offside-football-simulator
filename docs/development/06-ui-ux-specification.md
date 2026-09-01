# 06. UI·UX 공통 계약

## 화면 원칙

- 한 화면에는 하나의 주된 결정만 둔다.
- 선택 전 위험·기회·영향 범위를 보여주고, 확정 후 원인을 설명한다.
- OVR 하나가 아닌 역할, 전술 적합도, 폼, 체력, 감독 신뢰를 맥락에 맞게 노출한다.
- 숫자 카운트업 애니메이션과 확정 데이터 값을 분리한다.
- OFFSIDE 브랜드 언어는 전환·결산 같은 핵심 순간에만 사용한다.

## 공통 상태

| 상태 | 표시 | 허용 동작 | 저장 |
|---|---|---|---|
| LOADING | 스켈레톤, 단계 문구 | 취소·대기 | 미적용 |
| EMPTY | 이유와 안전한 다음 동작 | 생성·복구 | 없음 |
| DRAFT | 편집 중 입력 | 수정·뒤로 | 선택적 임시 저장 |
| COMMITTING | CTA 잠금, 진행 표시 | 중복 제출 금지 | 명령 처리 중 |
| RESOLVED | 결과와 원인 | 다음·다시 보기 | 확정 |
| ERROR | 원인·재시도·복구 | 같은 명령 재시도 | 이전 확정 상태 유지 |

## 내비게이션

- 브라우저 뒤로 가기는 DRAFT 이전 화면으로 이동할 수 있다.
- COMMITTING 중 이탈 시 경고하고, 재진입 시 command 결과를 조회한다.
- RESOLVED에서 뒤로 가도 결과를 재추첨하지 않고 확정 결과를 다시 보여준다.
- 깊은 링크는 소유권과 커리어 단계가 맞지 않으면 허용 가능한 최근 화면으로 보낸다.

## 핵심 컴포넌트

| 컴포넌트 | 책임 |
|---|---|
| PlayerHeader | 선수·소속·나이·주포지션·현재 시즌 |
| StatusStrip | Base OVR, 폼, 체력, 사기, 전술 적합도 |
| ChoiceCard | 선택 문구, 위험, 예상 효과, 확정 CTA |
| ResultCard | 결과, 변화량, 이유 태그, 다음 단계 |
| SeasonTimeline | 프리시즌·리그·컵·이적시장·결산 |
| CareerTimeline | 계약·이적·부상·트로피·태그 연대기 |
| ContractComparison | 역할·기간·급여·약속·적합도 비교 |
| ArchiveCard | 선수 프로필·Legacy·서비스 시즌 배지 |

## 숫자 표시

- Base OVR 변화는 `76 → 78: 결정력 +2, 오프더볼 +1`처럼 원인을 표시한다.
- Expected Performance 변화는 Base OVR과 다른 라벨을 사용한다.
- 0은 `—`나 미집계와 구분한다.
- 잠재력은 단일 숫자 대신 정찰 범위로 노출한다.
- 포지션에 맞지 않는 통계는 숨기고 공통 지표만 유지한다.

## 브랜드 언어

| 상황 | 표현 |
|---|---|
| 새 커리어 | `KICKOFF` |
| 결과 다시 보기 | `VAR CHECK` |
| 서비스 시즌 전환 | `THE LINE HAS MOVED` |
| 선수/시즌 결산 | `FULL TIME` |

계약·부상·저장 오류처럼 오해 비용이 큰 기능은 평이한 한국어를 우선한다.

## 접근성

- 모든 입력과 선택은 키보드만으로 완료 가능해야 한다.
- 선택 카드 그룹은 fieldset/radiogroup 의미를 가진다.
- 상태 변화는 `aria-live`로 알리되 카운트업 중 반복 낭독하지 않는다.
- 색상만으로 성공·위험·변화를 구분하지 않는다.
- 모션 감소 설정에서는 카운트업·전환 애니메이션을 즉시 완료한다.
- 터치 대상은 최소 44×44 CSS px를 권장한다.

## 반응형

- 기준 최소 너비 360px.
- 모바일은 단일 열, 데스크톱은 정보와 선택의 2열까지 허용한다.
- 중요한 CTA는 가상 키보드와 safe area에 가리지 않는다.
- 긴 선수명·팀명·번역 문자열 200% 확대를 테스트한다.

## 분석 이벤트

분석은 화면 노출, 선택, 확정, 오류만 수집한다. 사용자 입력 이름이나 서사 전문을 포함하지 않는다.

```text
screen_viewed(screenId, careerPhase)
choice_previewed(eventId, choiceId)
command_submitted(commandType)
command_resolved(commandType, outcomeClass, latencyBucket)
command_failed(commandType, errorCode)
```

## 화면 정본

화면 ID, Phase 배치, 진입·이탈 계약은 [`../screens/README.md`](../screens/README.md)를 따른다.

