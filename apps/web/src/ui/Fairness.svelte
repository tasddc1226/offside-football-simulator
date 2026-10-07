<script lang="ts">
  // T-11-141 확률 도감의 '확률과 공정성'(앱 screens/hof/Fairness.tsx). 내용은 app-core fairnessView, 이력은 펼칠 때만 불러온다.
  import { fairnessView, loadHistoryRows, type HistoryRow } from '@offside/app-core/fairness';
  import { kstParts } from '@offside/app-core/boardText';
  import { fairnessText as L } from '@offside/app-core/i18n/ko/fairness';

  let { open = false }: { open?: boolean } = $props();

  const V = fairnessView();

  let history = $state<HistoryRow[] | 'error' | null>(null);
  function loadHistory(e: Event) {
    if (history !== null && history !== 'error') return;
    if (!(e.currentTarget as HTMLDetailsElement).open) return;
    history = null;
    void loadHistoryRows().then((r) => (history = r));
  }
</script>

{#snippet terms(list: (readonly [string, string])[])}
  <dl>
    {#each list as [term, desc] (term)}
      <dt>{term}</dt>
      <dd>{desc}</dd>
    {/each}
  </dl>
{/snippet}

<details class="dex-rules" id="fairness" {open}>
  <summary><b>{L.title}</b></summary>
  <p class="muted fs-sm" style="margin:8px 0 0">{L.intro}</p>
  {@render terms(V.promises)}

  <h3 class="fair-h">{L.potTitle}</h3>
  <table data-fair-pot>
    <thead><tr><th>{L.gradeHead}</th><th class="n">{L.colSeason}</th><th class="n">{L.colPre}</th></tr></thead>
    <tbody>
      {#each V.pot as [g, season, pre] (g)}
        <tr><td>{g}</td><td class="n">{season}</td><td class="n">{pre}</td></tr>
      {/each}
    </tbody>
  </table>
  {#each V.potNotes as note (note)}<p class="muted fs-xs fair-note">{note}</p>{/each}

  <h3 class="fair-h">{L.boostTitle}</h3>
  <table data-fair-boost>
    <tbody>
      {#each V.boost as [lv, p] (lv)}
        <tr><td>{lv}</td><td class="n">{p}</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="muted fs-xs fair-note">{V.boostNote}</p>

  <h3 class="fair-h">{L.hiddenTitle}</h3>
  {@render terms(V.hidden)}

  <details class="fair-history" ontoggle={loadHistory} data-fair-history>
    <summary><b>{L.historyTitle}</b></summary>
    {#if history === null}
      <p class="muted fs-sm" aria-live="polite">{L.historyLoading}</p>
    {:else if history === 'error'}
      <p class="muted fs-sm">{L.historyError}</p>
    {:else if !history.length}
      <p class="muted fs-sm">{L.historyEmpty}</p>
    {:else}
      <ul class="fair-versions">
        {#each history as h (h.version)}
          <li>
            <div class="row" style="justify-content:space-between;gap:8px">
              <b>{L.historyVersion({ v: h.version, day: kstParts(h.activatedAt).day })}</b>
              {#if h.active}<span class="pill">{L.historyActive}</span>{/if}
            </div>
            {#if h.changes.length}
              <ul class="fs-sm">
                {#each h.changes as [name, diff] (name)}
                  <li>{name}{#if diff}<span class="muted fair-diff">{diff}</span>{/if}</li>
                {/each}
              </ul>
            {:else}
              <p class="muted fs-sm" style="margin:2px 0 0">{L.historySame}</p>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="muted fs-xs fair-note">{L.historyNote}</p>
    {/if}
  </details>
</details>
