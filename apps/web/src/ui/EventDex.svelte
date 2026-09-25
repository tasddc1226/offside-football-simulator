<script lang="ts">
  // T-10-012 확률 도감. 공통 규칙과 이벤트별 선택지 확률(범위·영향 요인)을 게임 코드에서 직접 뽑아 보여 준다.
  // 스토리·특별 이벤트는 한 번 겪어야 열린다(스포일러 보호). 분석 코드와 함께 처음 열 때 불러오는 화면이다.
  import { onMount } from 'svelte';
  import '../game/index.js';
  import { EVENT_RULES, JITTER_RANGE } from '../game/engine.js';
  import { DEX_GROUPS, eventDex, type DexChoice, type DexEntry, type DexGroup } from '../game/eventDex.js';
  import { dexSeen } from './dex.js';
  import { goHome } from './actions.js';
  import Topbar from './Topbar.svelte';

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const span = ([lo, hi]: readonly [number, number]) => `${pct(lo)}~${pct(hi)}`;
  const R = EVENT_RULES;
  const cost = R.safeCost.map((c) => `${c.label} −${c.min === c.max ? c.min : `${c.min}~${c.max}`}`).join(' / ');
  const RULES = [
    ['이벤트가 생길 확률', `구간마다 프리시즌 ${pct(R.rate.preseason)}, 전반기·후반기 ${pct(R.rate.season)}. 스토리의 다음 단계는 예정된 때에 따로 찾아와요.`],
    ['같은 이벤트', `한 번 나온 이벤트는 최소 ${R.cooldown}구간 동안 다시 나오지 않고, 볼수록 덜 나와요(가중치 1/(1+본 횟수)).`],
    ['성공 판정', '선택 창에 뜨는 %가 실제 판정 확률이에요. 0~100 사이 무작위 수가 그보다 작으면 성공 — 숨은 보정은 없어요.'],
    ['안전한 선택', `판정 없이 확정되지만 좋은 효과가 ${span(JITTER_RANGE.safe)}로 줄고, ${pct(R.twist)} 확률로 대가를 치러요(${cost} 중 하나).`],
    ['결과 수치', `그 밖의 효과는 표시된 크기의 ${span(JITTER_RANGE.normal)} 사이에서 정해져요.`],
    ['뜻밖의 반전', `대가가 없었다면 ${pct(R.twist)} 확률로 능력치 하나가 바뀌어요. 오를 확률 — 성공·확정 ${pct(R.twistUp.ok)}, 실패 ${pct(R.twistUp.fail)}, 안전한 선택 ${pct(R.twistUp.safe)} (오르면 +1~2, 내리면 −1).`],
  ] as const;

  let dex = $state<DexEntry[] | null>(null);
  let filter = $state<DexGroup | 'all'>('all');
  const seen = dexSeen();
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

  function oddsText(c: DexChoice): string {
    if (c.kind === 'safe') return '안전';
    if (c.kind === 'sure') return '확정';
    if (c.min === null || c.max === null) return '상황별';
    return c.min === c.max ? `${c.min}%` : `${c.min}~${c.max}%`;
  }
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>← 홈</button>
    {/snippet}
  </Topbar>
  <section class="card stack" style="gap:14px">
    <div>
      <div class="eyebrow">Odds</div>
      <h1>확률 도감</h1>
      <p class="muted" style="margin:6px 0 0;font-size:13px">
        선택지의 성공 확률은 선수 상태로 계산돼요. 게임 코드에서 직접 뽑은 범위와 영향 요인을 그대로 공개합니다.
      </p>
    </div>

    <details class="dex-rules" open>
      <summary><b>공통 규칙</b></summary>
      <dl>
        {#each RULES as [term, desc] (term)}
          <dt>{term}</dt>
          <dd>{desc}</dd>
        {/each}
      </dl>
    </details>

    {#if !dex}
      <p class="muted" aria-live="polite">확률을 계산하는 중…</p>
    {:else}
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h2 style="margin:0">이벤트</h2>
        <span class="muted" style="font-size:13px" data-dex-progress>발견 {foundCount}/{dex.length}</span>
      </div>
      <div class="seg dex-tabs" role="group" aria-label="분류">
        <button class="opt" aria-pressed={filter === 'all'} data-dex-filter="all" onclick={() => (filter = 'all')}>전체</button>
        {#each DEX_GROUPS as g (g.id)}
          <button class="opt" aria-pressed={filter === g.id} data-dex-filter={g.id} onclick={() => (filter = g.id)}>{g.name}</button>
        {/each}
      </div>
      <ul class="dex-list">
        {#each shown as e (e.ids[0])}
          <li data-dex={e.ids[0]} data-locked={hidden(e) || undefined}>
            {#if hidden(e)}
              <div class="dex-locked">
                <span aria-hidden="true">🔒</span>
                <span>아직 만나지 못한 {e.group === 'story' ? `스토리 이벤트 · ${e.story?.stage ?? '?'}단계` : '특별 이벤트'}</span>
              </div>
            {:else}
              <details>
                <summary>
                  <span class="dex-title">{#if found(e)}<span class="dex-check" aria-label="발견">✓</span>{/if}{e.title}</span>
                  <span class="row" style="gap:4px">
                    {#if e.pos}<span class="pill">{e.pos}</span>{/if}
                    {#if e.story}<span class="pill">{e.story.name} {e.story.stage}/{e.story.total}</span>{/if}
                  </span>
                </summary>
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
                {#if e.dependsOnPast}<p class="muted dex-note">앞 단계에서 한 선택에 따라 확률이 달라져요.</p>{/if}
              </details>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="muted" style="font-size:12px;margin:0">▲는 값이 클수록 성공 확률이 오르고, ▼는 내려가요. 범위는 가능한 선수 상태 전체에서 나올 수 있는 최저~최고예요.</p>
    {/if}
  </section>
</div>
