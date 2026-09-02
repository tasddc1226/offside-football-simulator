# ADR-006. 서비스명 표기와 도메인

- 상태: 확정 (2026-09-02). 도메인 가용성 확인은 사용자 액션으로 남김
- 관련: [브랜드 가이드](../development/12-brand-guidelines.md), [ADR-007](ADR-007-hosting-and-infra.md)

## 결정

| 항목 | 선택 |
|---|---|
| 워드마크 | `OFFSIDE` |
| 정식 서비스명 | `OFFSIDE: Football Career` / `오프사이드 커리어` |
| 앱 표시명 (탭 제목, PWA) | `OFFSIDE` |
| 도메인 등록 | 사용자가 직접 구매. 등록기관은 Cloudflare Registrar 우선(원가 판매, DNS와 같은 콘솔). Cloudflare가 지원하지 않는 TLD면 다른 등록기관에서 사고 네임서버만 Cloudflare로 옮긴다 |
| DNS | Cloudflare. 프록시(오렌지 구름) ON |
| 서브도메인 | 루트 = 웹 앱, `api.` = Workers, `preview.`·`staging.` = 검증 환경, `content.`는 쓰지 않고 웹 앱 경로 `/content/`로 서빙 |
| 인증서 | Cloudflare Universal SSL. 별도 구매 없음 |
| 이메일 | 도메인 메일은 초기에 만들지 않는다. 문의는 GitHub Issues와 Google 계정. 앱인토스 고객문의 이메일도 같은 주소 |
| 앱인토스 앱 이름 | 한글 `오프사이드 커리어`, 영문 `OFFSIDE Career`(15자 이내 명사형, 콘솔 규칙) |
| 앱인토스 `appName` | 후보 `offside`, `offside-career`. 한 번 등록하면 변경 불가이며 CORS origin과 딥링크 `intoss://<appName>`에 쓰인다. 사용자가 등록 시 확정 |
| 앱인토스 제작자 이름 | 후보 `오프사이드 스튜디오` 등 10자 이내, 한글·영문·숫자만. "토스" 포함 금지 |

## 도메인 후보

가용성은 확인하지 않았다. 사용자가 등록 시점에 확인한다.

| 후보 | 메모 |
|---|---|
| `offside.football` | 브랜드와 TLD가 한 문장. `.football` TLD 연간 비용이 `.com`보다 높음 |
| `offsidecareer.com` | 정식 서비스명과 일치, 가장 무난 |
| `playoffside.gg` | 게임 느낌, 짧음 |
| `offside.kr` | 한국 사용자 대상이면 자연스러움. Cloudflare Registrar 미지원이므로 국내 등록기관 사용 |

선택 기준: 짧고 한글 발음이 명확하며, 워드마크 `OFFSIDE`와 정식명 중 하나를 그대로 담을 것.

## 상표

"OFFSIDE"는 일반명사이며 축구 관련 서비스에 이미 여러 사용례가 있을 가능성이 높다. 상표 등록은 시도하지 않는다. 정식 서비스명과 도메인으로 식별성을 확보한다. 다른 서비스의 로고·표기를 모방하지 않는다.

## 결과

- 브랜드 가이드의 체크리스트 "ADR-006 상표·도메인 가용성 확인"은 도메인 구매 완료 시 닫는다.
- 도메인이 정해지면 ADR-007의 환경 표와 wrangler 설정의 `routes`를 채운다.
