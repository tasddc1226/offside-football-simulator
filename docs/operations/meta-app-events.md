# Meta 앱 이벤트 (안드로이드 앱 설치 측정, T-11-563)

Meta 앱 설치 광고(광고 관리자 'JP App Promo Test')는 앱이 설치 · 실행을 Meta에 알려야 설치 수를 세고 최적화한다.
2026-10-28 점검 때 광고에 연결한 앱(비즈니스 소유 개발자 앱 'OFFSIDE Agents', `1440883941339231`)이
`app_install_tracked: false`라 노출이 0이었다. 1.1.6부터 안드로이드 앱에 Meta SDK(`facebook-core`)를 넣는다.

## 동작

- `apps/mobile/modules/meta-app-events`: 로컬 Expo 모듈(안드로이드만). `setEnabled(on)`이 SDK 자동 초기화 · 자동 이벤트를
  켜고 끈다. 처음 켤 때만 `activateApp`을 직접 한 번 보내고, 그 뒤 실행은 SDK가 스스로 보낸다.
- `apps/mobile/plugins/withMetaAppEvents.js`: 매니페스트에서 자동 초기화 · 자동 이벤트 · 광고 ID 수집을 끈 채로 시작하고,
  앱 ID · 클라이언트 토큰을 문자열 자원으로 넣는다.
- `apps/mobile/src/analytics/meta.ts`: 앱 이용 분석 동의(`nativeAnalytics`)가 `granted`인 동안만 켠다. 거절 · 철회하면 끈다.
  옛 빌드 · iOS에는 모듈이 없어 아무것도 하지 않는다(OTA 안전).
- 보내는 것: 앱 설치 · 실행(Meta 표준 이벤트), 기기 정보, Play 설치 리퍼러. 광고 ID · 게임 이벤트 · 선수 · 계정 정보는 보내지 않는다.
- iOS는 넣지 않았다(ATT를 묻지 않는 지금 방침과 맞추기 위해). iOS 설치 광고를 하게 되면 따로 검토한다.

## 출시 전에 할 일 (운영자)

1. **클라이언트 토큰**: 개발자 앱 'OFFSIDE Agents' 관리자 계정으로 앱 대시보드 → 앱 설정 → 고급 → 보안 → 클라이언트 토큰을
   복사해 EAS 환경 변수로 넣는다(저장소에 두지 않는다).
   `cd apps/mobile && npx eas-cli env:create --environment production --name OFFSIDE_META_CLIENT_TOKEN --visibility sensitive`
   토큰이 없으면 SDK가 초기화되지 않아 아무것도 보내지 않는다(빌드는 된다).
2. **앱 모드**: 같은 대시보드에서 앱이 '라이브'인지 확인한다. 개발 모드면 역할이 없는 사용자의 이벤트를 받지 않는다.
3. **Google Play 데이터 보안**: '앱 활동(앱 상호작용)', '기기 또는 기타 ID'를 '공유: Meta, 광고 · 마케팅 측정, 선택 사항(동의)'으로 고친다.
4. **1.1.6 production 빌드**(iOS · 안드로이드)를 PR 브랜치에서 만들고 `.github/scripts/ota-store-runtime.mjs`의
   `STORE_RUNTIMES`를 그 빌드의 지문으로 바꾼 뒤 머지 · 배포한다. 1.1.5 빌드는 `prepare-ota-115.mjs` 경로로 계속 OTA를 받는다.
5. 개인정보처리방침(웹 `/legal/privacy/` 8항)은 이 PR의 웹 배포로 바뀐다. 시행일을 실제 배포일로 맞춘다.

## 확인

- 테스트 기기에서 동의 → Meta 이벤트 관리자(앱 'OFFSIDE Agents') → 테스트 이벤트에 `fb_mobile_activate_app`이 들어오는지 본다.
  거절한 기기에서는 들어오지 않아야 한다.
- 출시 뒤 Graph API `/{app-id}?fields=app_install_tracked`가 `true`가 되고, 'JP App Promo Test' 캠페인을 다시 켜면
  노출 · 설치가 잡히는지 본다.
