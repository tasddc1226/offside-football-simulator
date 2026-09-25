import { mount } from 'svelte';
import './style.css';
import App from './ui/App.svelte';
import Sheet from './ui/Sheet.svelte';
import Toast from './ui/Toast.svelte';
import { loadGame, syncBalance } from './ui/boot.js';
import { handleOAuthReturn } from './ui/actions.js';
import { watchOwnerConflicts } from './ui/ownerConflict.js';
import { installClickSound } from './ui/sfx.js';

handleOAuthReturn();
installClickSound();
loadGame();
syncBalance();

// T-10-004: index.html의 정적 홈 히어로(첫 페인트용)와 noscript를 걷어 내고 앱을 마운트한다.
const appEl = document.getElementById('app')!;
appEl.textContent = '';
mount(App, { target: appEl });

// index.html의 정적 `<div id="modal" ...><div class="sheet" id="sheet">...</div></div>`는 SEO
// 프리렌더 스크립트가 `#app` 뒤에 이어지는 `#modal`을 찾는 정규식 대상일 뿐, 실제 시트 마크업은
// Sheet.svelte가 다시 그린다 — 마운트 전 자리표시자 자식을 비워 중복 id="sheet"를 막는다.
const modalEl = document.getElementById('modal')!;
modalEl.innerHTML = '';
mount(Sheet, { target: modalEl });

mount(Toast, { target: document.getElementById('toast')! });

// T-10-010: 클럽 커스텀을 계정과 맞춘다(세션이 없으면 조용히 로컬 모드).
void import('./ui/clubCustom.svelte.js').then((m) => m.syncClubCustom()).catch(() => {});
// T-10-013: 다른 계정 소유 커리어 알림은 첫 flush 전에 듣기 시작한다.
watchOwnerConflicts();
// T-10-021: 모바일 브라우저로 홈 화면을 열면 '홈 화면에 추가' 안내를 띄운다('다시 보지 않기' 전까지).
void import('./ui/install.js').then((m) => m.maybeShowInstallOnboarding()).catch(() => {});
// T-9-009: 이전 세션에서 못 보낸 업로드를 앱 시작 시 한 번 재시도한다(실패해도 게임은 계속된다).
void import('./game/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
