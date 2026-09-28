<script lang="ts">
  // 은퇴한 내 선수의 대표 칭호 고르기(은퇴 화면·내 선수 상세 아래). 받은 칭호 목록은 접어 두고, 펼쳐서 고르면 선수
  // 카드·명예의 전당·공유 링크의 대표 칭호가 바뀐다.
  import { titleById, type TitleDef } from '../../game/titles.js';
  import type { HofEntry } from '../../game/types.js';
  import { legendTitleOf, setLegendTitle } from './legendTitle.svelte.js';
  import TitleTag from './TitleTag.svelte';

  const { h }: { h: HofEntry } = $props();
  const earned = $derived(
    (h.detail?.titles ?? [])
      .map((e) => ({ d: titleById(e.id), year: e.year }))
      .filter((x): x is { d: TitleDef; year: number } => !!x.d)
      .sort((a, b) => b.d.rarity - a.d.rarity || b.year - a.year),
  );
  const current = $derived(titleById(legendTitleOf(h.id, h.title)));
  let open = $state(false);

  function pick(id: string) {
    setLegendTitle(h, id);
    open = false;
  }
</script>

{#if earned.length > 1}
  <section class="card stack" data-legend-titles>
    <div><div class="eyebrow">Titles</div><h2>대표 칭호</h2></div>
    <p class="title-main">
      {#if current}<TitleTag name={current.name} rarity={current.rarity} />{:else}<span class="muted">없음</span>{/if}
    </p>
    <details class="title-pick" bind:open>
      <summary data-act="legend-title-open">받은 칭호 {earned.length}개 중에서 바꾸기</summary>
      {#if open}
        <ul class="title-list">
          {#each earned as x (x.d.id)}
            <li>
              <button class="title-item" data-legend-title-pick={x.d.id} aria-pressed={current?.id === x.d.id} onclick={() => pick(x.d.id)}>
                <TitleTag name={x.d.name} rarity={x.d.rarity} />
                <span class="title-desc">{x.d.desc}</span>
                <span class="title-year num">{x.year ? x.year : '이전 기록'}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </details>
    <p class="muted fs-xs">고른 칭호는 선수 카드와 명예의 전당·공유 링크에 표시됩니다.</p>
  </section>
{/if}
