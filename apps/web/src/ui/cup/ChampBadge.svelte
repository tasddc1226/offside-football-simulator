<script lang="ts">
  // T-11-145 '제N회 챔피언' 배지 — 팀 프로필 팀 이름 아래와 구단주 탭 닉네임 옆. 받침대 없는 작은 금 트로피와 함께.
  import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
  import CupTrophy from './CupTrophy.svelte';

  let { edition }: { edition: number } = $props();
</script>

<span class="champ-badge" data-champ-badge><CupTrophy stage="champion" size={22} />{CL.champBadge({ n: edition })}</span>

<style>
  .champ-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px 2px 4px;
    border-radius: 999px;
    font-size: var(--fs-xs, 12px);
    font-weight: 800;
    color: var(--ink);
    white-space: nowrap;
    vertical-align: middle;
    background: color-mix(in srgb, #f6cf55 30%, var(--surface-2));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #d29a14 55%, transparent);
  }
</style>
