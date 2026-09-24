<script lang="ts">
  // ───────── 모달 시트 호스트 ─────────
  // index.html의 정적 `<div id="modal" class="modal" hidden><div class="sheet" id="sheet">` 구조를
  // 그대로 유지한다(SEO 프리렌더 스크립트가 `#app` 뒤에 이어지는 `#modal`을 정규식으로 찾는다).
  // 이 컴포넌트는 #modal에 마운트되어(main.ts) 그 자리에 `.sheet#sheet`를 다시 그리고, 부모
  // #modal의 hidden 속성과 배경 클릭-닫기 동작을 이펙트로 관리한다(원본 ui.ts의
  // `$modal.addEventListener` 포트).
  import { busyAnim, closeSheet, registerSheetEl, sheetState } from './sheetState.svelte.js';
  import { appState } from './state.svelte.js';

  let sheetEl = $state<HTMLDivElement | null>(null);
  let dragY = $state(0);
  let dragging = $state(false);

  // 이 시트가 "선택 필수"(이벤트·이적시장 등)가 아니라 끌어서/배경 클릭으로 닫을 수 있는지 여부.
  // 배경 클릭 닫기 조건(Sheet.svelte 원래 로직)과 동일한 기준을 스와이프-다운에도 그대로 쓴다.
  const dismissible = $derived(!busyAnim && !(appState.G && appState.G.pending));

  $effect(() => {
    registerSheetEl(sheetEl);
    return () => registerSheetEl(null);
  });

  $effect(() => {
    const modal = sheetEl?.parentElement;
    if (!modal) return;
    modal.hidden = !sheetState.open;
    if (!sheetState.open) { dragY = 0; dragging = false; }
  });

  $effect(() => {
    const modal = sheetEl?.parentElement;
    if (!modal) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === modal && dismissible) closeSheet();
    };
    modal.addEventListener('click', onClick);
    return () => modal.removeEventListener('click', onClick);
  });

  // 스와이프-다운으로 닫기: 필수 선택지가 있는 시트(이벤트/이적시장 등)에서는 동작하지 않는다
  // (dismissible === false). 드래그 핸들이나 시트 상단 여백에서 시작한 터치만 처리해, 내부
  // 스크롤 영역(예: 타임라인 리스트)의 제스처와 충돌하지 않게 한다.
  let startY = 0;
  let startedAtTop = false;
  function onTouchStart(e: TouchEvent) {
    if (!dismissible || !sheetEl) return;
    startY = e.touches[0]!.clientY;
    startedAtTop = sheetEl.scrollTop <= 0;
    dragging = true;
  }
  function onTouchMove(e: TouchEvent) {
    if (!dragging || !startedAtTop) return;
    const dy = e.touches[0]!.clientY - startY;
    if (dy > 0) {
      dragY = dy;
      e.preventDefault();
    }
  }
  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 90) closeSheet();
    dragY = 0;
  }
</script>

<div
  class="sheet"
  class:dragging
  id="sheet"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  bind:this={sheetEl}
  style={dragY ? `transform:translateY(${dragY}px)` : undefined}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchEnd}
>
  <div class="sheet-handle" aria-hidden="true"></div>
  <!-- sheetState.html은 앱 코드(actions.ts/sheetState.svelte.ts)가 직접 조립하는 신뢰된 마크업이다.
       사용자 입력(선수 이름 등)은 game/dom.ts의 esc()로 이미 이스케이프해 끼워 넣으므로 원본
       ui.ts의 innerHTML 대입과 동일한 신뢰 경계를 유지한다. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html sheetState.html}
  {#each sheetState.buttons as b, i (i)}
    <button class="btn {b.cls || ''} btn-block" data-sheet={i} onclick={b.fn}>{b.label}</button>
  {/each}
</div>
