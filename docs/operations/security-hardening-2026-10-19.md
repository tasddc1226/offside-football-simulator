# 보안 점검과 1차 보강 — 2026-10-19

최신 main `6bf8221b`에서 분리한 작업이다. API 요청 경계, 웹·앱 인증 흐름, 응답 캐시,
운영 의존성 그래프, 현재 Git 추적 파일을 점검했다. 운영 공격 재현·부하 주입·사용자 데이터
수정은 하지 않았다. 전체 보안 감사나 침해가 없었다는 증명으로 해석하지 않는다.

## 변경

- **본문 크기 제한**: 기존에는 `text()`로 모두 읽은 뒤 1 MiB 상한을 검사했다.
  이제 실제 수신 바이트를 스트림에서 세고 초과 즉시 취소한다. Content-Length가 없거나
  실제보다 작아도 적용한다. UTF-8 문자 경계가 청크 사이에 나뉘어도 보존한다.
  Hono 본문 캐시도 채워 스토어 알림의 후속 `req.json()` 처리를 보존한다.
- **Apple 웹 콜백**: JSON 형식의 예외만 유지하고 본문 상한은 똑같이 적용한다.
  `application/x-www-form-urlencoded`만 받아 제한된 원문에서 필드를 읽는다.
  기존 state·nonce·서명 검증 및 POST → 303 → GET 흐름은 유지한다.
- **응답 보호**: 인증·프로필·관리자 경로, 앱 세션 발급, 쿠키 발급 응답에
  `private, no-store`를 강제한다. 리다이렉트·오류도 포함한다.
  API에 `nosniff`, `Referrer-Policy: no-referrer`를 추가한다. 공개 조회의 캐시 TTL과
  지연 세션 조회는 유지하며 추가 DB 요청은 없다.
- **의존성**: Hono 4.13.5 → 4.13.7. 간접 의존성은 기존 major 안에서
  shell-quote 1.11.0, source-map-js 1.2.2, grpc-js 1.13.6,
  brace-expansion 5.0.12로 고정했다. lockfile의 무관한 업그레이드는 하지 않았다.
  현재 API는 해당 Hono 권고의 JSX SSR 기능을 사용하지 않는다. 설치 버전의 경고를
  제거한 것이며, 운영 XSS가 재현됐다는 뜻이 아니다.

본문 처리는 [Cloudflare 스트림 지침](https://developers.cloudflare.com/workers/runtime-apis/streams/)을
따랐다. Hono와 shell-quote의 수정 버전은 각각
[Hono 권고](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv),
[shell-quote 권고](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv)에서 확인했다.

## 의존성 결과와 잔여 작업

`pnpm audit --prod --json`의 권고 수다. 앱의 dependencies에 Expo 개발 도구도 연결돼
있으므로 아래 숫자를 운영 서버의 원격 취약점 수로 해석하지 않는다.

| 등급     | 변경 전 | 변경 후 |
| -------- | ------: | ------: |
| Critical |       1 |       0 |
| High     |       6 |       2 |
| Moderate |       4 |       2 |
| Low      |       1 |       0 |
| 합계     |      12 |       4 |

남은 권고:

| 패키지                     | 경로·제약                                                   | 다음 조치                                                       |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| uuid 7.0.3                 | Expo의 Xcode 프로젝트 도구. 수정 버전은 11.1.1 이상         | 상위 xcode/Expo 호환 업데이트 검증. major 강제 교체 보류        |
| decode-uri-component 0.2.2 | Expo Router → query-string. 수정 버전은 0.5.0 이상          | 상위 query-string/Router와 malformed URL 동작을 검증한 업데이트 |
| node-forge 1.4.0           | Expo 코드 서명 인증서 도구. 조회 시 수정 버전 없음          | 상위 패치 추적. 신뢰하지 않는 인증서 입력 금지                  |
| braces 3.0.3               | React Native CLI/Metro → micromatch. 조회 시 수정 버전 없음 | 상위 패치 추적. 신뢰하지 않는 glob 입력 금지                    |

위 경로는 lockfile 기준이며 설치 그래프만으로 실제 실행 가능성을 모두 배제하지 않았다.
앱 번들·실기기에서의 도달성, 서드파티 SDK 전체와 개발 의존성 전체는 별도 분석이 필요하다.

## 비밀정보 및 기존 방어

현재 HEAD를 archive해 Gitleaks로 약 34 MB를 검사했다. 후보 8건 중 7건은
런타임 생성 테스트 키 문자열(2), 의도적인 무효 Bearer 예시(1), 배포 버전 식별자(4)였다.
나머지 1건은 Android Firebase 설정의 API 키다. 키 값은 보고서에 복사하지 않았다.
[Firebase 공식 문서](https://firebase.google.com/docs/projects/api-keys)상 서비스 식별 키는
일반 서버 비밀키와 다르지만 **Google Cloud의 API·앱 제한 설정은 확인하지 못했다**.
따라서 Firebase 설정의 무조건적인 안전이나 무제한 사용 가능성을 단정하지 않는다.
전체 Git 이력, 로컬 미추적 파일, 운영 secret 값 자체는 이번 검사의 대상이 아니다.

기존 Bearer 우선/쿠키 폴백 금지, 쿠키 Secure·HttpOnly·SameSite=Lax,
Origin allowlist, 운영의 가짜 인증 차단, Google 서버 토큰 교환,
Apple 서명·audience·nonce 검증, 관리자 allowlist 검사를 확인했다.
인증 경계를 제거하거나 세션 기간·저장 형식을 바꾸지 않았다.

## 검증·배포 경계

- 스트림 상한·잘못된 Content-Type·UTF-8·본문 캐시·리다이렉트·오류 헤더 테스트 23건 통과.
- 프로필·Google/Apple 웹 로그인·앱 로그인·관리자·로그 회귀 테스트 76건 통과.
- 결제 알림·광고 제거 구매 기록 회귀 18건 통과. 서로 다른 관련 테스트 총 117건이다.
- API 타입 및 린트, 다국어 및 패키지 의존 방향 검사 통과.
- 웹 운영 빌드·번들 예산 검사 통과(138.03 KB gzip / 145 KB). 앱 타입 검사 통과.
- 공개 저장소 위생 검사 통과. 새 변경 파일도 커밋 전 다시 확인한다.
- 운영 웹과 API health는 읽기 전용 확인에서 HTTP 200이었다. 이는 새 코드가 운영에
  반영됐다는 증거가 아니다.
- 운영 배포 전이다. Cloudflare 응답 변환 규칙이 헤더를 덮어쓸 수 있으므로 배포 후에는
  실제 OAuth 리다이렉트·오류 응답의 Cache-Control/Referrer-Policy를 확인한다.
- 모바일 네이티브 빌드·실기기·OTA 검증은 하지 않았다. 다음 앱 배포 시 fingerprint와
  기존 배포 레인의 호환성을 확인한다.

릴리즈 노트는 내부 보안 보강이므로 생략한다. 롤백은 이 변경을 되돌리고 기존 배포
절차를 따른다. DB 마이그레이션·키 폐기·사용자 데이터 변경은 없다.
