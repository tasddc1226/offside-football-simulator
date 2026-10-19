<script lang="ts">
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';

  // T-11-389 서버 데이터를 기다리는 동안의 목록 뼈대(줄마다 동그라미 + 두 줄). 홈(명예의 전당)에도 들어가 첫 화면 번들에 실리므로
  // 요소 하나의 배경으로 그린다(style.css .sk-list). 0.2초 안에 끝나면 보이지 않고 자리만 잡는다. 화면 읽기 도구에는 '불러오는 중'.
  // rows: 줄 수(내용과 비슷하게). height를 주면 줄 대신 그 높이의 카드 한 장(T-11-391).
  let { rows = 3, height }: { rows?: number; height?: number } = $props();
</script>

<div class={height ? 'sk-block' : 'sk-list'} style:height="{height ?? rows * 46 - 14}px" role="status" aria-busy="true" data-skeleton>
  <span class="sr-only">{L.loading}</span>
</div>
