# 13. 시각 디자인 시스템

## 목적

구현자가 원작 야구 커리어 게임의 스크린샷을 따라가지 않고 이 문서의 토큰만으로 OFFSIDE 화면을 만들 수 있게 한다. 컴포넌트 책임과 상태 계약은 [06. UI·UX 공통 계약](06-ui-ux-specification.md)을 따르고, 이 문서는 그 컴포넌트가 어떻게 보이는지만 정의한다. 모든 hex 값은 초기 기준안이며 대비 자동 검증 후 조정한다.

## DSN-DIR-001 디자인 방향

확정 방향은 **심야 경기장 방송 그래픽**이다. 야간 경기 중계의 스코어보드·오프사이드 라인·전술 보드처럼 어두운 바탕 위에 적은 수의 밝은 정보만 올리는 절제된 언어를 쓴다. 게임의 핵심이 숫자와 판단이라 중계 그래픽의 정보 위계가 그대로 맞고, 오프사이드 라인 모티프가 방송 화면에서 온 요소라 억지 없이 결합되며, 원작의 밝은 카드 스택과 명확히 갈라진다.

| 검토한 대안 | 보류 이유 |
|---|---|
| 라커룸 아날로그(종이·테이프·사물함 질감) | 질감 자산 제작 비용이 크고 통계 표와 충돌한다 |
| 전술 보드 다이어그램(화이트보드·마커) | 핵심 경기 챕터에는 맞지만 커리어 전체를 덮기엔 단조롭다 |

원작 룩 금지(MUST NOT): 오렌지·네이비 그라데이션 헤더와 카드, 둥근 흰색 카드의 세로 반복 적층, 화면마다 다른 강조색, 그림자로 만드는 위계. 위계는 배경 단계와 1px 테두리로만 만든다.

## DSN-LINE-001 오프사이드 라인

브랜드 모티프는 화면을 가로지르는 한 줄의 수평선이다.

| 속성 | 값 |
|---|---|
| 두께·색 | 모바일 2px, 데스크톱 3px, `--os-line` |
| 폭·유지 | 화면 전체 폭, 좌우 여백 없음, 전환 화면 동안 고정, 페이드 없음 |
| 등장 | 왼쪽에서 오른쪽으로 320ms scaleX 0에서 1, ease-out |
| 모션 감소 | 즉시 완성된 상태로 표시 |

등장 허용 순간은 세 개뿐이다.

| 순간 | 화면 | 브랜드 어휘 |
|---|---|---|
| 새 커리어 확정 | SCR-004 확정 직후 | KICKOFF |
| 은퇴 확정 | SCR-025 확정 직후 | FULL TIME |
| 서비스 시즌 전환 | SCR-SVC-001 | THE LINE HAS MOVED |

일반 화면의 구분선은 `--os-border`를 쓰고 `--os-line` 색은 MUST NOT 사용한다. 라인을 장식이나 로딩 표시로 재사용하지 않는다.

## DSN-COL-001 색 토큰

라이트는 `:root`, 다크는 `[data-theme="dark"]`와 `prefers-color-scheme: dark`(단, `data-theme="light"` 제외) 두 선택자에서 같은 값으로 재정의한다. 텍스트와 배경의 모든 조합은 WCAG AA 4.5:1 이상이 MUST이며, 비텍스트 그래픽(라인·게이지·아이콘)은 3:1 이상이 MUST다.

```css
:root {
  --os-bg: #F7F6F1;          /* 초크 화이트 */
  --os-surface: #FFFFFF;
  --os-surface-2: #EEECE4;
  --os-border: #D6D3C9;
  --os-text: #141A17;
  --os-text-2: #4F5A54;
  --os-accent: #F5C400;      /* 부심 깃발 옐로우, 채움 전용 */
  --os-on-accent: #0B1410;
  --os-line: #0E7C8A;        /* 오프사이드 라인 */
  --os-success: #1E7B45;
  --os-warning: #8A5A00;
  --os-danger: #B3261E;
  --os-neutral: #4F5A54;
  --os-focus: #0E7C8A;
}

:root[data-theme="dark"] {
  --os-bg: #0B1410;          /* 심야 피치, 녹색 섞인 거의 검정 */
  --os-surface: #121C17;
  --os-surface-2: #1A2620;
  --os-border: #2B3A32;
  --os-text: #F2F5F3;
  --os-text-2: #A7B3AC;
  --os-accent: #F5C400;
  --os-on-accent: #0B1410;
  --os-line: #7DF2FF;
  --os-success: #5BD98A;
  --os-warning: #FFB020;
  --os-danger: #FF6B6B;
  --os-neutral: #A7B3AC;
  --os-focus: #7DF2FF;
}
```

- `--os-accent`는 채움색으로만 쓰고 위에는 항상 `--os-on-accent` 텍스트를 올린다. 라이트에서 옐로우 텍스트는 MUST NOT.
- 화면당 강조색은 `--os-accent` 하나다. 성공·위험·중립은 색만으로 구분하지 않으며 DSN-CMP-003의 아이콘·라벨 동반 규칙이 항상 적용된다.
- 포커스 링은 `--os-focus` 2px 실선, 오프셋 2px로 모든 상호작용 요소에 MUST.

## DSN-TYP-001 타이포그래피

본문 서체는 Pretendard, 폴백은 시스템 산세리프다. 숫자를 표시하는 모든 요소는 `font-variant-numeric: tabular-nums`가 MUST다.

```css
:root {
  --os-font: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --os-tracking-display: 0.12em;
}
```

| 토큰 | 용도 | 크기 / 행간 | 굵기 |
|---|---|---|---|
| display | 브랜드 어휘 전용 | 32 / 40 | 700, 대문자, 자간 0.12em |
| h1 | 화면 제목 | 24 / 32 | 700 |
| h2 | 섹션·카드 제목 | 18 / 26 | 600 |
| body | 본문·선택 문구 | 16 / 24 | 400 |
| caption | 라벨·보조 설명 | 13 / 18 | 400 |
| num-xl | Base OVR 배지 | 48 / 52 | 700 |
| num-lg | 예상 퍼포먼스, 시즌 핵심 지표 | 28 / 32 | 600 |
| num-md | 델타(+2, −3) | 18 / 24 | 600 |
| num-sm | 표·타임라인 수치 | 14 / 20 | 500 |

- 브라우저 200% 확대에서 가로 스크롤이 생기면 안 된다. 크기는 rem, 레이아웃은 상대 단위가 MUST.
- 선수명·팀명은 한 줄 말줄임을 허용하되 전체 이름은 상세 화면과 접근성 이름에서 읽을 수 있어야 한다. 브랜드 어휘와 영문 라벨은 한국어 캡션과 같은 줄에 두지 않는다.
- 최소 본문 16px, 최소 캡션 13px. 12px 이하는 MUST NOT.

## DSN-SPC-001 간격·그리드

```css
:root {
  --os-space-1: 4px;  --os-space-2: 8px;  --os-space-3: 12px; --os-space-4: 16px;
  --os-space-5: 24px; --os-space-6: 32px; --os-space-7: 48px; --os-space-8: 64px;
  --os-radius-s: 4px; --os-radius-m: 8px; --os-touch-min: 44px;
}
```

| 항목 | 값 |
|---|---|
| 기준 최소 너비 | 360px |
| 모바일 | 단일 열, 콘텐츠 최대 640px, 좌우 여백 16px |
| 데스크톱 960px 이상 | 최대 2열(정보 / 결정), 전체 최대 1120px |
| 터치 대상 | 44×44 CSS px 이상 MUST |
| 모서리·테두리 | 카드 8px, 배지·칩 4px, 그 이상 MUST NOT. 카드는 1px `--os-border`, 그림자 없음 |

주요 CTA는 모바일에서 하단 고정이며 safe area와 가상 키보드를 피한다.

## DSN-CMP-001 PlayerHeader·StatusStrip

- PlayerHeader는 `--os-surface` 위 한 줄. 이름은 h2, 소속·나이·포지션은 caption.
- StatusStrip은 가로 스크롤 없는 고정 칸 구성이다. 각 칸은 caption 라벨 위에 num-lg 값.
- **Base OVR은 고정 배지**다. `--os-surface-2` 배경, 2px `--os-accent` 테두리, num-xl 숫자, 라벨 "기본 OVR". 애니메이션하지 않는다.
- **Expected Performance는 게이지와 고스트 숫자**다. 0~100 가로 게이지 위에 num-lg를 `--os-text-2` 색·굵기 500으로 얹고 라벨은 "이번 경기 예상". Base OVR과 같은 배지 형태로 그리는 것은 MUST NOT.
- 폼·체력·사기·전술 적합도·감독 신뢰는 게이지 없이 num-lg 값과 caption 라벨만 쓴다.

## DSN-CMP-002 ChoiceCard·ResultCard

- ChoiceCard 하나가 선택지 하나. 상단 위험 라벨, 본문 선택 문구, 하단 예상 효과 목록.
- 선택 상태는 `--os-accent` 2px 테두리와 체크 아이콘, 텍스트 "선택됨"을 함께 표시한다. 확정 CTA는 카드 밖에 하나만 둔다.
- ResultCard는 상단에 결과 등급(성공·중립·실패)을 아이콘·텍스트·색으로 표시하고, 원인 태그는 `--os-surface-2` 칩(4px)으로 표시한다. 다시 보기 동작의 라벨은 "리플레이"다.

## DSN-CMP-003 위험·델타·0 표시

| 대상 | 색 | 아이콘 | 텍스트 | 예 |
|---|---|---|---|---|
| 위험 LOW | `--os-success` | 원 | 낮음 | ● 낮음 |
| 위험 MEDIUM | `--os-warning` | 삼각 | 보통 | ▲ 보통 |
| 위험 HIGH | `--os-danger` | 느낌표 | 높음 | ! 높음 |
| 상승 델타 | `--os-success` | 위 화살 | 부호 포함 숫자 | +2 |
| 하락 델타 | `--os-danger` | 아래 화살 | 부호 포함 숫자 | −3 |
| 변화 없음 | `--os-neutral` | 점 | 0 | 0 |

- 델타는 부호·아이콘·색 세 가지를 항상 함께 쓴다. 하나만 쓰는 것은 MUST NOT.
- 확정된 0은 num 스케일의 "0"으로, 미집계는 `--os-text-2` 색의 "—"와 aria-label "미집계"로 표시한다. 두 경우의 시각이 같으면 안 된다.
- 카운트업 중인 값은 확정 전까지 `--os-text-2` 색이며 확정 시 `--os-text`로 바뀐다.

## DSN-CMP-004 SeasonTimeline·CareerTimeline·ArchiveCard

- SeasonTimeline은 단계별 점과 caption 라벨, 현재 단계만 `--os-accent` 채움.
- CareerTimeline은 세로 목록이며 사건 유형별 아이콘(DSN-ICO-001)을 앞에 두고 연도 점프를 상단 고정 세그먼트로 제공한다.
- ArchiveCard는 엔딩 타이틀을 h2로, 상위 기여 요인 3개를 caption 목록으로 둔다. Legacy 총점은 num-lg, 백분위는 표시하더라도 caption 크기의 보조 정보다.

## DSN-CMP-005 ContractComparison·CompareCards

- ContractComparison은 데스크톱에서 열 단위 표, 모바일에서는 CompareCards로 전환한다.
- **CompareCards**는 새 공통 컴포넌트다. 상단 세그먼트 컨트롤로 제안을 하나씩 넘기고, "차이만 보기" 토글을 켜면 모든 제안이 같은 값인 행을 숨긴다.
- 비교 행 순서는 역할, 전술 적합도, 출전 약속, 기간, 급여 순이 SHOULD다. 급여를 첫 행에 두지 않는다.
- 세그먼트 전환은 결정을 확정하지 않는다. 확정 CTA는 화면 하단 하나뿐이다.

## DSN-ONB-001 점진 공개

| 단계 | StatusStrip에 보이는 칸 |
|---|---|
| U18·아마추어 | 기본 OVR, 폼, 체력 |
| 첫 프로 계약 이후 | 위에 전술 적합도, 감독 신뢰, 이번 경기 예상 추가 |
| 관계 이벤트 첫 등장 이후 | 관계 요약이 PlayerHeader 보조 줄에 추가 |

열리기 전의 칸은 렌더링하지 않으며 자물쇠나 빈 자리표시자를 두지 않는다. 열리는 순간 한 번만 400ms 페이드인과 caption "새 지표: 전술 적합도"를 보여주고, 모션 감소 시 캡션만 즉시 표시한다.

## DSN-MOT-001 모션

| 항목 | 값 |
|---|---|
| 카운트업 | 800ms 이내, ease-out, 건너뛰기 버튼 필수 |
| 화면 전환 | 160ms 페이드, 슬라이드 없음 |
| 라인 등장 | DSN-LINE-001 320ms, 세 순간에만 |
| 핵심 경기 챕터 진입(SCR-031) | 스코어보드(시간·스코어·체력) 600ms 이내 등장 허용 |
| 모션 감소 | 모든 애니메이션 즉시 완료, 카운트업은 확정값 즉시 표시 |

확정값은 DOM의 data 속성과 접근성 이름에 먼저 쓰고 표시값만 애니메이션한다. `aria-live`는 확정 시 한 번만 갱신한다.

## DSN-ICO-001 아이콘

24px 그리드, 선 두께 1.5px, 채움 없음, 색은 인접 텍스트 색을 상속한다.

| 이름 | 의미 |
|---|---|
| pos-gk, pos-df, pos-mf, pos-fw | 포지션군 |
| risk-low, risk-mid, risk-high | 위험 등급 |
| injury, contract, transfer, trophy, national | 부상, 계약, 이적·임대, 우승, 국가대표 |
| rel-manager, rel-teammate, rel-fan, rel-agent | 관계 대상 |
| replay, skip | 리플레이, 연출 건너뛰기 |

## DSN-THM-001 테마

- 기본은 시스템 설정을 따른다. 설정 화면(SCR-030)에서 라이트·다크·시스템 중 하나로 고정하며 `data-theme` 속성으로 적용한다.
- 두 테마는 같은 토큰 이름을 쓰고 컴포넌트 CSS에 hex를 직접 쓰지 않는다. 공유용 최종 프로필 카드(SCR-028)는 테마와 무관하게 다크 팔레트로 고정한다.
- toss 채널은 시스템 테마 감지를 끄고 고정 팔레트(기본 다크)로 제출한다. 앱인토스 검토에서 라이트 기준을 요구하면 `data-theme="light"`로 전환만 하면 되도록 유지한다(ADR-009 위험 표).

## DSN-BRD-001 브랜드 어휘 표기

- KICKOFF, FULL TIME, THE LINE HAS MOVED는 display 토큰으로만 표기하고 바로 아래 caption 한국어 설명을 반드시 둔다.
- 일반 버튼·탭·메뉴에는 브랜드 어휘를 쓰지 않는다. 새 커리어 버튼의 라벨은 "커리어 시작"이다. 화면 단위로 새 영문 대문자 용어를 만드는 것은 MUST NOT이며 어휘 목록은 06 문서가 정본이다.

## DSN-CHN-001 앱인토스 채널 레이아웃

- 미니앱은 전체 화면이며 프레임워크가 우상단에 닫기(X) 버튼을 그린다. 위치는 `SafeArea.get()` 기준 오른쪽 `right + 10px`, 위쪽 `top + 5px`(iOS) / `top + 10px`(Android). 이 영역 위에 우리 버튼·아이콘을 두면 검토에서 반려된다. PlayerHeader의 우측 액션은 toss 채널에서 X 버튼 아래로 내린다.
- 상·하단 여백은 `SafeArea.subscribe`로 받아 `--os-safe-top`, `--os-safe-bottom` 토큰에 넣는다. web 채널은 `env(safe-area-inset-*)`로 같은 토큰을 채운다.
- 화면 방향은 세로 고정(`Screen.setOrientation`). 가로 레이아웃은 만들지 않는다.
- 토스 디자인 시스템(TDS)은 쓰지 않는다. 방송 그래픽 방향을 그대로 유지하되, 첫 화면 로딩은 800ms 안에 라인 모티프가 보여야 한다(번들 100MB 상한과 무관하게 초기 청크는 300KB 이하).
- 외부 링크는 원칙적으로 두지 않는다. 약관·개인정보 처리방침은 SPA 내부 라우트다. 불가피한 외부 URL은 `Device.openURL`로 열고 `<a target="_blank">`를 쓰지 않는다. 자사 웹·앱 설치 유도 링크는 금지다.

## 구현 체크리스트

- [ ] `tokens.css` 한 파일에 DSN-COL·TYP·SPC 토큰을 정의하고 컴포넌트는 토큰만 참조한다.
- [ ] Pretendard를 self-host하고 `font-display: swap`과 폴백 폰트 메트릭을 맞춘다.
- [ ] 모든 텍스트·배경 조합의 대비를 CI에서 자동 검사한다.
- [ ] Storybook 또는 동등한 카탈로그에 06 문서의 모든 컴포넌트와 CompareCards를 두 테마로 올린다.
- [ ] 360px·200% 확대·모션 감소 세 조건의 스크린샷 회귀 테스트를 P0 화면에 붙이고, 원작 룩 금지 항목을 디자인 리뷰 체크리스트에 넣는다.

## 자산과 미결 사항

자산: 워드마크 OFFSIDE(SVG, 라이트·다크), 파비콘(SVG와 PNG 32·192·512, 라인 모티프 단순화), 오프사이드 라인 애니메이션(CSS 전용, 외부 라이브러리 없음), 포지션·사건 아이콘 세트(SVG 스프라이트, DSN-ICO-001 목록).

앱인토스 콘솔 제출 자산(규격은 콘솔 기준): 앱 로고 600×600 PNG(정사각, 배경색 필수, 둥근 모서리 금지, 다크 모드에서도 식별), 게임 썸네일 1932×828 PNG(핵심 플레이 화면, 텍스트 최소), 스크린샷 세로 636×1048 PNG 3장 이상 또는 가로 1504×741 PNG 1장 이상. 토스 제공 아이콘·이미지는 2차 가공 포함 사용 금지.

아직 결정되지 않은 것:

- 워드마크의 최종 형태와 라인을 글자 안에 넣을지 여부.
- 일러스트 사용 여부. 현재 방향은 아이콘과 타이포만으로 구성하며 일러스트는 MAY다.
- 다크 팔레트의 녹색 기운 강도. 실제 기기 검증 후 `--os-bg`를 조정한다.
