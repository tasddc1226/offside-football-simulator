<script lang="ts">
  // ───────── 모달 시트 호스트 ─────────
  // index.html의 정적 `<div id="modal" class="modal" hidden><div class="sheet" id="sheet">` 구조를
  // 그대로 유지한다(SEO 프리렌더 스크립트가 `#app` 뒤에 이어지는 `#modal`을 정규식으로 찾는다).
  // 이 컴포넌트는 #modal에 마운트되어(main.ts) 그 자리에 `.sheet#sheet`를 다시 그리고, 부모
  // #modal의 hidden 속성과 배경 클릭-닫기 동작을 이펙트로 관리한다(원본 ui.ts의
  // `$modal.addEventListener` 포트).
  import { fly } from 'svelte/transition';
  import { closeSheet, registerSheetEl, sheetState } from './sheetState.svelte.js';
  import SheetBody from './sheets/SheetBody.svelte';
  import { sheetLabel } from './sheets/types.js';
  import { appState } from './state.svelte.js';
  import { buzz, dur } from './motion.js';

  // T-10-003: 진입/퇴장은 Svelte transition(패널: fly, 배경: opacity 클래스)이 맡는다. #modal은
  // index.html에 정적으로 있는 노드(SEO 정규식 대상)라 계속 hidden 속성으로 보이기/숨기기를
  // 하되, 퇴장 애니메이션(dur(220)ms) 동안은 hidden을 늦춰 배경이 함께 사라지게 한다.
  const SHEET_MS = 220;

  // 이 컴포넌트의 루트(display:contents) — 항상 마운트돼 있어 #modal 참조를 안정적으로 얻는다.
  let hostRoot = $state<HTMLDivElement | null>(null);
  let sheetEl = $state<HTMLDivElement | null>(null);
  let dragY = $state(0);
  let dragging = $state(false);

  // 이 시트가 "선택 필수"(이벤트·이적시장 등)가 아니라 끌어서/배경 클릭으로 닫을 수 있는지 여부.
  // 배경 클릭 닫기 조건(Sheet.svelte 원래 로직)과 동일한 기준을 스와이프-다운에도 그대로 쓴다.
  const dismissible = $derived(!sheetState.busy && !(appState.G && appState.G.pending));

  $effect(() => {
    registerSheetEl(sheetEl);
    return () => registerSheetEl(null);
  });

  $effect(() => {
    const modal = hostRoot?.parentElement;
    if (!modal) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    if (sheetState.open) {
      modal.hidden = false;
      // 다음 프레임에 클래스를 붙여야 opacity 0 → 1 트랜지션이 실제로 걸린다(같은 프레임에
      // hidden 해제 + 클래스 추가를 하면 트랜지션 없이 바로 1로 그려진다).
      requestAnimationFrame(() => modal.classList.add('modal-in'));
    } else {
      modal.classList.remove('modal-in');
      hideTimer = setTimeout(() => {
        modal.hidden = true;
      }, dur(SHEET_MS));
      dragY = 0;
      dragging = false;
    }
    return () => clearTimeout(hideTimer);
  });

  $effect(() => {
    const modal = hostRoot?.parentElement;
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

  function clickButton(b: { fn: () => void }) {
    buzz();
    b.fn();
  }
</script>

<!-- display:contents인 안정된 래퍼: #modal(정적 DOM, index.html)의 자식 위치를 유지하면서도
     {#if}로 조건부 마운트되는 .sheet와 별개로 hostRoot 참조를 항상 얻을 수 있게 한다. -->
<div class="modal-host" bind:this={hostRoot}>
  {#if sheetState.open}
    <div
      class="sheet"
      class:dragging
      id="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={sheetState.view ? sheetLabel(sheetState.view) : undefined}
      tabindex="-1"
      bind:this={sheetEl}
      style={dragY ? `transform:translateY(${dragY}px)` : undefined}
      transition:fly={{ y: 60, duration: dur(SHEET_MS) }}
      ontouchstart={onTouchStart}
      ontouchmove={onTouchMove}
      ontouchend={onTouchEnd}
      ontouchcancel={onTouchEnd}
    >
      <div class="sheet-handle" aria-hidden="true"></div>
      {#if sheetState.view}<SheetBody v={sheetState.view} />{/if}
      {#each sheetState.buttons as b, i (i)}
        <button class="btn {b.cls || ''} btn-block" data-sheet={i} onclick={() => clickButton(b)}>{b.label}</button>
      {/each}
    </div>
  {/if}
</div>
