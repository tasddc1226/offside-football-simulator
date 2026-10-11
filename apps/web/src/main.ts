import './api/setup.js';
import { initializeAnalytics } from './analytics/index.js';
import { appState, randomName } from './ui/state.svelte.js';
import { hydrate, mount } from 'svelte';
import './style.css';
import { installTextSize } from './ui/textSize.js';
import App from './ui/App.svelte';
import Sheet from './ui/Sheet.svelte';
import Toast from './ui/Toast.svelte';
import SheetChrome from './ui/SheetChrome.svelte';
import { loadGame, syncBalance } from './ui/boot.js';
import { keepStorage } from './ui/helpers.js';
import { handleOAuthReturn } from './ui/login.js';
import { hasSessionHint } from '@offside/app-core/api/client';
import { routeSharedCareer } from './ui/legend.js';
import { routeFriendInvite } from './ui/friendInvite.svelte.js';
import { watchOwnerConflicts } from './ui/ownerConflict.js';
import { watchRetiredNumberAlerts, watchRetiredNumbers } from './ui/retiredNumber.svelte.js';
import { installClickSound } from './ui/sfx.js';
import { watchBgm } from './ui/bgm.svelte.js';
import { installPlaySignals } from './sync/playSignals.js';
import { watchForUpdates } from './ui/update.svelte.js';
import { watchNews } from './ui/news.svelte.js';
import { warmGame, openBoard } from './ui/nav.js';
import { NEWS_ID } from './news-id.js';
import { initHistory } from './ui/history.svelte.js';
import { installSheetKey } from './ui/skin.svelte.js';
import { applyLocale, bootLocale } from './ui/locale.js';
import { startSeasonSchedule } from '@offside/app-core/seasonSchedule';
import { detectAdLanding } from './ui/adLanding.js';

// 시즌 일정(게이지가 확정한 마감·다음 시즌): 저장해 둔 일정을 세이브·화면보다 먼저 입히고 서버 일정으로 맞춘다.
installTextSize();
startSeasonSchedule();
installClickSound();
// 자동 플레이 탐지(관찰 전용): 시즌마다 조작 횟수만 센다.
installPlaySignals();
loadGame();
// T-10-116 이어 할 세이브가 있으면 브라우저에 '영구 저장'을 요청한다(새 커리어는 첫 저장 때, helpers.save).
if (appState.G) keepStorage();
// OAuth 복귀는 세이브를 읽은 뒤에 처리한다 — 돌아갈 곳이 로컬 명예의 전당 선수일 수 있고, loadGame이
// 옛 은퇴 선수에 커리어 id를 붙인다(ft_hof).
handleOAuthReturn();
routeSharedCareer();
// T-11-098 친구 초대 링크(`/?friend=코드`)로 들어왔으면 친구 화면을 연다.
routeFriendInvite();
// 공개 소식 글의 "게임에서 보기" 링크. 형식이 맞는 글 ID만 게시판에 넘긴다.
const newsLink = new URLSearchParams(location.search);
const newsId = newsLink.get('news');
if (newsId && NEWS_ID.test(newsId)) {
  openBoard(newsLink.get('board') === 'release' ? 'release' : 'notice', newsId);
}
// T-11-195 메타 광고로 들어왔는지(분석 시작 전에 — 픽셀이 이번 탭의 클릭 ID를 쓴다).
detectAdLanding();
initializeAnalytics(appState.screen, appState.G && !appState.G.retired ? appState.G.cid : null);
syncBalance();
// T-10-114 모바일 뒤로 가기(iOS 가장자리 밀기·Android 뒤로)가 앱 안의 이전 화면으로 가게 한다.
initHistory();
// T-11-022 업무 모드 단축키.
installSheetKey();
// T-10-121 iOS Safari·Chrome은 문서에 touchstart 리스너가 없으면 터치로 :active(누름 효과)를 걸지 않는다.
document.addEventListener('touchstart', () => {}, { passive: true });

function render() {
  // T-10-041: index.html의 첫 화면은 빌드 때 넣은 App 서버 렌더 결과다(scripts/app-shell.mjs). 지우고 다시
  // 그리지 않고 hydrate로 이어받아야 첫 페인트의 제목이 LCP로 남는다. 셸이 없거나(app-shell.html) 상태가 달라도
  // Svelte가 비우고 새로 그리거나 다른 갈래만 바꿔 복구한다.
  hydrate(App, { target: document.getElementById('app')! });

  // index.html의 정적 `<div id="modal" ...><div class="sheet" id="sheet">...</div></div>`는 SEO
  // 프리렌더 스크립트가 `#app` 뒤에 이어지는 `#modal`을 찾는 정규식 대상일 뿐, 실제 시트 마크업은
  // Sheet.svelte가 다시 그린다 — 마운트 전 자리표시자 자식을 비워 중복 id="sheet"를 막는다.
  const modalEl = document.getElementById('modal')!;
  modalEl.innerHTML = '';
  mount(Sheet, { target: modalEl });

  mount(Toast, { target: document.getElementById('toast')! });
  // T-11-022 업무 모드 틀(꺼져 있으면 아무것도 그리지 않는다).
  mount(SheetChrome, { target: document.body.appendChild(document.createElement('div')) });
}

// T-11-102 한국어는 바로 그린다(셸 hydrate·LCP 그대로). 영어는 사전을 받은 뒤 그린다.
// T-11-106 처음 상태의 무작위 선수 이름은 사전보다 먼저 지어져 한국어다 — 영어면 다시 짓는다.
const locale = bootLocale();
if (locale === 'ko') render();
else
  void applyLocale(locale)
    .then(() => (appState.C.name = randomName()))
    .finally(render);

// T-10-010: 클럽 커스텀을 계정과 맞춘다. 세션이 있었던 기기만 — 첫 방문자는 로컬 모드 그대로다(T-10-037).
if (hasSessionHint())
  void import('./ui/clubCustom.svelte.js').then((m) => m.syncClubCustom()).catch(() => {});
// T-10-013: 다른 계정 소유 커리어 알림은 첫 flush 전에 듣기 시작한다.
watchOwnerConflicts();
// T-10-076: 은퇴 업로드 응답의 영구결번 심사 결과도 첫 flush 전에 듣는다.
watchRetiredNumbers();
// T-10-076: 서버 어딘가에서 영구결번이 확정되면 어느 화면에 있든 화면 위에 알린다(홈 라이브 소켓을 같이 쓴다).
watchRetiredNumberAlerts();
// 배경음악: 켜 두면 게임 화면에서만 튼다(합성기는 처음 틀 때 불러온다).
watchBgm();
// T-10-023: 열어 둔 탭이 새 배포를 알아채면 새로고침 배너를 띄운다.
watchForUpdates();
// T-10-058: 새 공지사항·릴리즈 노트가 올라오면 화면 위에 알린다.
watchNews();
// T-10-021: 모바일 브라우저로 홈 화면을 열면 '홈 화면에 추가' 안내를 띄운다('다시 보지 않기' 전까지).
void import('./ui/install.js').then((m) => m.maybeShowInstallOnboarding()).catch(() => {});
// T-9-009: 이전 세션에서 못 보낸 업로드를 앱 시작 시 한 번 재시도한다(실패해도 게임은 계속된다).
// T-11-182 탭으로 돌아오거나 다시 온라인이 될 때도 보낸다(큐가 비면 요청 없음).
const flushOutbox = () =>
  void import('./sync/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
flushOutbox();
addEventListener('online', flushOutbox);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    flushOutbox();
    syncBalance();
  }
});
// T-10-104: 게임 화면·액션·게임 시트는 첫 화면 번들 밖(지연 청크)이다. 이어 할 커리어가 있으면 첫 페인트 뒤 브라우저가
// 한가할 때 미리 받아 둬 '계속하기'를 눌렀을 때 기다리지 않게 한다(기록만 보러 온 방문자는 받지 않는다 — 새 커리어는
// 선수 생성 화면을 여는 순간 받는다, nav.goNew). index.html modulepreload에는 넣지 않는다 — 첫 화면 예산 밖.
if (appState.G && !appState.G.retired) {
  const whenIdle = window.requestIdleCallback
    ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 4000 })
    : (fn: () => void) => setTimeout(fn, 1500);
  whenIdle(warmGame);
}
