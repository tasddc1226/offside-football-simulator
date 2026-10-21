<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { chooseEvent } from '../actions.js';
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  let { v }: { v: Extract<SheetView, { kind: 'event' }> } = $props();
</script>

{#if v.story}
  <div class="story-tag">{L.storyTag({ name: tn(v.story.name) })} <b>{v.story.stage}/{v.story.total}</b></div>
{/if}
<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
<p>{v.text}</p>
<div class="stack">
  {#each v.choices as c, i (i)}
    <!-- T-11-432 득실 칩을 버튼 안에 보인다. 터치 화면에서는 title이 안 보여서다. -->
    <button class="choice" data-choice={i} onclick={() => void chooseEvent(i)}
      ><span class="ec-main"
        ><span>{c.label}</span>
        {#if c.chips.length}
          <span class="ec-chips" data-choice-chips
            >{#each c.chips as ch (ch.text)}<span class="chip {ch.tone}">{ch.text}</span>{/each}</span
          >
        {/if}</span
      ><span class="odds">{c.odds}</span></button
    >
  {/each}
</div>
{#if v.legend.length}
  <!-- T-11-438 '안전' · '원터치' 뜻을 터치 화면에서도 보이게 선택지 아래에 둔다(이벤트 시트는 닫을 수 없어 도감을 못 연다). -->
  <div class="ec-legend" data-event-legend>
    {#each v.legend as l (l.term)}<p><b>{l.term}</b> {l.text}</p>{/each}
  </div>
{/if}

<style>
  .ec-main {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .ec-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ec-chips .chip {
    padding: 1px 7px;
    background: var(--surface);
    font-weight: 600;
  }
  .ec-chips .chip.risk {
    color: var(--muted);
    border-color: var(--line);
  }
  .ec-legend {
    display: grid;
    gap: 2px;
    margin-top: 10px;
    color: var(--muted);
    font-size: var(--fs-caption);
    line-height: 1.45;
  }
  .ec-legend p {
    margin: 0;
  }
  .ec-legend b {
    color: var(--ink);
    font-weight: 700;
  }
</style>
