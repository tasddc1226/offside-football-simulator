<script lang="ts">
  // ui.ts toast() 포트 (134~142줄). index.html의 정적 `<div id="toast" class="toast" hidden>`에
  // 마운트되어, hidden 속성만 이펙트로 토글한다(구조는 원본과 동일하게 텍스트 노드 하나만 둔다).
  import { toastState } from './state.svelte.js';

  $effect(() => {
    const el = document.getElementById('toast');
    if (el) el.hidden = !toastState.visible;
  });
</script>

{toastState.text}
