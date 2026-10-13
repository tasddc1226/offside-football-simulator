<script lang="ts">
  import { CAREER_TROPHY_PATH, type CareerTrophy } from '@offside/app-core/career-trophy';
  let { art, size = 48 }: { art: CareerTrophy; size?: number } = $props();
</script>
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d={CAREER_TROPHY_PATH[art]} fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>
