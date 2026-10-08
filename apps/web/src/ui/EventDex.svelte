<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // T-10-012 확률 도감. 공통 규칙과 이벤트별 선택지 확률(범위·영향 요인)을 게임 코드에서 직접 뽑아 보여 준다.
  // 스토리·특별 이벤트는 한 번 겪어야 열린다(스포일러 보호). 분석 코드와 함께 처음 열 때 불러오는 화면이다.
  import { onMount } from 'svelte';
  import '@offside/game/index';
  import { DEX_GROUPS, eventDex, type DexEntry, type DexGroup } from '@offside/game/eventDex';
  import { dexRules, oddsText } from '@offside/app-core/dexText';
  import { dexSeen } from '@offside/app-core/dex';
  import { dexText as L } from '@offside/app-core/i18n/ko/dex';
  import { appState } from './state.svelte.js';
  import { goHome, takeFairnessFocus } from './nav.js';
  import Fairness from './Fairness.svelte';
  import BackBar from './BackBar.svelte';
  import Topbar from './Topbar.svelte';

  const RULES = dexRules();
  const focusFair = takeFairnessFocus();

  let dex = $state<DexEntry[] | null>(null);
  let filter = $state<DexGroup | 'all'>('all');
  const seen = dexSeen(appState.G);
  const found = (e: DexEntry) => e.ids.some((id) => seen.has(id));
  const hidden = (e: DexEntry) => DEX_GROUPS.find((g) => g.id === e.group)!.hidden && !found(e);
  // 전체 보기는 분류 순서(커리어 → 포지션 → 스토리 → 특별)로 묶는다.
  const order = (e: DexEntry) => DEX_GROUPS.findIndex((g) => g.id === e.group);
  const shown = $derived(dex ? dex.filter((e) => filter === 'all' || e.group === filter).sort((a, b) => order(a) - order(b)) : []);
  const foundCount = $derived(dex ? dex.filter(found).length : 0);

  // 분석은 수십~수백 ms라 화면을 먼저 그린 뒤 계산한다.
  onMount(() => {
    const t = setTimeout(() => (dex = eventDex()), 0);
    return () => clearTimeout(t);
  });
</script>

<div class="wrap">
  <Topbar />
  <section class="card stack" style="gap:14px">
    <div>
      <div class="eyebrow">Odds</div>
      <h1>{L.title}</h1>
      <p class="muted fs-sm" style="margin:6px 0 0">
        {L.intro}
      </p>
    </div>

    <Fairness open={focusFair} />

    <details class="dex-rules" open>
      <summary><b>{L.rulesTitle}</b></summary>
      <dl>
        {#each RULES as [term, desc] (term)}
          <dt>{term}</dt>
          <dd>{desc}</dd>
        {/each}
      </dl>
    </details>

    {#if !dex}
      <p class="muted" aria-live="polite">{L.calculating}</p>
    {:else}
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h2 style="margin:0">{L.events}</h2>
        <span class="muted fs-sm" data-dex-progress>{L.foundCount({ n: foundCount, total: dex.length })}</span>
      </div>
      <div class="seg dex-tabs" role="group" aria-label={L.groupLabel}>
        <button class="opt" aria-pressed={filter === 'all'} data-dex-filter="all" onclick={() => (filter = 'all')}>{L.filterAll}</button>
        {#each DEX_GROUPS as g (g.id)}
          <button class="opt" aria-pressed={filter === g.id} data-dex-filter={g.id} onclick={() => (filter = g.id)}>{g.name}</button>
        {/each}
      </div>
      <p class="muted fs-xs dex-hint">{L.tapHint}</p>
      <ul class="dex-list">
        {#each shown as e (e.ids[0])}
          <li data-dex={e.ids[0]} data-locked={hidden(e) || undefined}>
            {#if hidden(e)}
              <div class="dex-locked">
                <span aria-hidden="true">🔒</span>
                <span>{e.group === 'story' ? L.lockedStory({ stage: e.story?.stage ?? '?' }) : L.lockedSpecial}</span>
              </div>
            {:else}
              <details>
                <summary>
                  <span class="dex-title">{#if found(e)}<span class="dex-check" aria-label={L.foundMark}>✓</span>{/if}{e.title}</span>
                  <span class="row dex-side" style="gap:4px">
                    {#if e.pos}<span class="pill">{e.pos}</span>{/if}
                    {#if e.story}<span class="pill">{tn(e.story.name)} {e.story.stage}/{e.story.total}</span>{/if}
                    <svg class="dex-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
                  </span>
                </summary>
                <p class="dex-body-head">{L.choicesHead({ n: e.choices.length })}</p>
                <ul class="dex-choices">
                  {#each e.choices as c, i (i)}
                    <li>
                      <div class="dex-choice-head">
                        <span>{c.label}</span>
                        <b class="dex-odds" class:safe={c.kind !== 'odds'}>{oddsText(c)}</b>
                      </div>
                      {#if c.factors.length}
                        <div class="chips">
                          {#each c.factors as f (f.label)}
                            <span class="chip {f.up ? 'up' : 'down'}">{f.up ? '▲' : '▼'} {f.label}</span>
                          {/each}
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
                {#if e.dependsOnPast}<p class="muted dex-note">{L.dependsOnPast}</p>{/if}
              </details>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="muted fs-xs" style="margin:0">{L.noteWeb}</p>
    {/if}
  </section>
  <BackBar act="home" fallback={goHome} />
</div>
