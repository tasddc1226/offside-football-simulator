import { mount } from 'svelte';
import './style.css';
import App from './ui/App.svelte';
import Sheet from './ui/Sheet.svelte';
import Toast from './ui/Toast.svelte';
import { loadGame } from './ui/boot.js';
import { handleOAuthReturn } from './ui/actions.js';

handleOAuthReturn();
loadGame();

mount(App, { target: document.getElementById('app')! });

// index.html의 정적 `<div id="modal" ...><div class="sheet" id="sheet">...</div></div>`는 SEO
// 프리렌더 스크립트가 `#app` 뒤에 이어지는 `#modal`을 찾는 정규식 대상일 뿐, 실제 시트 마크업은
// Sheet.svelte가 다시 그린다 — 마운트 전 자리표시자 자식을 비워 중복 id="sheet"를 막는다.
const modalEl = document.getElementById('modal')!;
modalEl.innerHTML = '';
mount(Sheet, { target: modalEl });

mount(Toast, { target: document.getElementById('toast')! });

// T-9-009: 이전 세션에서 못 보낸 업로드를 앱 시작 시 한 번 재시도한다(실패해도 게임은 계속된다).
void import('./game/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
