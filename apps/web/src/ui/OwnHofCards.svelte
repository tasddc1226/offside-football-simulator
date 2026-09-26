<script lang="ts">
  // 내 은퇴 선수(서버에 올라간 기록) 아래의 이름 공개·공유 카드. T-10-032: 짧은 커리어는 전체 명예의 전당과
  // 공유 링크에 오르지 않으므로(서버도 같은 기준으로 거른다) 두 카드 대신 안내만 한다.
  import { HOF_MIN_RETIRE_AGE, isHofEligible } from '@offside/contracts/hof-rules';
  import type { HofEntry } from '../game/types.js';
  import PublishCard from './PublishCard.svelte';
  import ShareCard from './ShareCard.svelte';

  const { h }: { h: HofEntry } = $props();
</script>

{#if isHofEligible(h.age)}
  <PublishCard {h} /><ShareCard {h} />
{:else}
  <section class="card stack" data-share="short">
    <div><div class="eyebrow">Hall of Fame</div><h2>내 선수에만 남는 기록</h2></div>
    <p class="muted" style="font-size:13px">
      만 {HOF_MIN_RETIRE_AGE}세 전에 은퇴한 짧은 커리어는 전체 명예의 전당과 공유 링크에 오르지 않고, 명예의 전당 '내 선수'에만 남습니다.
    </p>
  </section>
{/if}
