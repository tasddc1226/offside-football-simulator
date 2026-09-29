<script lang="ts">
  // T-10-130 상단 '← 홈'·'← 구단주' 같은 버튼 대신 화면 아래에 고정된 '← 이전으로' 하나(선수 상세의 아래 바와 같은
  // 자리·모양). 앱 안에서 쌓은 이전 기록이 있으면 브라우저 뒤로 가기와 똑같이 돌아가고, 없으면 fallback으로 간다.
  // 탭바가 있는 화면(기록실)에서는 탭바 위에 붙는다(atBottom=false).
  import { goBack } from './history.svelte.js';

  const { act, fallback, atBottom = true }: { act: string; fallback: () => void; atBottom?: boolean } = $props();
  let h = $state(0);
</script>

<div class="sharebar-space" style:height="{h}px" aria-hidden="true"></div>
<div class="action-bar" class:at-bottom={atBottom} data-back-bar bind:clientHeight={h}>
  <div class="action-bar-inner">
    <button class="btn btn-block" data-act={act} onclick={() => goBack(fallback)}>← 이전으로</button>
  </div>
</div>
