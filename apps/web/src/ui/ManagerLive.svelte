<script lang="ts">
  // T-11-310 감독 시즌 경기 중계 — 선수 커리어 경기 중계 시트(sheets/Block.svelte)처럼 한 경기씩 올라오며 승무패 · 승점이
  // 쌓인다. 경기 목록은 결산이 정한 승무패를 나눈 연출용이다(managerMatchday). 다 보거나 '결과 바로 보기'를 누르면 결산으로.
  import { onDestroy } from 'svelte';
  import { tn } from '@offside/game/i18n/names';
  import type { MgrMatch } from '@offside/game/manager';
  import { RES_LABEL } from '@offside/app-core/sheets';
  import { liveStepMs, liveTally } from '@offside/app-core/manager';
  import { managerText as M } from '@offside/app-core/i18n/ko/manager';
  import { buzz } from './motion.js';

  let { n, club, matches, ondone }: { n: number; club: string; matches: MgrMatch[]; ondone: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const step = liveStepMs(matches.length);
  let shown = $state(0);
  // svelte-ignore state_referenced_locally
  let timer: ReturnType<typeof setInterval> | null = matches.length
    ? setInterval(() => {
        shown++;
        if (shown >= matches.length) stop();
      }, step)
    : null;
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    buzz(20);
  }
  function skip() {
    shown = matches.length;
    stop();
  }
  onDestroy(() => timer && clearInterval(timer));

  const played = $derived(matches.slice(0, shown));
  const tally = $derived(liveTally(played));
  const cells = $derived([
    { k: tally.w, l: M.tallyW },
    { k: tally.d, l: M.tallyD },
    { k: tally.l, l: M.tallyL },
    { k: tally.pts, l: M.tallyPts },
  ]);
  const recent = $derived(played.slice(-5).reverse());
  const finished = $derived(shown >= matches.length);
</script>

<!-- T-11-330 감독 시트(PopSheet) 안에 그려서 카드 틀은 두지 않는다. -->
<section class="mg-live" data-manager-live aria-live="polite" aria-busy={!finished}>
  <div class="eyebrow">{M.liveEyebrow({ n })}</div>
  <h2>{club}</h2>
  <div class="prog"><i style:width="{matches.length ? (shown / matches.length) * 100 : 100}%" style:transition-duration="{step}ms"></i></div>
  <div class="prog-meta"><span>{M.liveRound({ rd: shown, total: matches.length })}</span></div>
  <div class="tally">
    {#each cells as t (t.l)}
      <div>{#key t.k}<b class:bump={t.k !== 0}>{t.k}</b>{/key}<span>{t.l}</span></div>
    {/each}
  </div>
  <div class="ticker live">
    {#each recent as m (m.rd)}
      <div><span class="rd">{m.rd}R</span><span class="res {m.res}">{RES_LABEL[m.res]}</span><span>{tn(m.opp)} {m.gf}-{m.ga}</span></div>
    {/each}
  </div>
  {#if finished}
    <button class="btn btn-primary btn-block" data-act="manager-live-done" onclick={ondone}>{M.liveDone}</button>
  {:else}
    <button class="link-btn skip" data-act="manager-live-skip" onclick={skip}>{M.liveSkip}</button>
  {/if}
</section>

<style>
  .mg-live {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mg-live h2 {
    margin: 0;
    font-size: 1.0625rem;
  }
  .skip {
    align-self: center;
  }
</style>
