import { hydrate, mount } from 'svelte';
import './style.css';
import App from './ui/App.svelte';
import Sheet from './ui/Sheet.svelte';
import Toast from './ui/Toast.svelte';
import { loadGame, syncBalance } from './ui/boot.js';
import { handleOAuthReturn } from './ui/login.js';
import { hasSessionHint } from './api/client.js';
import { routeSharedCareer } from './ui/legend.js';
import { watchOwnerConflicts } from './ui/ownerConflict.js';
import { installClickSound } from './ui/sfx.js';
import { watchForUpdates } from './ui/update.svelte.js';

installClickSound();
loadGame();
// OAuth 복귀는 세이브를 읽은 뒤에 처리한다 — 돌아갈 곳이 로컬 명예의 전당 선수일 수 있고, loadGame이
// 옛 은퇴 선수에 커리어 id를 붙인다(ft_hof).
handleOAuthReturn();
routeSharedCareer();
syncBalance();

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

// T-10-010: 클럽 커스텀을 계정과 맞춘다. 세션이 있었던 기기만 — 첫 방문자는 로컬 모드 그대로다(T-10-037).
if (hasSessionHint())
  void import('./ui/clubCustom.svelte.js').then((m) => m.syncClubCustom()).catch(() => {});
// T-10-013: 다른 계정 소유 커리어 알림은 첫 flush 전에 듣기 시작한다.
watchOwnerConflicts();
// T-10-023: 열어 둔 탭이 새 배포를 알아채면 새로고침 배너를 띄운다.
watchForUpdates();
// T-10-021: 모바일 브라우저로 홈 화면을 열면 '홈 화면에 추가' 안내를 띄운다('다시 보지 않기' 전까지).
void import('./ui/install.js').then((m) => m.maybeShowInstallOnboarding()).catch(() => {});
// T-9-009: 이전 세션에서 못 보낸 업로드를 앱 시작 시 한 번 재시도한다(실패해도 게임은 계속된다).
void import('./game/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
