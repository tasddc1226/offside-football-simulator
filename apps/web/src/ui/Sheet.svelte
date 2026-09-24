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

  $effect(() => {
    registerSheetEl(sheetEl);
    return () => registerSheetEl(null);
  });

  $effect(() => {
    const modal = sheetEl?.parentElement;
    if (!modal) return;
    modal.hidden = !sheetState.open;
  });

  $effect(() => {
    const modal = sheetEl?.parentElement;
    if (!modal) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === modal && !busyAnim && !(appState.G && appState.G.pending)) closeSheet();
    };
    modal.addEventListener('click', onClick);
    return () => modal.removeEventListener('click', onClick);
  });
</script>

<div class="sheet" id="sheet" role="dialog" aria-modal="true" bind:this={sheetEl}>
  <!-- sheetState.html은 앱 코드(actions.ts/sheetState.svelte.ts)가 직접 조립하는 신뢰된 마크업이다.
       사용자 입력(선수 이름 등)은 game/dom.ts의 esc()로 이미 이스케이프해 끼워 넣으므로 원본
       ui.ts의 innerHTML 대입과 동일한 신뢰 경계를 유지한다. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html sheetState.html}
  {#each sheetState.buttons as b, i (i)}
    <button class="btn {b.cls || ''} btn-block" data-sheet={i} onclick={b.fn}>{b.label}</button>
  {/each}
</div>
