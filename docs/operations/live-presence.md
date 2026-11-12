# 홈의 현재 접속 수

홈의 `현재 접속 중`은 로그인·비로그인 구분 없이 활성 웹·앱의 WebSocket 연결을 센다.
홈뿐 아니라 게임의 다른 화면도 포함한다. 웹 문서가 숨겨지거나 앱이 백그라운드로 가면
기존 공용 소켓을 닫는다. 기기 저장소의 `offside.live-client`로 같은 브라우저의 탭을 합친다.
계정 단위 사람 수는 아니다. 다른 브라우저·기기는 각각 세며, 저장소가 차단된 환경이나
식별자를 아직 보내지 않는 구버전은 연결별로 센다. 식별자는 세이브·복구 대상에 포함하지 않는다.

`apps/api/src/live/hub.ts`의 기존 LiveHub가 집계한다. 연결 시각과 식별자를 WebSocket
attachment에 두고, 자동 pong 시각을 읽어 hibernation 뒤에도 복원한다. 45초 간격 핑에
90초간 응답이 없으면 제외한다. DB 하트비트 쓰기, 세션 조회, 새 타이머·폴링은 추가하지 않는다.
기존 허브의 5,000개 소켓 한도는 유지한다. 더 큰 규모가 필요하면 허브 분할과 집계를 함께 설계해야 한다.

입장·퇴장 때 `presence` 메시지로 숫자를 갱신한다. 갑작스러운 네트워크 단절은 90초 만료 후
다음 집계에서 반영된다. `GET /v1/live`는 기존 60초 엣지/클라이언트 캐시와 홈 갱신을
복구 경로로 사용하므로, 이 경로만 쓸 때는 캐시와 갱신 간격만큼 추가로 늦을 수 있다.
자동 핑에는 객체를 깨우거나 D1을 기록하지 않는다.

`stats.online`은 확인된 0과 조회 불가(null)를 구별한다. 구버전 응답은 이 필드가 없으므로
새 화면은 접속 수 칸을 숨긴다. `playing`은 구버전 숫자 계약을 위한 호환 필드이며, 새 화면은
읽지 않는다. 종전의 최근 20분 커리어 행 수 조회는 제거했다. 오늘 시즌·새 선수·은퇴 집계와
피드는 그대로다. 새 화면은 서버 시각으로 GET과 소켓을 합쳐 늦게 온 캐시가 새 숫자를 덮지 않게 한다.

검증 진입점은 API의 `routes/liveSocket.test.ts`·`routes/live.test.ts`, 공용
`api/liveSocket.test.ts`·`homeLive.test.ts`, 웹 `e2e/home-live.spec.ts`다.
실기기 확인은 Expo export와 별개다. 운영 확인은 DB 쓰기 없이 제한된 WebSocket 연결로
증감을 확인한 뒤 반드시 연결을 닫는다.

## 배포 직후의 버전 전환

Cloudflare는 활성 Durable Object의 코드 교체를 기본 최대 300초까지 미룬다. 새 API가 먼저
나가도 허브는 잠시 이전 버전일 수 있다. 새 `presence()` RPC가 없는 이 구간은 `online: null`로
처리하고, 옛 시즌 활동 수나 0명으로 대체하지 않는다. 기존 소켓도 새 `presence` 메시지를
바로 받지 못할 수 있으므로 버전 전환 후 새 연결과 다음 캐시 갱신을 확인한다.
[공식 코드 업데이트 문서](https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/).

`v2026.11.12.12`의 운영 배포에서도 API는 18:16 KST에 반영됐고, 당시 허브는 16:38에
만든 이전 Worker 버전이었다. 18:21 이후 정상 집계로 전환됐다. 배포 실패로 판단해 허브를
강제 재시작하거나 설정을 바꾸기 전에, API와 Durable Object의 실제 실행 버전부터 비교한다.

운영 접속 검사(18:21:55 KST)는 같은 식별자 연결 추가 `53 → 53`, 다른 식별자 추가
`53 → 54`, 다른 접속 해제 `54 → 53`, 중복 탭 해제 `53 → 53`을 확인했다. 자동 pong도
확인했고 검사 연결을 모두 닫았다. 운영 웹 화면의 숫자도 실제 소켓 응답과 일치했다.
앱 OTA 10개 경로의 게시 ID와 공개 manifest ID가 모두 일치했다. 이 검사는 네이티브
실기기 화면·복귀 동작을 증명하지 않는다(당시 iOS/Android 테스트 기기 없음).

- [구현 PR #1154](https://github.com/tasddc1226/offside-football-simulator/pull/1154)
- [운영 배포 실행](https://github.com/tasddc1226/offside-football-simulator/actions/runs/43189699271)
- [배포 커밋 d93a9cdf](https://github.com/tasddc1226/offside-football-simulator/commit/d93a9cdfb4d1e8a0b4b5a25c8513a997a87b8fe0)
