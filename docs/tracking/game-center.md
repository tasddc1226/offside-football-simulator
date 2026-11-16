# iOS Game Center (T-11-734)

1.1.9에서 검증하는 iOS 전용 기능이다. TestFlight 검증과 스토어 출시는 별개다.
네이티브 모듈·entitlement를 더하므로 기존 앱에 OTA만 보내서 사용할 수 없다.
현재 스토어 런타임 지문·최소/최신 버전 안내는 실제 출시 전까지 바꾸지 않는다.

## 등록 항목

| 용도 | App Store Connect ID |
| --- | --- |
| 최고 레전드 점수 | `com.offsidelab.app.leaderboard.career_legend.v1` |
| 첫 은퇴 | `com.offsidelab.app.achievement.first_retirement` |
| 첫 유럽 진출 | `com.offsidelab.app.achievement.first_europe` |
| 첫 국제대회 우승 | `com.offsidelab.app.achievement.first_national_title` |
| 첫 발롱도르 | `com.offsidelab.app.achievement.first_ballon` |

ID 정본은 `packages/contracts/src/game-center.ts`다. 순위표는 정수·최고점 유지·내림차순,
목표 달성은 숨기지 않고 한 번씩(20/30/40/50점) 부여한다. Game Center 점수는 게임 재화가 아니다.

## 기록과 계정

- `GET /v1/owner/game-center`는 세션 소유 구단주의 남아 있는 은퇴 기록을 과거 시즌까지 집계한다.
  익명 앱 세션도 지원한다. 숨김·진행 중·다른 구단주 기록을 제외한다. 순위 점수에는 기존 명예의 전당
  자격(30세 이상)을 적용한다. 짧은 커리어도 목표 달성에는 반영한다.
- 기존 `first/europe`와 같은 리그 목록, `NATIONAL_WINS`, 은퇴 요약의 발롱도르 수를 사용한다.
  구단주 인덱스와 시즌 PK를 이용하는 조회 한 번이며 R2 상세나 N+1 조회는 없다.
- 설정에서 연결을 누른 뒤에만 GameKit 인증과 기록 전송을 한다. Sign in with Apple과 별개다.
  연결 동의는 이 기기의 OFFSIDE 프로필 ID와 Game Center `gamePlayerID` 쌍에 저장한다.
  서버 로그인 수단이나 계정 병합 기능을 추가하지 않는다.
- 세션이 바뀌거나 연결을 끊으면 진행 중 응답을 무시하고 다시 연결하도록 한다. Game Center 플레이어가
  바뀌어도 자동으로 다른 계정에 보내지 않는다. 이미 Apple에 보낸 최고점·완료 업적은 연결 해제로 지워지지 않는다.
- 명시적으로 열 때 60초 메모를 쓰고, 은퇴 업로드 성공 알림에서만 무효화한다. 주기 조회는 없다.
  전송 도중 새 업로드가 완료되면 한 번 더 동기화한다. 백그라운드에서는 로그인 UI를 띄우지 않는다.
- Game Center 오류는 기록 전송·설정 상태에만 남는다. 게임 저장·은퇴 업로드·광고 흐름을 막지 않는다.
  새 모듈이 없는 옛 iOS 런타임과 Android에서는 설정 카드와 연동을 사용하지 않는다.

## TestFlight 확인

1. 기존 앱을 삭제하지 않고 1.1.9로 업데이트한다. 진행 중 커리어·은퇴 기록이 유지되는지 확인한다.
2. 설정 → Game Center 연결. 취소해도 게임을 계속할 수 있고, 다시 연결할 수 있어야 한다.
3. 순위표·목표 달성을 각각 열어 등록한 순위표와 네 목표가 표시되는지 확인한다.
4. 저장된 은퇴 기록의 최고점·발롱도르·유럽 진출·국제대회 우승이 조건대로 반영되는지 확인한다.
   짧은 커리어는 첫 은퇴 목표만 반영될 수 있으며 순위 점수를 만들지 않는다.
5. 새 은퇴 기록을 서버에 올린 후 점수가 갱신되는지 확인한다. 오프라인 실패 후 다시 연결하면 재시도할 수 있어야 한다.
6. Game Center 계정 변경과 OFFSIDE 로그아웃/계정 변경 후 다른 계정으로 자동 전송되지 않는지 확인한다.
7. 작은 화면·큰 글자·다크 모드에서 버튼과 오류 안내가 잘리지 않는지 확인한다. Game Center 자체 표시 언어는
   Apple 계정/기기 설정을 따른다. OFFSIDE 설정 문구는 ko/en/ja/zh를 제공한다.

실기기 확인 결과를 받기 전에는 GameKit 동작 검증이나 스토어 출시를 완료로 기록하지 않는다.
