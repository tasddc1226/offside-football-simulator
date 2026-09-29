<script lang="ts">
  // T-10-130 상단 '← 홈'·'← 구단주' 같은 버튼 대신 화면 아래에 고정된 '← 이전으로' 하나. 앱 안에서 쌓은 이전 기록이
  // 있으면 브라우저 뒤로 가기와 똑같이 돌아가고, 없으면 fallback으로 간다.
  import ActionBar from './ActionBar.svelte';
  import { goBack } from './history.svelte.js';

  const { act, fallback, atBottom = true }: { act: string; fallback: () => void; atBottom?: boolean } = $props();
</script>

<ActionBar {atBottom} data-back-bar>
  <button class="btn btn-block" data-act={act} onclick={() => goBack(fallback)}>← 이전으로</button>
</ActionBar>
