<script lang="ts">
  // T-11-770c 은퇴 뒤 시즌 패스 안내(앱 retired/PassNudgeCard.tsx, 기획 T-11-747 R1). 패스가 없는 구단주가 이번 시즌 은퇴 5 · 9 · 15 ·
  // 25명을 넘긴 것이 확인되면 내 은퇴 선수 카드들 아래에 한 번 보인다. 서버를 부르지 않고(app-core passNudge가 기기에 적어 둔
  // 어림), 보상 수량은 적지 않는다. '시즌 패스 보기'가 여는 패스 화면이 실제 진행도 · 보상을 서버에서 받는다.
  import { onMount } from 'svelte';
  import { onPassNudge, takePassNudge } from '@offside/app-core/passNudge';
  import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';
  import { passEntryOpen } from '@offside/contracts/season-pass';
  import { goSeasonPass } from './nav.js';

  let shown = $state(false);
  onMount(() => {
    if (!passEntryOpen(new Date().toISOString())) return;
    const check = () => {
      if (takePassNudge() !== null) shown = true;
    };
    check();
    // 이 은퇴가 서버에 올라간 뒤에 기준을 넘길 수 있어, 올라갈 때 한 번 더 본다.
    return onPassNudge(check);
  });
</script>

{#if shown}
  <section class="card stack" data-pass-nudge>
    <div><div class="eyebrow">Season pass</div><h2>{L.passNudgeTitle}</h2></div>
    <p class="muted fs-sm">{L.passNudgeBody}</p>
    <div class="row" style="gap:8px">
      <button class="btn btn-primary" onclick={goSeasonPass} data-act="pass-nudge-go">{L.passNudgeGo}</button>
      <button class="btn" onclick={() => (shown = false)} data-act="pass-nudge-close">{L.passNudgeClose}</button>
    </div>
  </section>
{/if}
