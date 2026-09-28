<script lang="ts">
  // 내 은퇴 선수(서버에 올라간 기록) 아래의 이름 공개·로그인 카드(공유 버튼은 화면 아래 ShareBar, T-10-067). T-10-032: 짧은 커리어는 전체 명예의 전당과
  // 공유 링크에 오르지 않으므로(서버도 같은 기준으로 거른다) 두 카드 대신 안내만 한다.
  import { isHofEligible, SHORT_CAREER_NOTE } from '@offside/contracts/hof-rules';
  import type { LegendView } from './state.svelte.js';
  import PublishCard from './PublishCard.svelte';
  import KeepLoginCard from './KeepLoginCard.svelte';

  // 은퇴 리포트와 같은 v를 받는다(공유 이미지가 리포트와 같은 값을 그리게). v.own이 있을 때만 그린다.
  const { v }: { v: LegendView } = $props();
  const h = $derived(v.own!);
</script>

<!-- 공유 이미지 카드는 첫 화면 번들 밖에서 불러온다. -->
{#await import('./share/ShareImageCard.svelte') then { default: ShareImageCard }}<ShareImageCard {v} />{/await}
{#if isHofEligible(h.age)}
  <PublishCard {h} /><KeepLoginCard id={h.id!} />
{:else}
  <section class="card stack" data-share="short">
    <div><div class="eyebrow">Hall of Fame</div><h2>내 선수에만 남는 기록</h2></div>
    <p class="muted fs-sm">
      {SHORT_CAREER_NOTE}
    </p>
  </section>
{/if}
